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
