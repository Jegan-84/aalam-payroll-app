'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifySession, requireRole } from '@/lib/auth/dal'
import { applyConfigChange, PATHS_TO_REVALIDATE } from './appliers'

// =============================================================================
// Two-level approval gate for sensitive config changes.
// =============================================================================
//   Maker  (HR / payroll): submitConfigChange()
//   Checker (admin):       approveConfigChange() / rejectConfigChange()
//
// On approval, we run the matching applier from ./appliers.ts. If the applier
// throws, the pending row stays in 'submitted' so the admin can retry.
// =============================================================================

export type SubmitInput = {
  target_table:
    | 'statutory_config'
    | 'tax_slabs'
    | 'tax_config'
    | 'tax_surcharge_slabs'
    | 'tax_clone_fy'
    | 'pt_slabs'
  action: string
  /** PK / composite key descriptor for the target row, when relevant. */
  target_id?: string | null
  payload: Record<string, unknown>
  description: string
}

export async function submitConfigChange(
  input: SubmitInput,
): Promise<{ ok?: true; error?: string; id?: string }> {
  const session = await verifySession()
  // Maker: HR or payroll. Admin can submit too (and self-approve).
  await requireRole('admin', 'hr', 'payroll')

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('config_pending_changes')
    .insert({
      target_table: input.target_table,
      action: input.action,
      target_id: input.target_id ?? null,
      payload: input.payload,
      description: input.description,
      status: 'submitted',
      submitted_by: session.userId,
    })
    .select('id')
    .single()
  if (error) return { error: error.message }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'config.submit',
    entity_type: 'config_pending_change',
    entity_id: data.id,
    summary: `Submitted ${input.target_table}:${input.action} for admin approval — ${input.description}`,
    after_state: input.payload,
  })

  // Notify admins.
  const { notifyByRoles } = await import('@/lib/notifications/service')
  await notifyByRoles(['admin'], {
    kind: 'config.submitted',
    title: `Config change pending — ${input.target_table}`,
    body: input.description,
    href: '/settings/approvals',
    severity: 'info',
  })

  revalidatePath('/settings/approvals')
  return { ok: true, id: data.id as string }
}

export async function approveConfigChangeAction(
  formData: FormData,
): Promise<{ ok?: true; error?: string }> {
  const session = await verifySession()
  await requireRole('admin')   // checker = admin only

  const id = String(formData.get('id') ?? '')
  const note = String(formData.get('note') ?? '').trim() || null
  if (!id) return { error: 'Missing id' }

  const admin = createAdminClient()
  const { data: row } = await admin
    .from('config_pending_changes')
    .select('id, target_table, action, payload, status, submitted_by, description')
    .eq('id', id)
    .maybeSingle()
  if (!row) return { error: 'Pending change not found' }
  if (row.status !== 'submitted') return { error: `Change is ${row.status}; cannot approve.` }

  // Self-approve guard: an admin who is also the maker shouldn't be able to
  // both submit and approve their own change. Two-level means two people.
  if (row.submitted_by === session.userId) {
    return { error: 'Two-level approval: the approver must be different from the maker.' }
  }

  // Apply the payload. If it throws, the pending row stays as 'submitted'
  // so the admin can fix the underlying data and retry.
  try {
    await applyConfigChange(
      admin,
      row.target_table as string,
      row.action as string,
      row.payload as Record<string, unknown>,
    )
  } catch (err) {
    return { error: (err as Error).message }
  }

  await admin
    .from('config_pending_changes')
    .update({
      status: 'approved',
      decided_by: session.userId,
      decided_at: new Date().toISOString(),
      decision_note: note,
    })
    .eq('id', id)
    .eq('status', 'submitted')

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'config.approve',
    entity_type: 'config_pending_change',
    entity_id: id,
    summary: `Approved ${row.target_table}:${row.action} — ${row.description}`,
    after_state: { note },
  })

  // Notify the maker.
  if (row.submitted_by) {
    const { createNotification } = await import('@/lib/notifications/service')
    await createNotification({
      userId: row.submitted_by as string,
      kind: 'config.approved',
      title: `Config change approved — ${row.target_table}`,
      body: row.description ?? 'Approved by admin.',
      href: '/settings/approvals',
      severity: 'success',
    })
  }

  // Revalidate every path that the underlying config affects.
  const key = `${row.target_table}:${row.action}`
  for (const p of PATHS_TO_REVALIDATE[key] ?? []) revalidatePath(p)
  revalidatePath('/settings/approvals')
  return { ok: true }
}

export async function rejectConfigChangeAction(
  formData: FormData,
): Promise<{ ok?: true; error?: string }> {
  const session = await verifySession()
  await requireRole('admin')

  const id = String(formData.get('id') ?? '')
  const note = String(formData.get('note') ?? '').trim() || 'Rejected'
  if (!id) return { error: 'Missing id' }

  const admin = createAdminClient()
  const { data: row } = await admin
    .from('config_pending_changes')
    .select('status, target_table, description, submitted_by')
    .eq('id', id)
    .maybeSingle()
  if (!row) return { error: 'Pending change not found' }
  if (row.status !== 'submitted') return { error: `Change is ${row.status}; cannot reject.` }

  await admin
    .from('config_pending_changes')
    .update({
      status: 'rejected',
      decided_by: session.userId,
      decided_at: new Date().toISOString(),
      decision_note: note,
    })
    .eq('id', id)
    .eq('status', 'submitted')

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'config.reject',
    entity_type: 'config_pending_change',
    entity_id: id,
    summary: `Rejected ${row.target_table} change: ${note}`,
  })

  if (row.submitted_by) {
    const { createNotification } = await import('@/lib/notifications/service')
    await createNotification({
      userId: row.submitted_by as string,
      kind: 'config.rejected',
      title: `Config change rejected — ${row.target_table}`,
      body: row.description ? `${row.description} — ${note}` : note,
      href: '/settings/approvals',
      severity: 'warn',
    })
  }

  revalidatePath('/settings/approvals')
  return { ok: true }
}
