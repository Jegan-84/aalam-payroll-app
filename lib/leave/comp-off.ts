'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifySession, requireRole, getCurrentEmployee } from '@/lib/auth/dal'
import { createNotification } from '@/lib/notifications/service'
import { resolveLeaveYear } from '@/lib/leave/year'

const DEFAULT_EXPIRY_DAYS = 30

function addDaysIso(iso: string, days: number): string {
  return new Date(new Date(iso + 'T00:00:00Z').getTime() + days * 86_400_000)
    .toISOString()
    .slice(0, 10)
}

// -----------------------------------------------------------------------------
// Helper — sum of active (non-expired, non-used) comp off for an employee
// -----------------------------------------------------------------------------
async function recomputeCompOffBalance(
  admin: ReturnType<typeof createAdminClient>,
  employeeId: string,
): Promise<number> {
  const today = new Date().toISOString().slice(0, 10)

  // Expire anything past its date, first.
  await admin
    .from('comp_off_grants')
    .update({ status: 'expired', closed_at: new Date().toISOString(), closed_reason: 'auto-expired' })
    .eq('employee_id', employeeId)
    .eq('status', 'active')
    .lt('expires_on', today)

  const { data } = await admin
    .from('comp_off_grants')
    .select('granted_days')
    .eq('employee_id', employeeId)
    .eq('status', 'active')

  const balance = (data ?? []).reduce((s, r) => s + Number(r.granted_days), 0)

  // Mirror the balance onto leave_balances.accrued for the current leave year,
  // so the standard balance-check logic inside applyLeaveAction keeps working.
  const ly = resolveLeaveYear()
  const { data: type } = await admin
    .from('leave_types')
    .select('id')
    .eq('code', 'COMP_OFF')
    .maybeSingle()
  if (type?.id) {
    await admin
      .from('leave_balances')
      .upsert(
        {
          employee_id: employeeId,
          leave_type_id: type.id,
          fy_start: ly.yearStart,
          fy_end: ly.yearEnd,
          accrued: balance,
          opening_balance: 0,
          used: 0,
          carried_forward: 0,
        },
        { onConflict: 'employee_id,leave_type_id,fy_start' },
      )
  }

  return balance
}

// -----------------------------------------------------------------------------
// grantCompOff — HR grants a day (or fraction) with 30-day expiry
// -----------------------------------------------------------------------------
export async function grantCompOffAction(
  formData: FormData,
): Promise<{ ok?: true; error?: string; id?: string }> {
  const session = await verifySession()
  await requireRole('admin', 'hr', 'payroll')

  const employeeId = String(formData.get('employee_id') ?? '')
  const workDate = String(formData.get('work_date') ?? '')
  const days = Number(formData.get('granted_days') ?? 1)
  const reason = String(formData.get('reason') ?? '').trim() || null
  const expiryDays = Number(formData.get('expiry_days') ?? DEFAULT_EXPIRY_DAYS)

  if (!employeeId) return { error: 'Missing employee_id' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) return { error: 'Invalid work date' }
  if (!(days > 0 && days <= 2)) return { error: 'Granted days must be > 0 and ≤ 2' }
  if (!(expiryDays > 0 && expiryDays <= 365)) return { error: 'Expiry days must be 1–365' }

  const expiresOn = addDaysIso(workDate, expiryDays)

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('comp_off_grants')
    .insert({
      employee_id: employeeId,
      work_date: workDate,
      granted_days: days,
      reason,
      expires_on: expiresOn,
      granted_by: session.userId,
      status: 'active',
    })
    .select('id')
    .single()
  if (error) return { error: error.message }

  await recomputeCompOffBalance(admin, employeeId)

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'comp_off.grant',
    entity_type: 'comp_off_grant',
    entity_id: data.id,
    summary: `Granted ${days}d comp off for work on ${workDate} (expires ${expiresOn})`,
  })

  await createNotification({
    employeeId,
    kind: 'comp_off.granted',
    title: `Comp Off granted — ${days}d`,
    body: `For work on ${workDate}. Use before ${expiresOn} or it expires.`,
    href: '/me/comp-off',
    severity: 'success',
  })

  revalidatePath('/leave/balances')
  revalidatePath(`/employees/${employeeId}`)
  revalidatePath('/me/leave')
  return { ok: true, id: data.id as string }
}

