import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Data Access Layer — the single place we verify the session.
 * Cached per React render so the check is cheap to call multiple times
 * within the same request (layout + page + leaf components).
 */
export const verifySession = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return { userId: user.id, email: user.email ?? '' }
})

/**
 * Like verifySession but returns null instead of redirecting.
 * Use in components where you want to branch without forcing a redirect.
 */
export const getOptionalSession = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return { userId: user.id, email: user.email ?? '' }
})

/**
 * Throws a redirect to /dashboard if the caller doesn't have any of `roles`.
 * Use as the first line of pages/actions that require elevated access.
 */
export async function requireRole(...roles: string[]) {
  const me = await getUserWithRoles()
  const ok = roles.some((r) => me.roles.includes(r))
  if (!ok) redirect('/dashboard')
  return me
}

/**
 * Gate for the admin app (every page under `app/(app)/…`). Requires at least
 * one of the elevated roles. Employee-only users are bounced to `/me`.
 * Users with no roles at all are signed out via `/login` — surfaces a
 * mis-configuration instead of silently looping between /me and /dashboard.
 */
export async function requireAppAccess() {
  const me = await getUserWithRoles()
  const isAdminish = me.roles.some((r) => r === 'admin' || r === 'hr' || r === 'payroll')
  if (isAdminish) return me
  if (me.roles.includes('employee')) redirect('/me')
  redirect('/login')
}

/**
 * Per-section gate. Use at the top of each `app/(app)/<section>/layout.tsx`
 * to narrow access beyond the broad admin/hr/payroll gate. A user without any
 * of the listed roles is redirected to /dashboard (shared landing).
 */
export async function requireRouteRoles(...roles: Array<'admin' | 'hr' | 'payroll'>) {
  const me = await getUserWithRoles()
  const ok = roles.some((r) => me.roles.includes(r))
  if (!ok) redirect('/dashboard')
  return me
}

/**
 * Resolve the employee record linked to the current session.
 * Tries `employees.user_id` first, falls back to joining on `work_email`.
 * Redirects to /dashboard if the caller has no employee record (admin-only user).
 */
export const getCurrentEmployee = cache(
  async (): Promise<{ employeeId: string; userId: string; email: string }> => {
    const found = await findCurrentEmployee()
    if (found) return found
    redirect('/dashboard')
  },
)

/**
 * Like getCurrentEmployee but returns null instead of redirecting. Use this
 * from pages that admin-only users can also reach (e.g. /dashboard) where you
 * want to optionally surface employee-scoped widgets.
 */
export const findCurrentEmployee = cache(
  async (): Promise<{ employeeId: string; userId: string; email: string } | null> => {
    const session = await verifySession()
    const supabase = await createClient()

    const { data: byId } = await supabase
      .from('employees')
      .select('id')
      .eq('user_id', session.userId)
      .maybeSingle()
    if (byId?.id) return { employeeId: byId.id as string, userId: session.userId, email: session.email }

    const { data: byEmail } = await supabase
      .from('employees')
      .select('id')
      .eq('work_email', session.email)
      .maybeSingle()
    if (byEmail?.id) return { employeeId: byEmail.id as string, userId: session.userId, email: session.email }

    return null
  },
)

/**
 * Gate: allow if caller is admin/HR/payroll OR if the given `employeeId` is
 * the caller's own employee record. Used by PDF endpoints so employees can
 * fetch their own payslips, F&F statements, Form 16/12BA/12BB — and nothing else.
 */
export async function requireAdminOrOwnEmployee(employeeId: string): Promise<void> {
  const me = await getUserWithRoles()
  const isAdminish = me.roles.some((r) => r === 'admin' || r === 'hr' || r === 'payroll')
  if (isAdminish) return

  const supabase = await createClient()
  const { data: byId } = await supabase
    .from('employees')
    .select('id')
    .eq('id', employeeId)
    .eq('user_id', me.userId)
    .maybeSingle()
  if (byId?.id) return

  const { data: byEmail } = await supabase
    .from('employees')
    .select('id')
    .eq('id', employeeId)
    .eq('work_email', me.email)
    .maybeSingle()
  if (byEmail?.id) return

  redirect('/dashboard')
}

export const getUserWithRoles = cache(async () => {
  const session = await verifySession()
  const supabase = await createClient()

  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from('users').select('id, email, full_name, is_active').eq('id', session.userId).maybeSingle(),
    supabase.from('user_roles').select('roles ( code, name )').eq('user_id', session.userId),
  ])

  type RoleRow = { roles: { code: string; name: string } | { code: string; name: string }[] | null }
  const roleCodes = ((roles ?? []) as unknown as RoleRow[])
    .flatMap((r) => (Array.isArray(r.roles) ? r.roles : r.roles ? [r.roles] : []))
    .map((r) => r.code)

  return {
    userId: session.userId,
    email: profile?.email ?? session.email,
    fullName: profile?.full_name ?? null,
    isActive: profile?.is_active ?? true,
    roles: roleCodes,
  }
})
