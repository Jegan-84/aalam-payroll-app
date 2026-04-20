import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/dal'

export type UserRow = {
  id: string
  email: string
  full_name: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  roles: { code: string; name: string }[]
}

export async function listUsers(opts?: {
  page?: number
  pageSize?: number
}): Promise<{ rows: UserRow[]; total: number; page: number; totalPages: number }> {
  await requireRole('admin')
  const supabase = await createClient()

  const pageSize = Math.max(1, Math.min(100, opts?.pageSize ?? 50))
  const page = Math.max(1, opts?.page ?? 1)
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const usersQ = supabase
    .from('users')
    .select('id, email, full_name, is_active, created_at, updated_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  const [{ data: users, count, error }, { data: junctions }] = await Promise.all([
    usersQ,
    supabase.from('user_roles').select('user_id, role:roles!inner ( code, name )'),
  ])
  if (error) throw new Error(error.message)

  type RoleEmbed = { code: string; name: string }
  type JunctionRow = { user_id: string; role: RoleEmbed | RoleEmbed[] | null }
  const rolesByUser = new Map<string, { code: string; name: string }[]>()
  for (const j of (junctions ?? []) as unknown as JunctionRow[]) {
    const r = Array.isArray(j.role) ? j.role[0] : j.role
    if (!r) continue
    const arr = rolesByUser.get(j.user_id) ?? []
    arr.push({ code: r.code, name: r.name })
    rolesByUser.set(j.user_id, arr)
  }

  const rows = (users ?? []).map((u) => ({
    id: u.id as string,
    email: u.email as string,
    full_name: (u.full_name as string | null) ?? null,
    is_active: Boolean(u.is_active),
    created_at: u.created_at as string,
    updated_at: u.updated_at as string,
    roles: rolesByUser.get(u.id as string) ?? [],
  }))
  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  return { rows, total, page: Math.min(page, totalPages), totalPages }
}

export const getUser = cache(async (id: string): Promise<UserRow | null> => {
  await requireRole('admin')
  const supabase = await createClient()
  const [{ data: user }, { data: junctions }] = await Promise.all([
    supabase.from('users').select('*').eq('id', id).maybeSingle(),
    supabase.from('user_roles').select('role:roles!inner ( code, name )').eq('user_id', id),
  ])
  if (!user) return null
  type RoleEmbed = { code: string; name: string }
  type JunctionRow = { role: RoleEmbed | RoleEmbed[] | null }
  const roles = ((junctions ?? []) as unknown as JunctionRow[])
    .map((j) => (Array.isArray(j.role) ? j.role[0] : j.role))
    .filter((r): r is RoleEmbed => Boolean(r))
  return {
    id: user.id as string,
    email: user.email as string,
    full_name: (user.full_name as string | null) ?? null,
    is_active: Boolean(user.is_active),
    created_at: user.created_at as string,
    updated_at: user.updated_at as string,
    roles,
  }
})

export type AllRolesRow = { id: number; code: string; name: string; description: string | null }

export const listAllRoles = cache(async (): Promise<AllRolesRow[]> => {
  await requireRole('admin')
  const supabase = await createClient()
  const { data } = await supabase.from('roles').select('id, code, name, description').order('id')
  return (data ?? []) as unknown as AllRolesRow[]
})
