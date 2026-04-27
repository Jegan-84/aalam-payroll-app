'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifySession, requireRole } from '@/lib/auth/dal'
import { countLeaveDays, iterateDatesInclusive } from '@/lib/leave/engine'
import { getHolidaysForEmployeeInRange, getLeaveContext } from '@/lib/leave/queries'
import { resolveLeaveYear } from '@/lib/leave/year'
import { ApplyLeaveSchema, type LeaveFormErrors, type LeaveFormState } from '@/lib/leave/schemas'

// -----------------------------------------------------------------------------
// apply
// -----------------------------------------------------------------------------
export async function applyLeaveAction(
  _prev: LeaveFormState,
  formData: FormData,
): Promise<LeaveFormState> {
  const session = await verifySession()
  const parsed = ApplyLeaveSchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as LeaveFormErrors }
  }
  const input = parsed.data

  const [{ weeklyOffDays, leaveTypes }, holidays] = await Promise.all([
    getLeaveContext(),
    getHolidaysForEmployeeInRange(input.employee_id, input.from_date, input.to_date),
  ])

  const daysCount = countLeaveDays(input.from_date, input.to_date, {
    weeklyOffDays,
    holidayDates: holidays,
  })

  if (daysCount <= 0) {
    return { errors: { _form: ['The chosen range has no working days (all WOs/holidays).'] } }
  }

  const leaveType = leaveTypes.find((t) => t.id === input.leave_type_id)
  if (!leaveType) return { errors: { leave_type_id: ['Unknown leave type.'] } }

  // Balance check (LOP / unpaid types skip)
  if (leaveType.is_paid) {
    const admin = createAdminClient()
    const fy = resolveLeaveYear(new Date(input.from_date + 'T00:00:00Z'))
    const { data: bal } = await admin
      .from('leave_balances')
      .select('current_balance')
      .eq('employee_id', input.employee_id)
      .eq('leave_type_id', input.leave_type_id)
      .eq('fy_start', fy.yearStart)
      .maybeSingle()
    const available = Number(bal?.current_balance ?? 0)
    if (available < daysCount) {
      return {
        errors: {
          _form: [
            `Insufficient ${leaveType.code} balance — need ${daysCount}, have ${available}. Seed or adjust balances first.`,
          ],
        },
      }
    }
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('leave_applications')
    .insert({
      employee_id: input.employee_id,
      leave_type_id: input.leave_type_id,
      from_date: input.from_date,
      to_date: input.to_date,
      days_count: daysCount,
      reason: input.reason ?? null,
      status: 'pending',
      applied_by: session.userId,
    })
    .select('id')
    .single()

  if (error) return { errors: { _form: [error.message] } }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'leave.apply',
    entity_type: 'leave_application',
    entity_id: data.id,
    summary: `Leave applied: ${leaveType.code} ${input.from_date} → ${input.to_date} (${daysCount}d)`,
  })

  // Notify HR + admins that a new leave application needs review.
  const { notifyByRoles } = await import('@/lib/notifications/service')
  await notifyByRoles(['admin', 'hr'], {
    kind: 'leave.applied',
    title: `Leave request — ${leaveType.code} (${daysCount}d)`,
    body: `${input.from_date} → ${input.to_date}. Click to review.`,
    href: `/leave/${data.id}`,
    severity: 'info',
  })

  revalidatePath('/leave')
  redirect(`/leave/${data.id}`)
}