// -----------------------------------------------------------------------------
// revokeCompOff — HR revokes an unused grant
// -----------------------------------------------------------------------------
export async function revokeCompOffAction(
  formData: FormData,
): Promise<{ ok?: true; error?: string }> {
  const session = await verifySession()
  await requireRole('admin', 'hr', 'payroll')

  const id = String(formData.get('id') ?? '')
  const notes = String(formData.get('notes') ?? '').trim() || 'Revoked by HR'
  if (!id) return { error: 'Missing id' }

  const admin = createAdminClient()
  const { data: grant } = await admin
    .from('comp_off_grants')
    .select('employee_id, status')
    .eq('id', id)
    .maybeSingle()
  if (!grant) return { error: 'Grant not found' }
  if (grant.status !== 'active') return { error: `Grant is ${grant.status}; cannot revoke.` }

  await admin
    .from('comp_off_grants')
    .update({ status: 'revoked', closed_at: new Date().toISOString(), closed_reason: notes })
    .eq('id', id)

  await recomputeCompOffBalance(admin, grant.employee_id as string)

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'comp_off.revoke',
    entity_type: 'comp_off_grant',
    entity_id: id,
    summary: `Revoked comp off — ${notes}`,
  })

  revalidatePath('/leave/balances')
  revalidatePath(`/employees/${grant.employee_id}`)
  revalidatePath('/me/comp-off')
  return { ok: true }
}

// -----------------------------------------------------------------------------
// expireAllCompOff — sweep every past-expiry 'active' grant to 'expired'.
// Also recompute every affected employee's COMP_OFF balance.
// Idempotent; can be scheduled or run manually.
// -----------------------------------------------------------------------------
export async function expireAllCompOffAction(): Promise<{ ok?: true; error?: string; expired?: number }> {
  const session = await verifySession()
  await requireRole('admin', 'hr', 'payroll')

  const admin = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)

  const { data: due } = await admin
    .from('comp_off_grants')
    .select('id, employee_id')
    .eq('status', 'active')
    .lt('expires_on', today)

  if (!due || due.length === 0) return { ok: true, expired: 0 }

  await admin
    .from('comp_off_grants')
    .update({
      status: 'expired',
      closed_at: new Date().toISOString(),
      closed_reason: 'auto-expired sweep',
    })
    .eq('status', 'active')
    .lt('expires_on', today)

  const uniqueEmps = Array.from(new Set(due.map((d) => d.employee_id as string)))
  for (const empId of uniqueEmps) {
    await recomputeCompOffBalance(admin, empId)
  }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'comp_off.expire_sweep',
    entity_type: 'comp_off_grants',
    entity_id: today,
    summary: `Expired ${due.length} comp off grant(s)`,
  })

  revalidatePath('/leave/balances')
  return { ok: true, expired: due.length }
}

// -----------------------------------------------------------------------------
// Request/approval flow
// -----------------------------------------------------------------------------
// Employee raises a `comp_off_requests` row (submitted). HR approves → we
// materialise a `comp_off_grants` row with `expires_on = work_date + 30` days.
// The 30-day clock starts at the work_date, not the approval date, so late
// approvals don't extend the window.
// -----------------------------------------------------------------------------

export async function submitCompOffRequestAction(
  formData: FormData,
): Promise<{ ok?: true; error?: string; id?: string }> {
  const session = await verifySession()
  const { employeeId } = await getCurrentEmployee()

  const workDate = String(formData.get('work_date') ?? '')
  const days = Number(formData.get('days_requested') ?? 1)
  const reason = String(formData.get('reason') ?? '').trim() || null

  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) return { error: 'Invalid work date' }
  const today = new Date().toISOString().slice(0, 10)
  if (workDate > today) return { error: 'Work date cannot be in the future' }
  if (!(days > 0 && days <= 2)) return { error: 'Days must be between 0.5 and 2' }

  const expiresOn = addDaysIso(workDate, DEFAULT_EXPIRY_DAYS)
  if (expiresOn < today) {
    return { error: `That work date is already past the 30-day window (would expire ${expiresOn}).` }
  }

  const admin = createAdminClient()

  // Duplicate guard: can't have two open requests for the same work_date.
  const { data: dupe } = await admin
    .from('comp_off_requests')
    .select('id')
    .eq('employee_id', employeeId)
    .eq('work_date', workDate)
    .in('status', ['submitted', 'approved'])
    .maybeSingle()
  if (dupe) return { error: 'A comp off request for this work date already exists.' }

  const { data, error } = await admin
    .from('comp_off_requests')
    .insert({
      employee_id: employeeId,
      work_date: workDate,
      days_requested: days,
      reason,
      status: 'submitted',
    })
    .select('id')
    .single()
  if (error) return { error: error.message }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'comp_off.request',
    entity_type: 'comp_off_request',
    entity_id: data.id,
    summary: `Requested ${days}d comp off for ${workDate}`,
  })

  revalidatePath('/me/comp-off')
  revalidatePath('/comp-off')
  return { ok: true, id: data.id as string }
}

