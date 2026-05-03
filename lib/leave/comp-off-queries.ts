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

export type CompOffRequestStatus = 'submitted' | 'manager_approved' | 'approved' | 'rejected' | 'cancelled'

export type CompOffRequest = {
  id: string
  employee_id: string
  work_date: string
  days_requested: number
  reason: string | null
  status: CompOffRequestStatus
  decided_by: string | null
  decided_at: string | null
  decision_note: string | null
  manager_approved_at: string | null
  manager_approved_by: string | null
  manager_decision_note: string | null
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

/** HR queue — manager-approved requests awaiting HR final review. */
export async function listPendingCompOffRequests(): Promise<CompOffRequestWithEmployee[]> {
  await verifySession()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('comp_off_requests')
    .select('*, employee:employees!inner(id, employee_code, full_name_snapshot)')
    .eq('status', 'manager_approved')
    .order('manager_approved_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as CompOffRequestWithEmployee[]
}

/** Stage-1 queue — submitted requests awaiting reporting-manager review (admin view of org-wide pending). */
export async function listSubmittedCompOffRequests(): Promise<CompOffRequestWithEmployee[]> {
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

/**
 * Manager queue — requests for the calling user's direct reports that are still
 * awaiting their stage-1 approval (status='submitted'). Returns [] if the
 * caller has no reports or no employee record.
 */
export async function listMyTeamPendingCompOff(): Promise<CompOffRequestWithEmployee[]> {
  await verifySession()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: meEmp } = await supabase
    .from('employees').select('id').eq('user_id', user.id).maybeSingle()
  let myEmpId = meEmp?.id as string | undefined
  if (!myEmpId && user.email) {
    const { data: byEmail } = await supabase
      .from('employees').select('id').eq('work_email', user.email).maybeSingle()
    myEmpId = byEmail?.id as string | undefined
  }
  if (!myEmpId) return []

  const { data, error } = await supabase
    .from('comp_off_requests')
    .select('*, employee:employees!inner(id, employee_code, full_name_snapshot, reports_to)')
    .eq('status', 'submitted')
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)

  type Row = CompOffRequestWithEmployee & {
    employee: { id: string; employee_code: string; full_name_snapshot: string; reports_to: string | null }
  }
  return ((data ?? []) as unknown as Row[])
    .filter((r) => r.employee.reports_to === myEmpId)
    .map((r) => ({ ...r, employee: { id: r.employee.id, employee_code: r.employee.employee_code, full_name_snapshot: r.employee.full_name_snapshot } }))
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