// -----------------------------------------------------------------------------
// approve
// -----------------------------------------------------------------------------
export async function approveLeaveAction(formData: FormData) {
  const session = await verifySession()
  const id = String(formData.get('id') ?? '')
  const notes = (formData.get('notes') as string | null) ?? null
  if (!id) return

  const admin = createAdminClient()
  const { data: app, error: fetchErr } = await admin
    .from('leave_applications')
    .select('*, leave_type:leave_types ( id, code, is_paid )')
    .eq('id', id)
    .maybeSingle()
  if (fetchErr || !app) return

  if (app.status !== 'pending') return

  type LT = { id: number; code: string; is_paid: boolean }
  const lt = (Array.isArray(app.leave_type) ? app.leave_type[0] : app.leave_type) as LT | null
  if (!lt) return

  const fy = resolveLeaveYear(new Date((app.from_date as string) + 'T00:00:00Z'))

  // 1. Mark application approved
  await admin
    .from('leave_applications')
    .update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by: session.userId,
      review_notes: notes,
    })
    .eq('id', id)

  // 2. Deduct from balance (only for paid leave types)
  if (lt.is_paid) {
    // Ensure a row exists for this FY+type, then increment `used`
    await admin
      .from('leave_balances')
      .upsert(
        {
          employee_id: app.employee_id,
          leave_type_id: app.leave_type_id,
          fy_start: fy.yearStart,
          fy_end: fy.yearEnd,
        },
        { onConflict: 'employee_id,leave_type_id,fy_start', ignoreDuplicates: true },
      )

    const { data: current } = await admin
      .from('leave_balances')
      .select('id, used')
      .eq('employee_id', app.employee_id)
      .eq('leave_type_id', app.leave_type_id)
      .eq('fy_start', fy.yearStart)
      .maybeSingle()

    if (current) {
      await admin
        .from('leave_balances')
        .update({ used: Number(current.used ?? 0) + Number(app.days_count) })
        .eq('id', current.id)
    }
  }

  // 3. Write LEAVE/LOP cells into attendance_days for every working day in range
  const { weeklyOffDays } = await getLeaveContext()
  const holidays = await getHolidaysForEmployeeInRange(
    app.employee_id as string,
    app.from_date as string,
    app.to_date as string,
  )
  const attendanceStatus = lt.code === 'LOP' ? 'LOP' : 'LEAVE'

  const cellRows: Array<{
    employee_id: string
    attendance_date: string
    status: string
    leave_type_id: number | null
    updated_by: string
  }> = []
  for (const iso of iterateDatesInclusive(app.from_date as string, app.to_date as string)) {
    const dow = new Date(iso + 'T00:00:00Z').getUTCDay()
    if (weeklyOffDays.includes(dow)) continue
    if (holidays.has(iso)) continue
    cellRows.push({
      employee_id: app.employee_id as string,
      attendance_date: iso,
      status: attendanceStatus,
      leave_type_id: attendanceStatus === 'LEAVE' ? (app.leave_type_id as number) : null,
      updated_by: session.userId,
    })
  }

  if (cellRows.length > 0) {
    await admin
      .from('attendance_days')
      .upsert(cellRows, { onConflict: 'employee_id,attendance_date' })
  }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'leave.approve',
    entity_type: 'leave_application',
    entity_id: id,
    summary: `Approved ${lt.code} ${app.from_date} → ${app.to_date}`,
    after_state: { notes },
  })

  // Notify the employee.
  const { createNotification } = await import('@/lib/notifications/service')
  await createNotification({
    employeeId: app.employee_id as string,
    kind: 'leave.reviewed',
    title: `Leave approved — ${lt.code}`,
    body: `Your ${lt.code} for ${app.from_date} → ${app.to_date} has been approved.`,
    href: `/me/leave`,
    severity: 'success',
  })

  revalidatePath('/leave')
  revalidatePath(`/leave/${id}`)
  revalidatePath('/attendance')
}

// -----------------------------------------------------------------------------
// reject
// -----------------------------------------------------------------------------
export async function rejectLeaveAction(formData: FormData) {
  const session = await verifySession()
  const id = String(formData.get('id') ?? '')
  const notes = (formData.get('notes') as string | null) ?? null
  if (!id) return

  const admin = createAdminClient()

  const { data: app } = await admin
    .from('leave_applications')
    .select('employee_id, from_date, to_date, leave_type:leave_types ( code )')
    .eq('id', id)
    .maybeSingle()

  await admin
    .from('leave_applications')
    .update({
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
      reviewed_by: session.userId,
      review_notes: notes,
    })
    .eq('id', id)
    .eq('status', 'pending')

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'leave.reject',
    entity_type: 'leave_application',
    entity_id: id,
    summary: `Rejected leave application`,
    after_state: { notes },
  })

  if (app) {
    const lt = Array.isArray(app.leave_type) ? app.leave_type[0] : app.leave_type
    const code = (lt as { code?: string } | null)?.code ?? 'leave'
    const { createNotification } = await import('@/lib/notifications/service')
    await createNotification({
      employeeId: app.employee_id as string,
      kind: 'leave.reviewed',
      title: `Leave rejected — ${code}`,
      body: `Your ${code} for ${app.from_date} → ${app.to_date} was rejected${notes ? `: ${notes}` : '.'}`,
      href: `/me/leave`,
      severity: 'warn',
    })
  }

  revalidatePath('/leave')
  revalidatePath(`/leave/${id}`)
}

