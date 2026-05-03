'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifySession } from '@/lib/auth/dal'
import { createNotification } from '@/lib/notifications/service'
import { getApprovalScope } from '@/lib/timesheet/approval-queries'

// Common authorization step. Returns the week + the scope so the caller can
// proceed (or surface an error). Admin/HR/payroll see everything; managers
// see only their direct reports.
async function requireDecidableWeek(
  weekId: string,
): Promise<
  | { ok: true; week: { id: string; employee_id: string; week_start: string; status: string }; actorUserId: string; actorEmail: string }
  | { ok: false; error: string }
> {
  const session = await verifySession()
  const scope = await getApprovalScope()

  const admin = createAdminClient()
  const { data: week } = await admin
    .from('timesheet_weeks')
    .select(`
      id, employee_id, week_start, status,
      employee:employees!inner(reports_to)
    `)
    .eq('id', weekId)
    .maybeSingle()

  if (!week) return { ok: false, error: 'Week not found' }
  type Row = { id: string; employee_id: string; week_start: string; status: string;
               employee: { reports_to: string | null } | { reports_to: string | null }[] }
  const w = week as unknown as Row
  const emp = Array.isArray(w.employee) ? w.employee[0] : w.employee

  const canDecide =
    scope.isAdminish ||
    (scope.employeeId != null && emp?.reports_to === scope.employeeId)
  if (!canDecide) return { ok: false, error: 'Not your team — cannot decide on this week.' }

  return {
    ok: true,
    week: { id: w.id, employee_id: w.employee_id, week_start: w.week_start, status: w.status },
    actorUserId: session.userId,
    actorEmail: session.email,
  }
}

