'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifySession } from '@/lib/auth/dal'
import { countLeaveDays, iterateDatesInclusive } from '@/lib/leave/engine'
import { getFyContext, getHolidaysInRange, getLeaveContext, getLeaveTypes } from '@/lib/leave/queries'
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
    getHolidaysInRange(input.from_date, input.to_date),
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
    const fy = await getFyContext(new Date(input.from_date + 'T00:00:00Z'))
    const { data: bal } = await admin
      .from('leave_balances')
      .select('current_balance')
      .eq('employee_id', input.employee_id)
      .eq('leave_type_id', input.leave_type_id)
      .eq('fy_start', fy.fyStart)
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

  const fy = await getFyContext(new Date((app.from_date as string) + 'T00:00:00Z'))

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
          fy_start: fy.fyStart,
          fy_end: fy.fyEnd,
        },
        { onConflict: 'employee_id,leave_type_id,fy_start', ignoreDuplicates: true },
      )

    const { data: current } = await admin
      .from('leave_balances')
      .select('id, used')
      .eq('employee_id', app.employee_id)
      .eq('leave_type_id', app.leave_type_id)
      .eq('fy_start', fy.fyStart)
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
  const holidays = await getHolidaysInRange(app.from_date as string, app.to_date as string)
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
    const fy = await getFyContext(new Date((app.from_date as string) + 'T00:00:00Z'))

    if (lt?.is_paid) {
      const { data: current } = await admin
        .from('leave_balances')
        .select('id, used')
        .eq('employee_id', app.employee_id)
        .eq('leave_type_id', app.leave_type_id)
        .eq('fy_start', fy.fyStart)
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

  const [{ data: employees }, leaveTypes] = await Promise.all([
    admin.from('employees').select('id').eq('employment_status', 'active'),
    getLeaveTypes(),
  ])

  const rows: Array<Record<string, unknown>> = []
  for (const e of employees ?? []) {
    for (const lt of leaveTypes) {
      if (!lt.is_paid) continue
      rows.push({
        employee_id: e.id,
        leave_type_id: lt.id,
        fy_start: fyStart,
        fy_end: fyEndIso,
        opening_balance: lt.annual_quota_days ?? 0,
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