// -----------------------------------------------------------------------------
// cancel (after approval) — refund balance and restore attendance defaults
// -----------------------------------------------------------------------------
export async function cancelLeaveAction(formData: FormData) {
  const session = await verifySession()
  const id = String(formData.get('id') ?? '')
  const notes = (formData.get('notes') as string | null) ?? null
  if (!id) return

  const admin = createAdminClient()
  const { data: app } = await admin
    .from('leave_applications')
    .select('*, leave_type:leave_types ( id, code, is_paid )')
    .eq('id', id)
    .maybeSingle()
  if (!app || app.status === 'cancelled') return

  const wasApproved = app.status === 'approved'

  await admin
    .from('leave_applications')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancelled_by: session.userId,
      review_notes: notes,
    })
    .eq('id', id)

  if (wasApproved) {
    type LT = { id: number; code: string; is_paid: boolean }
    const lt = (Array.isArray(app.leave_type) ? app.leave_type[0] : app.leave_type) as LT | null
    const fy = resolveLeaveYear(new Date((app.from_date as string) + 'T00:00:00Z'))

    if (lt?.is_paid) {
      const { data: current } = await admin
        .from('leave_balances')
        .select('id, used')
        .eq('employee_id', app.employee_id)
        .eq('leave_type_id', app.leave_type_id)
        .eq('fy_start', fy.yearStart)
        .maybeSingle()
      if (current) {
        const refunded = Math.max(0, Number(current.used ?? 0) - Number(app.days_count))
        await admin.from('leave_balances').update({ used: refunded }).eq('id', current.id)
      }
    }

    // Remove LEAVE/LOP cells in the range that aren't locked
    await admin
      .from('attendance_days')
      .delete()
      .eq('employee_id', app.employee_id)
      .gte('attendance_date', app.from_date as string)
      .lte('attendance_date', app.to_date as string)
      .in('status', ['LEAVE', 'LOP'])
      .eq('locked', false)
  }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'leave.cancel',
    entity_type: 'leave_application',
    entity_id: id,
    summary: `Cancelled leave application (was ${app.status})`,
    after_state: { notes },
  })

  revalidatePath('/leave')
  revalidatePath(`/leave/${id}`)
  revalidatePath('/attendance')
}

