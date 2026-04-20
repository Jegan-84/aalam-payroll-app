'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/dal'
import {
  DepartmentSchema,
  DesignationSchema,
  type DepartmentState,
  type DesignationState,
} from '@/lib/masters/schemas'

type Errors<T> = { [K in keyof T]?: string[] } & { _form?: string[] }

// -----------------------------------------------------------------------------
// Departments
// -----------------------------------------------------------------------------
export async function saveDepartmentAction(
  _prev: DepartmentState,
  formData: FormData,
): Promise<DepartmentState> {
  const session = await requireRole('admin', 'hr')
  const parsed = DepartmentSchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as Errors<typeof DepartmentSchema.type> }
  }
  const input = parsed.data
  const admin = createAdminClient()
  const row = { code: input.code.toUpperCase(), name: input.name, is_active: input.is_active }

  if (input.id) {
    const { error } = await admin.from('departments').update(row).eq('id', input.id)
    if (error) return { errors: { _form: [error.message] } }
  } else {
    const { error } = await admin.from('departments').insert(row)
    if (error) return { errors: { _form: [error.message] } }
  }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: input.id ? 'department.update' : 'department.create',
    entity_type: 'department',
    entity_id: String(input.id ?? row.code),
    summary: `${input.id ? 'Updated' : 'Created'} department ${row.code} — ${row.name}`,
  })

  revalidatePath('/settings/departments')
  return { ok: true }
}

// -----------------------------------------------------------------------------
// Designations
// -----------------------------------------------------------------------------
export async function saveDesignationAction(
  _prev: DesignationState,
  formData: FormData,
): Promise<DesignationState> {
  const session = await requireRole('admin', 'hr')
  const parsed = DesignationSchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as Errors<typeof DesignationSchema.type> }
  }
  const input = parsed.data
  const admin = createAdminClient()
  const row = {
    code: input.code.toUpperCase(),
    name: input.name,
    grade: input.grade ?? null,
    is_active: input.is_active,
  }

  if (input.id) {
    const { error } = await admin.from('designations').update(row).eq('id', input.id)
    if (error) return { errors: { _form: [error.message] } }
  } else {
    const { error } = await admin.from('designations').insert(row)
    if (error) return { errors: { _form: [error.message] } }
  }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: input.id ? 'designation.update' : 'designation.create',
    entity_type: 'designation',
    entity_id: String(input.id ?? row.code),
    summary: `${input.id ? 'Updated' : 'Created'} designation ${row.code} — ${row.name}`,
  })

  revalidatePath('/settings/designations')
  return { ok: true }
}