export async function cancelCompOffRequestAction(
  formData: FormData,
): Promise<{ ok?: true; error?: string }> {
  const session = await verifySession()
  const { employeeId } = await getCurrentEmployee()

  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'Missing id' }

  const admin = createAdminClient()
  const { data: req } = await admin
    .from('comp_off_requests')
    .select('employee_id, status')
    .eq('id', id)
    .maybeSingle()
  if (!req) return { error: 'Request not found' }
  if (req.employee_id !== employeeId) return { error: 'You can only cancel your own requests' }
  if (req.status !== 'submitted') return { error: `Request is ${req.status}; cannot cancel.` }

  await admin
    .from('comp_off_requests')
    .update({ status: 'cancelled', decided_at: new Date().toISOString(), decided_by: session.userId })
    .eq('id', id)

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'comp_off.cancel',
    entity_type: 'comp_off_request',
    entity_id: id,
    summary: 'Employee cancelled their comp off request',
  })

  revalidatePath('/me/comp-off')
  revalidatePath('/comp-off')
  return { ok: true }
}

export async function approveCompOffRequestAction(
  formData: FormData,
): Promise<{ ok?: true; error?: string }> {
  const session = await verifySession()
  await requireRole('admin', 'hr', 'payroll')

  const id = String(formData.get('id') ?? '')
  const note = String(formData.get('note') ?? '').trim() || null
  if (!id) return { error: 'Missing id' }

  const admin = createAdminClient()
  const { data: req } = await admin
    .from('comp_off_requests')
    .select('id, employee_id, work_date, days_requested, reason, status')
    .eq('id', id)
    .maybeSingle()
  if (!req) return { error: 'Request not found' }
  if (req.status !== 'submitted') return { error: `Request is ${req.status}; cannot approve.` }

  const workDate = req.work_date as string
  const expiresOn = addDaysIso(workDate, DEFAULT_EXPIRY_DAYS)

  // Create the grant (anchored on work_date, not today).
  const { data: grant, error: grantErr } = await admin
    .from('comp_off_grants')
    .insert({
      employee_id: req.employee_id,
      work_date: workDate,
      granted_days: req.days_requested,
      reason: req.reason,
      expires_on: expiresOn,
      granted_by: session.userId,
      status: 'active',
      request_id: id,
    })
    .select('id')
    .single()
  if (grantErr) return { error: grantErr.message }

  await admin
    .from('comp_off_requests')
    .update({
      status: 'approved',
      decided_at: new Date().toISOString(),
      decided_by: session.userId,
      decision_note: note,
      grant_id: grant.id,
    })
    .eq('id', id)

  await recomputeCompOffBalance(admin, req.employee_id as string)

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'comp_off.approve',
    entity_type: 'comp_off_request',
    entity_id: id,
    summary: `Approved ${req.days_requested}d comp off for ${workDate} (expires ${expiresOn})`,
  })

  await createNotification({
    employeeId: req.employee_id as string,
    kind: 'comp_off.approved',
    title: `Comp Off approved — ${req.days_requested}d`,
    body: `For work on ${workDate}. Use by ${expiresOn} or it expires.`,
    href: '/me/comp-off',
    severity: 'success',
  })

  revalidatePath('/leave/balances')
  revalidatePath('/comp-off')
  revalidatePath('/me/comp-off')
  return { ok: true }
}

export async function rejectCompOffRequestAction(
  formData: FormData,
): Promise<{ ok?: true; error?: string }> {
  const session = await verifySession()
  await requireRole('admin', 'hr', 'payroll')

  const id = String(formData.get('id') ?? '')
  const note = String(formData.get('note') ?? '').trim() || 'Rejected'
  if (!id) return { error: 'Missing id' }

  const admin = createAdminClient()
  const { data: req } = await admin
    .from('comp_off_requests')
    .select('employee_id, work_date, days_requested, status')
    .eq('id', id)
    .maybeSingle()
  if (!req) return { error: 'Request not found' }
  if (req.status !== 'submitted') return { error: `Request is ${req.status}; cannot reject.` }

  await admin
    .from('comp_off_requests')
    .update({
      status: 'rejected',
      decided_at: new Date().toISOString(),
      decided_by: session.userId,
      decision_note: note,
    })
    .eq('id', id)

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'comp_off.reject',
    entity_type: 'comp_off_request',
    entity_id: id,
    summary: `Rejected comp off for ${req.work_date}: ${note}`,
  })

  await createNotification({
    employeeId: req.employee_id as string,
    kind: 'comp_off.rejected',
    title: 'Comp Off rejected',
    body: `Your comp off request for ${req.work_date} was rejected. ${note}`,
    href: '/me/comp-off',
    severity: 'warn',
  })

  revalidatePath('/comp-off')
  revalidatePath('/me/comp-off')
  return { ok: true }
}