// -----------------------------------------------------------------------------
// seedFyBalances — initialize opening balances for every active employee × paid leave type
// -----------------------------------------------------------------------------
export async function seedFyBalancesAction(formData: FormData): Promise<{ ok?: true; error?: string; inserted?: number }> {
  const session = await verifySession()
  const fyStart = String(formData.get('fy_start') ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fyStart)) return { error: 'Invalid fy_start' }

  const admin = createAdminClient()
  const fyEnd = new Date(new Date(fyStart + 'T00:00:00Z').getTime())
  fyEnd.setUTCFullYear(fyEnd.getUTCFullYear() + 1)
  fyEnd.setUTCDate(fyEnd.getUTCDate() - 1)
  const fyEndIso = fyEnd.toISOString().slice(0, 10)

  // Fetch employees with their employment_type so we can honour per-type eligibility.
  const [{ data: employees }, { data: leaveTypes }] = await Promise.all([
    admin.from('employees').select('id, employment_type').eq('employment_status', 'active'),
    admin.from('leave_types').select('id, is_paid, annual_quota_days, accrual_type, applicable_employment_types').eq('is_active', true),
  ])

  const rows: Array<Record<string, unknown>> = []
  for (const e of employees ?? []) {
    for (const lt of leaveTypes ?? []) {
      if (!lt.is_paid) continue
      const allowed = (lt.applicable_employment_types as string[] | null) ?? null
      if (allowed && allowed.length > 0 && !allowed.includes(e.employment_type as string)) continue
      // Half-yearly types start at 0 (accrual runner credits H1 on Jan 1).
      // Annual types (like EL) get their full quota upfront as opening_balance.
      const opening =
        lt.accrual_type === 'annual' ? Number(lt.annual_quota_days ?? 0) : 0
      rows.push({
        employee_id: e.id,
        leave_type_id: lt.id,
        fy_start: fyStart,
        fy_end: fyEndIso,
        opening_balance: opening,
      })
    }
  }

  if (rows.length === 0) return { ok: true, inserted: 0 }

  const { error, count } = await admin
    .from('leave_balances')
    .upsert(rows, { onConflict: 'employee_id,leave_type_id,fy_start', ignoreDuplicates: true, count: 'exact' })
  if (error) return { error: error.message }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'leave.seed_fy',
    summary: `Seeded leave balances for FY starting ${fyStart} (${count ?? rows.length} rows)`,
  })

  revalidatePath('/leave/balances')
  return { ok: true, inserted: count ?? rows.length }
}

// -----------------------------------------------------------------------------
// convertEmploymentType — change an employee's employment_type and reconcile
// leave eligibility in one shot:
//   • newly-eligible types  → insert prorated balance row from `effective_date`
//   • newly-INeligible types → existing rows are kept (HR can claw back via
//     Adjust if they want; we don't auto-delete to preserve audit history).
// Writes employee_employment_history + audit log.
// -----------------------------------------------------------------------------
const VALID_EMP_TYPES = ['full_time', 'probation', 'contract', 'intern', 'consultant'] as const
type EmpType = typeof VALID_EMP_TYPES[number]

