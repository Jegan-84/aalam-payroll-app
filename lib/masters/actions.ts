'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/dal'
import {
  DepartmentSchema,
  DesignationSchema,
  ProjectSchema,
  ActivityTypeSchema,
  type DepartmentState,
  type DesignationState,
  type ProjectState,
  type ActivityTypeState,
} from '@/lib/masters/schemas'

type Errors<T> = { [K in keyof T]?: string[] } & { _form?: string[] }

// -----------------------------------------------------------------------------
// Map a Postgres unique-violation on a master `code` column into a friendly,
// field-scoped error so the form shows it inline instead of the raw constraint
// name. Falls back to a generic _form error.
// -----------------------------------------------------------------------------
type PgError = { message: string; code?: string }
function uniqueCodeError<T extends { code?: string[]; _form?: string[] }>(
  err: PgError,
  attemptedCode: string,
): T {
  const isUnique =
    err.code === '23505' ||
    /duplicate key value/i.test(err.message) ||
    /already exists/i.test(err.message)
  if (isUnique) {
    return { code: [`Code "${attemptedCode}" is already in use. Pick a different one.`] } as T
  }
  return { _form: [err.message] } as T
}

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
  const code = input.code.toUpperCase()

  if (input.id) {
    // Code is locked after creation — only mutable fields are updated.
    const { error } = await admin
      .from('departments')
      .update({ name: input.name, is_active: input.is_active })
      .eq('id', input.id)
    if (error) return { errors: uniqueCodeError(error, code) }
  } else {
    const { error } = await admin
      .from('departments')
      .insert({ code, name: input.name, is_active: input.is_active })
    if (error) return { errors: uniqueCodeError(error, code) }
  }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: input.id ? 'department.update' : 'department.create',
    entity_type: 'department',
    entity_id: String(input.id ?? code),
    summary: `${input.id ? 'Updated' : 'Created'} department ${code} — ${input.name}`,
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
  const code = input.code.toUpperCase()

  if (input.id) {
    const { error } = await admin
      .from('designations')
      .update({ name: input.name, grade: input.grade ?? null, is_active: input.is_active })
      .eq('id', input.id)
    if (error) return { errors: uniqueCodeError(error, code) }
  } else {
    const { error } = await admin
      .from('designations')
      .insert({ code, name: input.name, grade: input.grade ?? null, is_active: input.is_active })
    if (error) return { errors: uniqueCodeError(error, code) }
  }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: input.id ? 'designation.update' : 'designation.create',
    entity_type: 'designation',
    entity_id: String(input.id ?? code),
    summary: `${input.id ? 'Updated' : 'Created'} designation ${code} — ${input.name}`,
  })

  revalidatePath('/settings/designations')
  return { ok: true }
}

// -----------------------------------------------------------------------------
// Projects
// -----------------------------------------------------------------------------
export async function saveProjectAction(
  _prev: ProjectState,
  formData: FormData,
): Promise<ProjectState> {
  const session = await requireRole('admin', 'hr')
  const parsed = ProjectSchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as Errors<typeof ProjectSchema.type> }
  }
  const input = parsed.data
  const admin = createAdminClient()
  const code = input.code.toUpperCase()

  if (input.id) {
    const { error } = await admin
      .from('projects')
      .update({ name: input.name, client: input.client ?? null, is_active: input.is_active })
      .eq('id', input.id)
    if (error) return { errors: uniqueCodeError(error, code) }
  } else {
    const { error } = await admin
      .from('projects')
      .insert({ code, name: input.name, client: input.client ?? null, is_active: input.is_active })
    if (error) return { errors: uniqueCodeError(error, code) }
  }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: input.id ? 'project.update' : 'project.create',
    entity_type: 'project',
    entity_id: String(input.id ?? code),
    summary: `${input.id ? 'Updated' : 'Created'} project ${code} — ${input.name}`,
  })

  revalidatePath('/settings/projects')
  return { ok: true }
}

// -----------------------------------------------------------------------------
// Activity types — used by the timesheet module
// -----------------------------------------------------------------------------
export async function saveActivityTypeAction(
  _prev: ActivityTypeState,
  formData: FormData,
): Promise<ActivityTypeState> {
  const session = await requireRole('admin', 'hr')
  const parsed = ActivityTypeSchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as Errors<typeof ActivityTypeSchema.type> }
  }
  const input = parsed.data
  const admin = createAdminClient()
  const code = input.code.toUpperCase()
  const now = new Date().toISOString()

  if (input.id) {
    const { error } = await admin
      .from('activity_types')
      .update({ name: input.name, is_active: input.is_active, updated_at: now })
      .eq('id', input.id)
    if (error) return { errors: uniqueCodeError(error, code) }
  } else {
    const { error } = await admin
      .from('activity_types')
      .insert({ code, name: input.name, is_active: input.is_active, updated_at: now })
    if (error) return { errors: uniqueCodeError(error, code) }
  }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: input.id ? 'activity_type.update' : 'activity_type.create',
    entity_type: 'activity_type',
    entity_id: String(input.id ?? code),
    summary: `${input.id ? 'Updated' : 'Created'} activity type ${code} — ${input.name}`,
  })

  revalidatePath('/settings/activity-types')
  revalidatePath('/me/timesheet')
  return { ok: true }
}
