'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifySession } from '@/lib/auth/dal'
import { DeclarationSchema, type DeclarationFormErrors, type DeclarationFormState } from '@/lib/tax/schemas'

async function upsertDeclaration(
  formData: FormData,
  nextStatus: 'draft' | 'submitted',
): Promise<DeclarationFormState> {
  const session = await verifySession()
  const parsed = DeclarationSchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as DeclarationFormErrors }
  }

  const input = parsed.data
  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('employee_tax_declarations')
    .select('id, status')
    .eq('employee_id', input.employee_id)
    .eq('fy_start', input.fy_start)
    .maybeSingle()

  if (existing && existing.status === 'approved') {
    return { errors: { _form: ['This declaration is already approved. Ask HR to reopen it before editing.'] } }
  }

  const row = {
    ...input,
    status: nextStatus,
    submitted_at: nextStatus === 'submitted' ? new Date().toISOString() : null,
    submitted_by: nextStatus === 'submitted' ? session.userId : null,
  }

  if (existing) {
    const { error } = await admin.from('employee_tax_declarations').update(row).eq('id', existing.id)
    if (error) return { errors: { _form: [error.message] } }
  } else {
    const { error } = await admin.from('employee_tax_declarations').insert(row)
    if (error) return { errors: { _form: [error.message] } }
  }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: nextStatus === 'submitted' ? 'declaration.submit' : 'declaration.save',
    entity_type: 'employee_tax_declaration',
    entity_id: input.employee_id,
    summary: `${nextStatus === 'submitted' ? 'Submitted' : 'Saved'} declaration FY ${input.fy_start}`,
  })

  revalidatePath(`/employees/${input.employee_id}/declaration`)
  revalidatePath('/declarations')
  return { ok: true }
}

export async function saveDraftDeclarationAction(_prev: DeclarationFormState, formData: FormData) {
  return upsertDeclaration(formData, 'draft')
}

export async function submitDeclarationAction(_prev: DeclarationFormState, formData: FormData) {
  const res = await upsertDeclaration(formData, 'submitted')
  if (res?.ok) {
    const { notifyByRoles } = await import('@/lib/notifications/service')
    await notifyByRoles(['admin', 'hr', 'payroll'], {
      kind: 'declaration.submitted',
      title: 'Tax declaration submitted',
      body: 'An employee has submitted their tax declaration for review.',
      href: '/declarations',
      severity: 'info',
    })
  }
  return res
}

export async function approveDeclarationAction(formData: FormData) {
  const session = await verifySession()
  const id = String(formData.get('id') ?? '')
  const notes = (formData.get('notes') as string | null) ?? null
  if (!id) return

  const admin = createAdminClient()
  const { data: decl } = await admin
    .from('employee_tax_declarations')
    .select('employee_id, fy_start')
    .eq('id', id)
    .maybeSingle()

  await admin
    .from('employee_tax_declarations')
    .update({ status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: session.userId, review_notes: notes })
    .eq('id', id)

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'declaration.approve',
    entity_type: 'employee_tax_declaration',
    entity_id: id,
    summary: 'Approved tax declaration',
  })

  if (decl) {
    const { createNotification } = await import('@/lib/notifications/service')
    await createNotification({
      employeeId: decl.employee_id as string,
      kind: 'declaration.reviewed',
      title: 'Tax declaration approved',
      body: 'Your tax declaration has been approved and will apply to your TDS calculation.',
      href: '/me/declaration',
      severity: 'success',
    })
  }

  revalidatePath('/declarations')
}

export async function rejectDeclarationAction(formData: FormData) {
  const session = await verifySession()
  const id = String(formData.get('id') ?? '')
  const notes = (formData.get('notes') as string | null) ?? null
  if (!id) return

  const admin = createAdminClient()
  const { data: decl } = await admin
    .from('employee_tax_declarations')
    .select('employee_id')
    .eq('id', id)
    .maybeSingle()

  await admin
    .from('employee_tax_declarations')
    .update({ status: 'rejected', reviewed_at: new Date().toISOString(), reviewed_by: session.userId, review_notes: notes })
    .eq('id', id)

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'declaration.reject',
    entity_type: 'employee_tax_declaration',
    entity_id: id,
    summary: 'Rejected tax declaration',
  })

  if (decl) {
    const { createNotification } = await import('@/lib/notifications/service')
    await createNotification({
      employeeId: decl.employee_id as string,
      kind: 'declaration.reviewed',
      title: 'Tax declaration rejected',
      body: notes ?? 'Your declaration needs changes — please review and resubmit.',
      href: '/me/declaration',
      severity: 'warn',
    })
  }

  revalidatePath('/declarations')
}