export async function convertEmploymentTypeAction(
  formData: FormData,
): Promise<{
  ok?: true; error?: string;
  added?: Array<{ code: string; days: number }>;
  dropped?: Array<{ code: string; balance: number }>;
}> {
  const session = await verifySession()
  await requireRole('admin', 'hr')

  const employeeId = String(formData.get('employee_id') ?? '')
  const newType = String(formData.get('new_employment_type') ?? '') as EmpType
  const effectiveDate = String(formData.get('effective_date') ?? '')
  const reason = String(formData.get('reason') ?? '').trim()
  const fyStartOverride = String(formData.get('fy_start') ?? '').trim()

  if (!employeeId) return { error: 'Missing employee_id' }
  if (!VALID_EMP_TYPES.includes(newType)) return { error: 'Invalid employment type' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) return { error: 'Invalid effective_date' }
  if (!reason) return { error: 'Reason is required' }

  const admin = createAdminClient()

  const { data: emp } = await admin
    .from('employees')
    .select('id, employee_code, full_name_snapshot, employment_type, department_id, designation_id, location_id, reports_to')
    .eq('id', employeeId)
    .maybeSingle()
  if (!emp) return { error: 'Employee not found' }
  const oldType = emp.employment_type as EmpType
  if (oldType === newType) return { error: `Employee is already ${newType}` }

  // Resolve the leave year — default to the leave year that contains effective_date.
  const fyStart = fyStartOverride && /^\d{4}-\d{2}-\d{2}$/.test(fyStartOverride)
    ? fyStartOverride
    : `${effectiveDate.slice(0, 4)}-01-01`
  const fyEnd = new Date(new Date(fyStart + 'T00:00:00Z').getTime())
  fyEnd.setUTCFullYear(fyEnd.getUTCFullYear() + 1)
  fyEnd.setUTCDate(fyEnd.getUTCDate() - 1)
  const fyEndIso = fyEnd.toISOString().slice(0, 10)

  // Effective date may be earlier than fyStart (rare). Clamp.
  const effective = effectiveDate > fyStart ? effectiveDate : fyStart
  const effDate = new Date(effective + 'T00:00:00Z')
  const fyEndDate = new Date(fyEndIso + 'T00:00:00Z')
  const monthsRemaining = Math.max(
    0,
    (fyEndDate.getUTCFullYear() - effDate.getUTCFullYear()) * 12
      + (fyEndDate.getUTCMonth() - effDate.getUTCMonth())
      + 1,
  )
  const proRata = Math.min(1, monthsRemaining / 12)

  // Eligibility delta.
  const { data: leaveTypes } = await admin
    .from('leave_types')
    .select('id, code, is_paid, annual_quota_days, accrual_type, applicable_employment_types')
    .eq('is_active', true)

  const eligible = (lt: { applicable_employment_types: string[] | null }, t: EmpType) => {
    const allowed = lt.applicable_employment_types
    if (!allowed || allowed.length === 0) return allowed === null  // null=all, []=none
    return allowed.includes(t)
  }

  const newlyEligible = (leaveTypes ?? []).filter(
    (lt) => !eligible(lt as { applicable_employment_types: string[] | null }, oldType)
         &&  eligible(lt as { applicable_employment_types: string[] | null }, newType),
  )
  const newlyIneligibleIds = (leaveTypes ?? [])
    .filter((lt) =>  eligible(lt as { applicable_employment_types: string[] | null }, oldType)
                 && !eligible(lt as { applicable_employment_types: string[] | null }, newType))
    .map((lt) => lt.id as number)

  // Existing rows so we don't double-allocate newly-eligible types.
  const { data: existingBalances } = await admin
    .from('leave_balances')
    .select('leave_type_id, current_balance')
    .eq('employee_id', employeeId)
    .eq('fy_start', fyStart)
  const existingIds = new Set((existingBalances ?? []).map((b) => b.leave_type_id as number))
  const balanceById = new Map((existingBalances ?? []).map((b) => [b.leave_type_id as number, Number(b.current_balance ?? 0)]))

  // 1. Update employees.employment_type.
  {
    const { error } = await admin
      .from('employees')
      .update({ employment_type: newType, updated_by: session.userId })
      .eq('id', employeeId)
    if (error) return { error: error.message }
  }

  // 2. Append history.
  {
    const { error } = await admin.from('employee_employment_history').insert({
      employee_id:     employeeId,
      effective_from:  effectiveDate,
      department_id:   emp.department_id ?? null,
      designation_id:  emp.designation_id ?? null,
      location_id:     emp.location_id ?? null,
      reports_to:      emp.reports_to ?? null,
      employment_type: newType,
      change_reason:   `type_conversion: ${oldType} → ${newType} — ${reason}`,
      created_by:      session.userId,
    })
    if (error) return { error: error.message }
  }

  // 3. Insert prorated rows for newly-eligible types.
  const added: Array<{ code: string; days: number }> = []
  const rowsToInsert: Array<Record<string, unknown>> = []
  for (const lt of newlyEligible) {
    if (!lt.is_paid) continue
    if (existingIds.has(lt.id as number)) continue
    const quota = Number(lt.annual_quota_days ?? 0)
    const opening = lt.accrual_type === 'annual' ? Math.round(quota * proRata * 2) / 2 : 0
    rowsToInsert.push({
      employee_id: employeeId,
      leave_type_id: lt.id,
      fy_start: fyStart,
      fy_end: fyEndIso,
      opening_balance: opening,
      notes: `[type_conversion] ${oldType} → ${newType} on ${effectiveDate} · prorated ${(proRata * 100).toFixed(0)}% (${monthsRemaining}/12 months) · ${reason}`,
    })
    added.push({ code: lt.code as string, days: opening })
  }
  if (rowsToInsert.length > 0) {
    const { error } = await admin.from('leave_balances').insert(rowsToInsert)
    if (error) return { error: error.message }
  }

  // 4. Compute the "no longer eligible" report (we don't actually delete).
  const dropped = newlyIneligibleIds
    .filter((id) => existingIds.has(id))
    .map((id) => {
      const lt = (leaveTypes ?? []).find((t) => t.id === id)
      return { code: (lt?.code as string) ?? `#${id}`, balance: balanceById.get(id) ?? 0 }
    })

  // 5. Audit.
  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'employee.convert_type',
    entity_type: 'employee',
    entity_id: employeeId,
    summary: `${emp.employee_code}: ${oldType} → ${newType} (eff. ${effectiveDate}). Added ${added.length} type(s); ${dropped.length} type(s) no longer eligible (balances kept). ${reason}`,
    before_state: { employment_type: oldType },
    after_state:  { employment_type: newType, effective_date: effectiveDate, added, dropped },
  })

  revalidatePath(`/employees/${employeeId}`)
  revalidatePath('/leave/balances')
  return { ok: true, added, dropped }
}

