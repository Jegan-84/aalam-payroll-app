'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole, verifySession } from '@/lib/auth/dal'
import {
  CreateUserSchema,
  ResetPasswordSchema,
  UpdateUserSchema,
  computeRoleDiff,
  type CreateUserState,
  type ResetPasswordState,
  type UpdateUserState,
} from '@/lib/users/schemas'

function formToObject(fd: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {}
  for (const [k, v] of fd.entries()) {
    if (k in obj) {
      const cur = obj[k]
      obj[k] = Array.isArray(cur) ? [...cur, v] : [cur, v]
    } else {
      obj[k] = v
    }
  }
  // Also pull all values for 'roles' in case only one was set (.entries() iterates them all)
  const roles = fd.getAll('roles')
  if (roles.length > 0) obj.roles = roles
  return obj
}

async function syncRoles(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  currentRoleCodes: string[],
  desiredRoleCodes: string[],
  grantedBy: string,
) {
  const { toAdd, toRemove } = computeRoleDiff(currentRoleCodes, desiredRoleCodes)
  if (toAdd.length === 0 && toRemove.length === 0) return

  const { data: roles } = await admin.from('roles').select('id, code').in('code', [...toAdd, ...toRemove])
  const byCode = new Map((roles ?? []).map((r) => [r.code as string, r.id as number]))

  if (toRemove.length > 0) {
    const idsToRemove = toRemove.map((c) => byCode.get(c)).filter((n): n is number => typeof n === 'number')
    if (idsToRemove.length > 0) {
      await admin.from('user_roles').delete().eq('user_id', userId).in('role_id', idsToRemove)
    }
  }
  if (toAdd.length > 0) {
    const rows = toAdd
      .map((c) => byCode.get(c))
      .filter((n): n is number => typeof n === 'number')
      .map((role_id) => ({ user_id: userId, role_id, granted_by: grantedBy }))
    if (rows.length > 0) {
      await admin.from('user_roles').upsert(rows, { onConflict: 'user_id,role_id', ignoreDuplicates: true })
    }
  }
}

// -----------------------------------------------------------------------------
// create
// -----------------------------------------------------------------------------
export async function createUserAction(
  _prev: CreateUserState,
  formData: FormData,
): Promise<CreateUserState> {
  const session = await requireRole('admin')
  const parsed = CreateUserSchema.safeParse(formToObject(formData))
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as CreateUserState extends infer T ? (T extends { errors?: infer E } ? E : never) : never }
  }
  const input = parsed.data
  const admin = createAdminClient()

  // Create the auth user; our trigger mirrors to public.users.
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,     // no email flow configured — mark confirmed so user can log in immediately
    user_metadata: { full_name: input.full_name },
  })
  if (createErr || !created.user) {
    return { errors: { _form: [createErr?.message ?? 'Failed to create user'] } }
  }
  const newId = created.user.id

  // Ensure public.users has the full_name (trigger uses metadata but we update to be safe).
  await admin.from('users').update({ full_name: input.full_name }).eq('id', newId)

  // Assign roles
  await syncRoles(admin, newId, [], input.roles, session.userId)

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'user.create',
    entity_type: 'user',
    entity_id: newId,
    summary: `Created user ${input.email} with roles: ${input.roles.join(', ') || 'none'}`,
  })

  revalidatePath('/users')
  redirect(`/users/${newId}`)
}

// -----------------------------------------------------------------------------
// update profile + roles + active flag
// -----------------------------------------------------------------------------
export async function updateUserAction(
  _prev: UpdateUserState,
  formData: FormData,
): Promise<UpdateUserState> {
  const session = await requireRole('admin')
  const parsed = UpdateUserSchema.safeParse(formToObject(formData))
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as UpdateUserState extends infer T ? (T extends { errors?: infer E } ? E : never) : never }
  }
  const input = parsed.data
  const admin = createAdminClient()

  // Fetch current roles for diff
  const { data: currentJunctions } = await admin
    .from('user_roles')
    .select('role:roles!inner ( code )')
    .eq('user_id', input.id)
  type J = { role: { code: string } | { code: string }[] | null }
  const currentCodes = ((currentJunctions ?? []) as unknown as J[])
    .map((j) => (Array.isArray(j.role) ? j.role[0]?.code : j.role?.code))
    .filter((c): c is string => Boolean(c))

  // Update the profile
  const { error: upErr } = await admin
    .from('users')
    .update({ full_name: input.full_name, is_active: input.is_active })
    .eq('id', input.id)
  if (upErr) return { errors: { _form: [upErr.message] } }

  // Ban the Supabase auth user if deactivated; unban if reactivated.
  try {
    await admin.auth.admin.updateUserById(input.id, {
      ban_duration: input.is_active ? 'none' : '876600h',  // ~100y
    })
  } catch (err) {
    return { errors: { _form: [(err as Error).message] } }
  }

  await syncRoles(admin, input.id, currentCodes, input.roles, session.userId)

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'user.update',
    entity_type: 'user',
    entity_id: input.id,
    summary: `Updated user (active=${input.is_active}) roles: ${input.roles.join(', ') || 'none'}`,
  })

  revalidatePath('/users')
  revalidatePath(`/users/${input.id}`)
  return { ok: true }
}

// -----------------------------------------------------------------------------
// reset password
// -----------------------------------------------------------------------------
export async function resetPasswordAction(
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const session = await requireRole('admin')
  const parsed = ResetPasswordSchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as ResetPasswordState extends infer T ? (T extends { errors?: infer E } ? E : never) : never }
  }
  const admin = createAdminClient()
  const { error } = await admin.auth.admin.updateUserById(parsed.data.id, { password: parsed.data.password })
  if (error) return { errors: { _form: [error.message] } }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'user.reset_password',
    entity_type: 'user',
    entity_id: parsed.data.id,
    summary: 'Admin reset user password',
  })

  revalidatePath(`/users/${parsed.data.id}`)
  return { ok: true }
}

// -----------------------------------------------------------------------------
// delete (hard) — rarely used; prefer deactivate
// -----------------------------------------------------------------------------
export async function deleteUserAction(formData: FormData): Promise<void> {
  const session = await requireRole('admin')
  const id = String(formData.get('id') ?? '')
  if (!id) return
  if (id === session.userId) return   // never self-delete

  const admin = createAdminClient()
  // Cascade: user_roles FK deletes on user delete; business tables use SET NULL.
  await admin.auth.admin.deleteUser(id)
  // public.users row stays (auth.users delete doesn't cascade to public.users automatically);
  // we deactivate the mirror so references (created_by / updated_by audit) stay intact.
  await admin.from('users').update({ is_active: false }).eq('id', id)

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'user.delete',
    entity_type: 'user',
    entity_id: id,
    summary: 'Deleted auth user and deactivated profile',
  })

  revalidatePath('/users')
  redirect('/users')
}

// Local helper to satisfy import without breaking tree-shake
void verifySession
