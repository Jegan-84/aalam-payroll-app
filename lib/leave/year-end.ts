'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifySession, requireRole } from '@/lib/auth/dal'
import { createNotification } from '@/lib/notifications/service'

const PL_TO_EL_TRANSFER_CAP = 6  // days

type LeaveTypeKey = { PL?: number; SL?: number; EL?: number }

function round2(n: number) { return Math.round(n * 100) / 100 }

// -----------------------------------------------------------------------------
// runYearEndConversionAction
// -----------------------------------------------------------------------------
// For the given `leave_year` (e.g. 2025), runs the year-end policy:
//   - If employee has PL > 0 and EL == 0: transfer up to 6 PL days → EL
//   - Remaining PL balance → encashed at (last monthly Basic / 30)
//   - A leave_encashment_queue row is inserted (pending) so the next payroll
//     compute can pick it up as a LEAVE_ENC earning line
//
// Idempotent: duplicate runs for the same (employee, year) will upsert the row.
// -----------------------------------------------------------------------------
export async function runYearEndConversionAction(
  formData: FormData,
): Promise<{ ok?: true; error?: string; converted?: number; skipped?: number; encashmentTotal?: number }> {
  const session = await verifySession()
  await requireRole('admin', 'hr', 'payroll')

  const leaveYear = Number(formData.get('leave_year') ?? 0)
  if (!leaveYear || leaveYear < 2000 || leaveYear > 2100) return { error: 'Invalid leave_year' }

  const yearStart = `${leaveYear}-01-01`
  const admin = createAdminClient()

  // Resolve PL and EL type ids.
  const { data: types } = await admin
    .from('leave_types')
    .select('id, code')
    .in('code', ['PL', 'EL'])
  const byCode: LeaveTypeKey = {}
  for (const t of types ?? []) {
    if (t.code === 'PL') byCode.PL = t.id as number
    if (t.code === 'EL') byCode.EL = t.id as number
  }
  if (!byCode.PL || !byCode.EL) {
    return { error: 'PL or EL leave type missing. Apply migrations first.' }
  }

  // Fetch all PL balances for the year.
  const { data: plBalances } = await admin
    .from('leave_balances')
    .select('employee_id, opening_balance, accrued, carried_forward, used, encashed, adjustment')
    .eq('fy_start', yearStart)
    .eq('leave_type_id', byCode.PL)
  if (!plBalances || plBalances.length === 0) return { ok: true, converted: 0, skipped: 0 }

  // Fetch EL balances keyed by employee.
  const empIds = plBalances.map((b) => b.employee_id as string)
  const { data: elBalances } = await admin
    .from('leave_balances')
    .select('id, employee_id, opening_balance, accrued, carried_forward, used, encashed, adjustment')
    .eq('fy_start', yearStart)
    .eq('leave_type_id', byCode.EL)
    .in('employee_id', empIds)
  type ElRow = NonNullable<typeof elBalances> extends Array<infer R> ? R : never
  const elByEmp = new Map<string, ElRow>()
  for (const b of elBalances ?? []) elByEmp.set(b.employee_id as string, b as ElRow)

  // Last monthly Basic per employee — derive from their active salary structure.
  const { data: structures } = await admin
    .from('salary_structures')
    .select('employee_id, monthly_gross')
    .is('effective_to', null)
    .eq('status', 'active')
    .in('employee_id', empIds)
  const grossByEmp = new Map<string, number>()
  for (const s of structures ?? []) grossByEmp.set(s.employee_id as string, Number(s.monthly_gross))

  let converted = 0
  let skipped = 0
  let encashmentTotal = 0

  for (const pl of plBalances) {
    const empId = pl.employee_id as string
    const plCurrent =
      Number(pl.opening_balance ?? 0) + Number(pl.accrued ?? 0) + Number(pl.carried_forward ?? 0)
      - Number(pl.used ?? 0) - Number(pl.encashed ?? 0) + Number(pl.adjustment ?? 0)
    if (plCurrent <= 0) { skipped++; continue }

    const elRow = elByEmp.get(empId)
    const elCurrent = elRow
      ? Number(elRow.opening_balance ?? 0) + Number(elRow.accrued ?? 0) + Number(elRow.carried_forward ?? 0)
        - Number(elRow.used ?? 0) - Number(elRow.encashed ?? 0) + Number(elRow.adjustment ?? 0)
      : 0

    let transferToEl = 0
    if (elCurrent <= 0) {
      transferToEl = Math.min(PL_TO_EL_TRANSFER_CAP, plCurrent)
    }
    const daysToEncash = Math.max(0, plCurrent - transferToEl)

    // Last monthly Basic ÷ 30 = per-day rate (Basic is 50% of gross in current config).
    // We pull that percentage from statutory_config; fall back to 50% if absent.
    const gross = grossByEmp.get(empId) ?? 0
    const basic = gross * 0.5  // Phase-5 keeps this conservative; Settings has the real config.
    const perDayRate = round2(basic / 30)
    const encashAmt = round2(daysToEncash * perDayRate)

    // 1. Apply the PL → EL transfer and stamp the PL row as encashed.
    if (transferToEl > 0) {
      if (elRow) {
        await admin
          .from('leave_balances')
          .update({
            adjustment: Number(elRow.adjustment ?? 0) + transferToEl,
          })
          .eq('id', elRow.id)
      } else {
        await admin
          .from('leave_balances')
          .insert({
            employee_id: empId,
            leave_type_id: byCode.EL,
            fy_start: yearStart,
            fy_end: `${leaveYear}-12-31`,
            opening_balance: 0,
            adjustment: transferToEl,
          })
      }
    }

    // Stamp PL as fully consumed (transfer + encash).
    await admin
      .from('leave_balances')
      .update({ encashed: Number(pl.encashed ?? 0) + plCurrent })
      .eq('employee_id', empId)
      .eq('leave_type_id', byCode.PL)
      .eq('fy_start', yearStart)

    // 2. Insert / update the encashment queue row.
    if (daysToEncash > 0 || transferToEl > 0) {
      await admin
        .from('leave_encashment_queue')
        .upsert(
          {
            employee_id: empId,
            leave_year: leaveYear,
            pl_days_converted_to_el: transferToEl,
            pl_days_encashed: daysToEncash,
            per_day_rate: perDayRate,
            encashment_amount: encashAmt,
            status: encashAmt > 0 ? 'pending' : 'cancelled',
            created_by: session.userId,
            notes: `Year-end ${leaveYear}: ${plCurrent}d PL → ${transferToEl}d to EL + ${daysToEncash}d encashed @ ₹${perDayRate}/d`,
          },
          { onConflict: 'employee_id,leave_year' },
        )
      encashmentTotal += encashAmt
      converted++
      if (daysToEncash > 0) {
        await createNotification({
          employeeId: empId,
          kind: 'leave.year_end_encashed',
          title: `Leave encashment — ₹${Math.round(encashAmt)}`,
          body: `${daysToEncash} day(s) PL encashed for ${leaveYear}${transferToEl > 0 ? `; ${transferToEl}d moved to EL` : ''}. Will reflect in January ${leaveYear + 1}'s payslip.`,
          href: '/me/leave',
          severity: 'success',
        })
      }
    } else {
      skipped++
    }
  }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'leave.year_end_convert',
    entity_type: 'leave_encashment_queue',
    entity_id: String(leaveYear),
    summary: `Year-end ${leaveYear}: converted ${converted} employees, total encashment ₹${Math.round(encashmentTotal)}`,
  })

  revalidatePath('/leave/balances')
  revalidatePath('/settings/leave-policies')
  return { ok: true, converted, skipped, encashmentTotal: Math.round(encashmentTotal) }
}