// -----------------------------------------------------------------------------
// allocateForNewJoiner — prorate annual quotas by months remaining from DOJ.
// For each leave type the employee is eligible for:
//   accrual_type='annual'     → opening = quota × (months_remaining / 12)
//   accrual_type='half_yearly'→ opening = 0 (next H1/H2 accrual credits it)
//   accrual_type='monthly'    → opening = 0 (monthly accrual credits it)
//   accrual_type='none'       → opening = 0
// Inserts new rows; existing rows are left untouched (HR can use Adjust to
// override). Idempotent.
// -----------------------------------------------------------------------------
export async function allocateForNewJoinerAction(
  formData: FormData,
): Promise<{ ok?: true; error?: string; created?: number }> {
  const session = await verifySession()
  await requireRole('admin', 'hr', 'payroll')

  const employeeId = String(formData.get('employee_id') ?? '')
  const fyStart = String(formData.get('fy_start') ?? '')
  const dojOverride = String(formData.get('doj') ?? '').trim()

  if (!employeeId) return { error: 'Missing employee_id' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fyStart)) return { error: 'Invalid fy_start' }

  const admin = createAdminClient()

  const { data: emp } = await admin
    .from('employees')
    .select('employee_code, full_name_snapshot, employment_type, date_of_joining')
    .eq('id', employeeId)
    .maybeSingle()
  if (!emp) return { error: 'Employee not found' }

  const doj = dojOverride && /^\d{4}-\d{2}-\d{2}$/.test(dojOverride)
    ? dojOverride
    : (emp.date_of_joining as string | null) ?? ''
  if (!doj) return { error: 'Employee has no DOJ; pass doj in the form to override' }

  // Effective start within the leave year.
  const effective = doj > fyStart ? doj : fyStart
  const fyEnd = new Date(new Date(fyStart + 'T00:00:00Z').getTime())
  fyEnd.setUTCFullYear(fyEnd.getUTCFullYear() + 1)
  fyEnd.setUTCDate(fyEnd.getUTCDate() - 1)
  const fyEndIso = fyEnd.toISOString().slice(0, 10)

  // Prorate factor: months from `effective` (start of that month) through end of FY.
  const effDate = new Date(effective + 'T00:00:00Z')
  const fyEndDate = new Date(fyEndIso + 'T00:00:00Z')
  const monthsRemaining = Math.max(
    0,
    (fyEndDate.getUTCFullYear() - effDate.getUTCFullYear()) * 12
      + (fyEndDate.getUTCMonth() - effDate.getUTCMonth())
      + 1,
  )
  const proRata = Math.min(1, monthsRemaining / 12)

  const { data: leaveTypes } = await admin
    .from('leave_types')
    .select('id, code, is_paid, annual_quota_days, accrual_type, applicable_employment_types')
    .eq('is_active', true)

  const { data: existing } = await admin
    .from('leave_balances')
    .select('leave_type_id')
    .eq('employee_id', employeeId)
    .eq('fy_start', fyStart)
  const existingIds = new Set((existing ?? []).map((r) => r.leave_type_id as number))

  const empType = emp.employment_type as string
  const rowsToInsert: Array<Record<string, unknown>> = []
  for (const lt of leaveTypes ?? []) {
    if (existingIds.has(lt.id as number)) continue
    if (!lt.is_paid) continue
    const allowed = (lt.applicable_employment_types as string[] | null) ?? null
    if (allowed && allowed.length > 0 && !allowed.includes(empType)) continue

    const quota = Number(lt.annual_quota_days ?? 0)
    const opening = lt.accrual_type === 'annual' ? Math.round(quota * proRata * 2) / 2 : 0
    rowsToInsert.push({
      employee_id: employeeId,
      leave_type_id: lt.id,
      fy_start: fyStart,
      fy_end: fyEndIso,
      opening_balance: opening,
      notes: `[joiner] DOJ ${doj} · prorated ${(proRata * 100).toFixed(0)}% (${monthsRemaining}/12 months)`,
    })
  }

  if (rowsToInsert.length === 0) return { ok: true, created: 0 }

  const { error } = await admin.from('leave_balances').insert(rowsToInsert)
  if (error) return { error: error.message }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'leave.allocate_joiner',
    entity_type: 'employee',
    entity_id: employeeId,
    summary: `Allocated leave for joiner ${emp.employee_code}: ${rowsToInsert.length} type(s) prorated by ${(proRata * 100).toFixed(0)}% (DOJ ${doj}, FY ${fyStart})`,
  })

  revalidatePath('/leave/balances')
  revalidatePath(`/employees/${employeeId}`)
  return { ok: true, created: rowsToInsert.length }
}