// -----------------------------------------------------------------------------
// approveTimesheetWeekAction
// -----------------------------------------------------------------------------
export async function approveTimesheetWeekAction(
  formData: FormData,
): Promise<{ ok?: true; error?: string }> {
  const weekId = String(formData.get('week_id') ?? '')
  if (!weekId) return { error: 'Missing week_id' }

  const auth = await requireDecidableWeek(weekId)
  if (!auth.ok) return { error: auth.error }
  if (auth.week.status !== 'submitted') {
    return { error: `Cannot approve a week that's already ${auth.week.status}.` }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('timesheet_weeks')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      decided_by: auth.actorUserId,
      decision_note: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', weekId)
    .eq('status', 'submitted')
  if (error) return { error: error.message }

  await admin.from('audit_log').insert({
    actor_user_id: auth.actorUserId,
    actor_email: auth.actorEmail,
    action: 'timesheet.approve',
    entity_type: 'timesheet_week',
    entity_id: weekId,
    summary: `Approved timesheet week ${auth.week.week_start} for employee ${auth.week.employee_id}`,
  })

  await createNotification({
    employeeId: auth.week.employee_id,
    kind: 'timesheet.approved',
    title: `Timesheet approved`,
    body: `Your week starting ${auth.week.week_start} was approved.`,
    href: `/me/timesheet/${auth.week.week_start}`,
    severity: 'success',
  })

  revalidatePath('/me/timesheet/approvals')
  revalidatePath(`/me/timesheet/approvals/${weekId}`)
  revalidatePath('/me/timesheet', 'layout')
  return { ok: true }
}

// -----------------------------------------------------------------------------
// rejectTimesheetWeekAction — sends the week back to draft so the employee can
// edit and resubmit. The decision_note is preserved.
// -----------------------------------------------------------------------------
const RejectSchema = z.object({
  week_id: z.string().uuid(),
  note: z.string().trim().min(1, 'A reason is required when rejecting.'),
})

export async function rejectTimesheetWeekAction(
  formData: FormData,
): Promise<{ ok?: true; error?: string }> {
  const parsed = RejectSchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join('; ') }

  const auth = await requireDecidableWeek(parsed.data.week_id)
  if (!auth.ok) return { error: auth.error }
  if (auth.week.status !== 'submitted') {
    return { error: `Cannot reject a week that's already ${auth.week.status}.` }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('timesheet_weeks')
    .update({
      status: 'rejected',
      decided_by: auth.actorUserId,
      decision_note: parsed.data.note,
      approved_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.week_id)
    .eq('status', 'submitted')
  if (error) return { error: error.message }

  await admin.from('audit_log').insert({
    actor_user_id: auth.actorUserId,
    actor_email: auth.actorEmail,
    action: 'timesheet.reject',
    entity_type: 'timesheet_week',
    entity_id: parsed.data.week_id,
    summary: `Rejected timesheet week ${auth.week.week_start} for employee ${auth.week.employee_id}: ${parsed.data.note}`,
  })

  await createNotification({
    employeeId: auth.week.employee_id,
    kind: 'timesheet.rejected',
    title: `Timesheet rejected`,
    body: `Your week starting ${auth.week.week_start} was rejected. Reason: ${parsed.data.note}`,
    href: `/me/timesheet/${auth.week.week_start}`,
    severity: 'warn',
  })

  revalidatePath('/me/timesheet/approvals')
  revalidatePath(`/me/timesheet/approvals/${parsed.data.week_id}`)
  revalidatePath('/me/timesheet', 'layout')
  return { ok: true }
}

// -----------------------------------------------------------------------------
// bulkApproveTimesheetWeeksAction — approves a checked list at once. Each week
// goes through the same authorization check; failures are reported back.
// -----------------------------------------------------------------------------
export async function bulkApproveTimesheetWeeksAction(
  formData: FormData,
): Promise<{ approved?: number; failed?: Array<{ id: string; reason: string }>; error?: string }> {
  const idsRaw = String(formData.get('week_ids') ?? '').trim()
  if (!idsRaw) return { error: 'No weeks selected' }
  const ids = idsRaw.split(',').map((s) => s.trim()).filter(Boolean)
  if (ids.length === 0) return { error: 'No weeks selected' }

  const failed: Array<{ id: string; reason: string }> = []
  let approved = 0

  for (const weekId of ids) {
    const fd = new FormData()
    fd.set('week_id', weekId)
    const res = await approveTimesheetWeekAction(fd)
    if (res.error) failed.push({ id: weekId, reason: res.error })
    else approved++
  }

  revalidatePath('/me/timesheet/approvals')
  return { approved, failed }
}

// -----------------------------------------------------------------------------
// reopenApprovedWeekAction — manager / admin / HR can roll back an approved
// week so the employee can edit and resubmit. Sets status back to 'draft' and
// pings the employee.
// -----------------------------------------------------------------------------
export async function reopenApprovedWeekAction(
  formData: FormData,
): Promise<{ ok?: true; error?: string }> {
  const weekId = String(formData.get('week_id') ?? '')
  const note = String(formData.get('note') ?? '').trim()
  if (!weekId) return { error: 'Missing week_id' }

  const auth = await requireDecidableWeek(weekId)
  if (!auth.ok) return { error: auth.error }
  if (auth.week.status !== 'approved') {
    return { error: `Cannot reopen a week that's ${auth.week.status} (only 'approved' weeks need manager reopen).` }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('timesheet_weeks')
    .update({
      status: 'draft',
      submitted_at: null,
      approved_at: null,
      decided_by: auth.actorUserId,
      decision_note: note || 'Reopened by manager.',
      updated_at: new Date().toISOString(),
    })
    .eq('id', weekId)
    .eq('status', 'approved')
  if (error) return { error: error.message }

  await admin.from('audit_log').insert({
    actor_user_id: auth.actorUserId,
    actor_email: auth.actorEmail,
    action: 'timesheet.reopen',
    entity_type: 'timesheet_week',
    entity_id: weekId,
    summary: `Reopened approved timesheet week ${auth.week.week_start} for employee ${auth.week.employee_id}${note ? `: ${note}` : ''}`,
  })

  await createNotification({
    employeeId: auth.week.employee_id,
    kind: 'timesheet.reopened',
    title: `Timesheet reopened`,
    body: `Your week starting ${auth.week.week_start} was reopened for editing${note ? `. Note: ${note}` : '.'}`,
    href: `/me/timesheet/${auth.week.week_start}`,
    severity: 'warn',
  })

  revalidatePath('/me/timesheet/approvals')
  revalidatePath(`/me/timesheet/approvals/${weekId}`)
  revalidatePath('/me/timesheet', 'layout')
  return { ok: true }
}
