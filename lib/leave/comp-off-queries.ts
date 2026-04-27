import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/auth/dal'

export type CompOffGrant = {
  id: string
  employee_id: string
  work_date: string
  granted_days: number
  reason: string | null
  expires_on: string
  status: 'active' | 'used' | 'expired' | 'revoked'
  used_in_leave_id: string | null
  used_at: string | null
  closed_at: string | null
  closed_reason: string | null
  granted_at: string
}

export async function listEmployeeCompOff(
  employeeId: string,
  opts?: { activeOnly?: boolean },
): Promise<CompOffGrant[]> {
  await verifySession()
  const supabase = await createClient()
  let query = supabase
    .from('comp_off_grants')
    .select('*')
    .eq('employee_id', employeeId)
    .order('work_date', { ascending: false })
  if (opts?.activeOnly) query = query.eq('status', 'active')
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as CompOffGrant[]
}

export async function countActiveCompOff(employeeId: string): Promise<number> {
  await verifySession()
  const supabase = await createClient()
  const { data } = await supabase
    .from('comp_off_grants')
    .select('granted_days')
    .eq('employee_id', employeeId)
    .eq('status', 'active')
    .gte('expires_on', new Date().toISOString().slice(0, 10))
  return (data ?? []).reduce((s, r) => s + Number(r.granted_days), 0)
}

export type CompOffRequest = {
  id: string
  employee_id: string
  work_date: string
  days_requested: number
  reason: string | null
  status: 'submitted' | 'approved' | 'rejected' | 'cancelled'
  decided_by: string | null
  decided_at: string | null
  decision_note: string | null
  grant_id: string | null
  created_at: string
}

export type CompOffRequestWithEmployee = CompOffRequest & {
  employee: { id: string; employee_code: string; full_name_snapshot: string }
}

export async function listMyCompOffRequests(employeeId: string): Promise<CompOffRequest[]> {
  await verifySession()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('comp_off_requests')
    .select('*')
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as CompOffRequest[]
}

export async function listPendingCompOffRequests(): Promise<CompOffRequestWithEmployee[]> {
  await verifySession()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('comp_off_requests')
    .select('*, employee:employees!inner(id, employee_code, full_name_snapshot)')
    .eq('status', 'submitted')
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as CompOffRequestWithEmployee[]
}

export async function listRecentCompOffRequests(
  opts: { status?: CompOffRequest['status']; limit?: number } = {},
): Promise<CompOffRequestWithEmployee[]> {
  await verifySession()
  const supabase = await createClient()
  let q = supabase
    .from('comp_off_requests')
    .select('*, employee:employees!inner(id, employee_code, full_name_snapshot)')
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 100)
  if (opts.status) q = q.eq('status', opts.status)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as CompOffRequestWithEmployee[]
}