// -----------------------------------------------------------------------------
// grantSpecialLeave — assign any leave type + days to a specific employee,
// even outside the type's `applicable_employment_types` (Maternity, Paternity,
// Bereavement, etc.). Sets opening_balance = days for that (employee, type, FY).
// -----------------------------------------------------------------------------
export async function grantSpecialLeaveAction(
  formData: FormData,
): Promise<{ ok?: true; error?: string }> {
  const session = await verifySession()
  await requireRole('admin', 'hr', 'payroll')

  const employeeId = String(formData.get('employee_id') ?? '')
  const leaveTypeId = Number(formData.get('leave_type_id') ?? 0)
  const fyStart = String(formData.get('fy_start') ?? '')
  const days = Number(formData.get('days') ?? 0)
  const reason = String(formData.get('reason') ?? '').trim()

  if (!employeeId) return { error: 'Missing employee_id' }
  if (!leaveTypeId) return { error: 'Pick a leave type' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fyStart)) return { error: 'Invalid fy_start' }
  if (!(days > 0 && days <= 365)) return { error: 'Days must be between 0.5 and 365' }
  if (!reason) return { error: 'Reason is required for a special grant' }

  const admin = createAdminClient()

  const fyEnd = new Date(new Date(fyStart + 'T00:00:00Z').getTime())
  fyEnd.setUTCFullYear(fyEnd.getUTCFullYear() + 1)
  fyEnd.setUTCDate(fyEnd.getUTCDate() - 1)
  const fyEndIso = fyEnd.toISOString().slice(0, 10)

  const [{ data: lt }, { data: emp }, { data: existing }] = await Promise.all([
    admin.from('leave_types').select('code, name').eq('id', leaveTypeId).maybeSingle(),
    admin.from('employees').select('employee_code, full_name_snapshot').eq('id', employeeId).maybeSingle(),
    admin.from('leave_balances').select('id, opening_balance, notes')
      .eq('employee_id', employeeId).eq('leave_type_id', leaveTypeId).eq('fy_start', fyStart).maybeSingle(),
  ])
  if (!lt) return { error: 'Leave type not found' }
  if (!emp) return { error: 'Employee not found' }

  const stamped = `[${new Date().toISOString().slice(0, 10)}] ${session.email}: granted ${days}d ${lt.code} — ${reason}`

  if (existing) {
    const { error } = await admin
      .from('leave_balances')
      .update({
        opening_balance: Number(existing.opening_balance ?? 0) + days,
        notes: existing.notes ? `${existing.notes}\n${stamped}` : stamped,
      })
      .eq('id', existing.id)
    if (error) return { error: error.message }
  } else {
    const { error } = await admin
      .from('leave_balances')
      .insert({
        employee_id: employeeId,
        leave_type_id: leaveTypeId,
        fy_start: fyStart,
        fy_end: fyEndIso,
        opening_balance: days,
        notes: stamped,
      })
    if (error) return { error: error.message }
  }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'leave.special_grant',
    entity_type: 'leave_balance',
    entity_id: `${employeeId}:${leaveTypeId}:${fyStart}`,
    summary: `Granted ${days}d ${lt.code} (${lt.name}) to ${emp.employee_code} for ${fyStart}: ${reason}`,
  })

  revalidatePath('/leave/balances')
  revalidatePath(`/employees/${employeeId}`)
  return { ok: true }
}

