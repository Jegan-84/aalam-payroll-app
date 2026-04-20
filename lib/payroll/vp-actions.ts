'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifySession } from '@/lib/auth/dal'

const r2 = (n: number): number => Math.round(n * 100) / 100

// -----------------------------------------------------------------------------
// Toggle include_vp — seeds per-employee allocations on enable.
// -----------------------------------------------------------------------------
export async function toggleIncludeVpAction(
  formData: FormData,
): Promise<{ ok?: true; error?: string; seeded?: number }> {
  const session = await verifySession()
  const cycleId = String(formData.get('cycle_id') ?? '')
  const enabled = String(formData.get('enabled') ?? '') === 'true'
  if (!cycleId) return { error: 'Missing cycle_id' }

  const admin = createAdminClient()

  const { data: cycle } = await admin
    .from('payroll_cycles')
    .select('id, status, include_vp')
    .eq('id', cycleId)
    .maybeSingle()
  if (!cycle) return { error: 'Cycle not found' }
  if (cycle.status === 'locked' || cycle.status === 'paid') {
    return { error: `Cycle is ${cycle.status}; cannot change VP toggle.` }
  }

  await admin.from('payroll_cycles').update({ include_vp: enabled }).eq('id', cycleId)

  let seeded = 0
  if (enabled) {
    // Seed allocations for active employees that don't already have one.
    const { data: employees } = await admin
      .from('employees')
      .select('id')
      .in('employment_status', ['active', 'on_notice'])
    const empIds = (employees ?? []).map((e) => e.id as string)

    const { data: structs } = await admin
      .from('salary_structures')
      .select('employee_id, annual_fixed_ctc, variable_pay_percent')
      .is('effective_to', null)
      .eq('status', 'active')
      .in('employee_id', empIds)

    const { data: existing } = await admin
      .from('payroll_cycle_vp_allocations')
      .select('employee_id')
      .eq('cycle_id', cycleId)
    const existingSet = new Set((existing ?? []).map((r) => r.employee_id as string))

    const rows = (structs ?? [])
      .filter((s) => !existingSet.has(s.employee_id as string))
      .map((s) => {
        const ctc = Number(s.annual_fixed_ctc)
        const pct = Number(s.variable_pay_percent)
        const amount = Math.round((ctc * pct) / 100)
        return {
          cycle_id: cycleId,
          employee_id: s.employee_id as string,
          vp_pct: pct,
          vp_amount: amount,
          annual_fixed_ctc_snapshot: ctc,
          created_by: session.userId,
          updated_by: session.userId,
        }
      })

    if (rows.length > 0) {
      const { error: insertErr } = await admin.from('payroll_cycle_vp_allocations').insert(rows)
      if (insertErr) return { error: insertErr.message }
      seeded = rows.length
    }
  }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: enabled ? 'payroll.cycle.vp.enable' : 'payroll.cycle.vp.disable',
    entity_type: 'payroll_cycle',
    entity_id: cycleId,
    summary: enabled
      ? `Enabled Variable Pay for cycle${seeded > 0 ? ` (seeded ${seeded} employee${seeded === 1 ? '' : 's'})` : ''}`
      : 'Disabled Variable Pay for cycle',
  })

  revalidatePath(`/payroll/${cycleId}`)
  return { ok: true, seeded }
}

// -----------------------------------------------------------------------------
// Save one employee's VP allocation (either pct OR amount — the other is derived)
// -----------------------------------------------------------------------------
export async function saveVpAllocationAction(
  formData: FormData,
): Promise<{ ok?: true; error?: string }> {
  const session = await verifySession()
  const cycleId = String(formData.get('cycle_id') ?? '')
  const employeeId = String(formData.get('employee_id') ?? '')
  const pctRaw = formData.get('vp_pct')
  const amountRaw = formData.get('vp_amount')
  if (!cycleId || !employeeId) return { error: 'Missing cycle_id or employee_id' }

  const admin = createAdminClient()

  const { data: cycle } = await admin
    .from('payroll_cycles')
    .select('id, status')
    .eq('id', cycleId)
    .maybeSingle()
  if (!cycle) return { error: 'Cycle not found' }
  if (cycle.status === 'locked' || cycle.status === 'paid') {
    return { error: `Cycle is ${cycle.status}; cannot edit VP.` }
  }

  // Fetch structure to resolve annual CTC for pct↔amount conversion.
  const { data: structure } = await admin
    .from('salary_structures')
    .select('annual_fixed_ctc')
    .eq('employee_id', employeeId)
    .is('effective_to', null)
    .eq('status', 'active')
    .maybeSingle()
  if (!structure) return { error: 'Employee has no active salary structure.' }
  const ctc = Number(structure.annual_fixed_ctc)
  if (!(ctc > 0)) return { error: 'Annual CTC must be positive.' }

  let pct: number
  let amount: number
  if (amountRaw != null && String(amountRaw).trim() !== '') {
    amount = Number(amountRaw)
    if (!Number.isFinite(amount) || amount < 0) return { error: 'Invalid VP amount.' }
    pct = r2((amount / ctc) * 100)
  } else if (pctRaw != null && String(pctRaw).trim() !== '') {
    pct = Number(pctRaw)
    if (!Number.isFinite(pct) || pct < 0) return { error: 'Invalid VP percentage.' }
    amount = Math.round((ctc * pct) / 100)
  } else {
    return { error: 'Provide either vp_pct or vp_amount.' }
  }

  const { error } = await admin
    .from('payroll_cycle_vp_allocations')
    .upsert(
      {
        cycle_id: cycleId,
        employee_id: employeeId,
        vp_pct: pct,
        vp_amount: amount,
        annual_fixed_ctc_snapshot: ctc,
        updated_by: session.userId,
      },
      { onConflict: 'cycle_id,employee_id' },
    )
  if (error) return { error: error.message }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'payroll.cycle.vp.allocate',
    entity_type: 'payroll_cycle',
    entity_id: cycleId,
    summary: `VP allocation updated: ${pct}% / ₹${amount}`,
    after_state: { employee_id: employeeId, vp_pct: pct, vp_amount: amount },
  })

  revalidatePath(`/payroll/${cycleId}`)
  revalidatePath(`/payroll/${cycleId}/${employeeId}`)
  return { ok: true }
}
