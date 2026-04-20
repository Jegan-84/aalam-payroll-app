import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/auth/dal'

export type EmployeeListFilters = {
  q?: string
  department_id?: number
  status?: string
  page?: number
  pageSize?: number
}

export type EmployeeListRow = {
  id: string
  employee_code: string
  full_name_snapshot: string
  work_email: string
  employment_status: string
  date_of_joining: string
  department: { code: string; name: string } | null
  designation: { code: string; name: string } | null
  location: { code: string; name: string } | null
}

export async function listEmployees(filters: EmployeeListFilters = {}) {
  await verifySession()
  const supabase = await createClient()

  const page = Math.max(1, filters.page ?? 1)
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 25))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('employees')
    .select(
      `
      id, employee_code, full_name_snapshot, work_email, employment_status, date_of_joining,
      department:departments ( code, name ),
      designation:designations ( code, name ),
      location:locations ( code, name )
    `,
      { count: 'exact' },
    )
    .order('date_of_joining', { ascending: false })
    .range(from, to)

  if (filters.q && filters.q.trim()) {
    const q = filters.q.trim()
    query = query.or(
      `employee_code.ilike.%${q}%,work_email.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`,
    )
  }
  if (filters.department_id) query = query.eq('department_id', filters.department_id)
  if (filters.status) query = query.eq('employment_status', filters.status)

  const { data, count, error } = await query
  if (error) throw new Error(error.message)

  const rows = (data ?? []).map((r) => {
    const pick = <T extends { code: string; name: string }>(v: T | T[] | null): T | null =>
      Array.isArray(v) ? v[0] ?? null : v
    return {
      ...r,
      department:  pick(r.department as unknown as { code: string; name: string } | { code: string; name: string }[] | null),
      designation: pick(r.designation as unknown as { code: string; name: string } | { code: string; name: string }[] | null),
      location:    pick(r.location as unknown as { code: string; name: string } | { code: string; name: string }[] | null),
    }
  }) as EmployeeListRow[]

  return {
    rows,
    total: count ?? 0,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
  }
}

export const getEmployee = cache(async (id: string) => {
  await verifySession()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
})

export const getMasterOptions = cache(async () => {
  await verifySession()
  const supabase = await createClient()

  const [deps, desigs, locs, managers, companies] = await Promise.all([
    supabase.from('departments').select('id, code, name').eq('is_active', true).order('name'),
    supabase.from('designations').select('id, code, name').eq('is_active', true).order('name'),
    supabase.from('locations').select('id, code, name').eq('is_active', true).order('name'),
    supabase
      .from('employees')
      .select('id, employee_code, full_name_snapshot')
      .eq('employment_status', 'active')
      .order('full_name_snapshot'),
    supabase
      .from('companies')
      .select('id, code, legal_name, display_name')
      .eq('is_active', true)
      .order('display_order'),
  ])

  return {
    departments:  deps.data ?? [],
    designations: desigs.data ?? [],
    locations:    locs.data ?? [],
    managers:     managers.data ?? [],
    companies:    companies.data ?? [],
  }
})