// -----------------------------------------------------------------------------
// adjustLeaveBalance — HR override of `adjustment` column for one row.
// In-place edit; before/after snapshotted in audit_log. Notes mandatory.
// -----------------------------------------------------------------------------
export async function adjustLeaveBalanceAction(
  formData: FormData,
): Promise<{ ok?: true; error?: string }> {
  const session = await verifySession()
  await requireRole('admin', 'hr', 'payroll')

  const employeeId = String(formData.get('employee_id') ?? '')
  const leaveTypeId = Number(formData.get('leave_type_id') ?? 0)
  const fyStart = String(formData.get('fy_start') ?? '')
  const adjustment = Number(formData.get('adjustment'))
  const notes = String(formData.get('notes') ?? '').trim()

  if (!employeeId) return { error: 'Missing employee_id' }
  if (!leaveTypeId) return { error: 'Missing leave_type_id' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fyStart)) return { error: 'Invalid fy_start' }
  if (!Number.isFinite(adjustment)) return { error: 'Adjustment must be a number' }
  if (adjustment < -365 || adjustment > 365) return { error: 'Adjustment out of range (-365…365)' }
  if (!notes) return { error: 'Notes are required for an adjustment' }

  const admin = createAdminClient()

  // Resolve fy_end and the leave type code so the audit summary is human-readable.
  const fyEnd = new Date(new Date(fyStart + 'T00:00:00Z').getTime())
  fyEnd.setUTCFullYear(fyEnd.getUTCFullYear() + 1)
  fyEnd.setUTCDate(fyEnd.getUTCDate() - 1)
  const fyEndIso = fyEnd.toISOString().slice(0, 10)

  const [{ data: existing }, { data: lt }, { data: emp }] = await Promise.all([
    admin
      .from('leave_balances')
      .select('id, adjustment, notes')
      .eq('employee_id', employeeId)
      .eq('leave_type_id', leaveTypeId)
      .eq('fy_start', fyStart)
      .maybeSingle(),
    admin.from('leave_types').select('code').eq('id', leaveTypeId).maybeSingle(),
    admin.from('employees').select('employee_code, full_name_snapshot').eq('id', employeeId).maybeSingle(),
  ])

  const before = existing?.adjustment ?? 0
  const stamped = `[${new Date().toISOString().slice(0, 10)}] ${session.email}: ${notes}`
  const newNotes = existing?.notes ? `${existing.notes}\n${stamped}` : stamped

  if (existing) {
    const { error } = await admin
      .from('leave_balances')
      .update({ adjustment, notes: newNotes })
      .eq('id', existing.id)
    if (error) return { error: error.message }
  } else {
    const { error } = await admin
      .from('leave_balances')
      .insert({
        employee_id: employeeId,
        leave_type_id: leaveTypeId,
        fy_start: fyStart,
        fy_end: fyEndIso,
        opening_balance: 0,
        adjustment,
        notes: stamped,
      })
    if (error) return { error: error.message }
  }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'leave.balance_adjust',
    entity_type: 'leave_balance',
    entity_id: `${employeeId}:${leaveTypeId}:${fyStart}`,
    summary: `Adjusted ${lt?.code ?? `type#${leaveTypeId}`} for ${emp?.employee_code ?? employeeId} in ${fyStart}: ${before} → ${adjustment}. ${notes}`,
    before_state: { adjustment: before },
    after_state:  { adjustment },
  })

  revalidatePath('/leave/balances')
  revalidatePath(`/employees/${employeeId}`)
  return { ok: true }
}
