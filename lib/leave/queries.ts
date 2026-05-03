import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/auth/dal'
import { resolveFy } from '@/lib/leave/engine'

// Org's weekly off days (0=Sun..6=Sat). Used by leave + payroll.
// Originally in lib/attendance/queries.ts; lifted here when the attendance
// module was retired so leave/payroll have a stable home for it.
export const getWeeklyOffDays = cache(async (): Promise<number[]> => {
  await verifySession()
  const supabase = await createClient()
  const { data } = await supabase.from('organizations').select('weekly_off_days').limit(1).maybeSingle()
  return ((data?.weekly_off_days ?? [0]) as number[]).filter((d) => Number.isInteger(d))
})

// All holidays in a given calendar month (no project / location filter).
// Originally in lib/attendance/queries.ts; only payroll/actions consumes it.
export const getHolidaysForMonth = cache(async (year: number, month: number): Promise<Set<string>> => {
  await verifySession()
  const supabase = await createClient()
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const first = `${year}-${String(month).padStart(2, '0')}-01`
  const lastIso = `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`
  const { data } = await supabase
    .from('holidays')
    .select('holiday_date')
    .gte('holiday_date', first)
    .lte('holiday_date', lastIso)
  return new Set((data ?? []).map((h) => h.holiday_date as string))
})

export type LeaveStatus = 'pending' | 'manager_approved' | 'approved' | 'rejected' | 'cancelled'

export type LeaveApplicationRow = {
  id: string
  employee_id: string
  leave_type_id: number
  from_date: string
  to_date: string
  days_count: number
  is_half_day: boolean
  reason: string | null
  status: LeaveStatus
  applied_at: string
  reviewed_at: string | null
  manager_approved_at: string | null
  manager_approved_by: string | null
  manager_decision_note: string | null
  employee: { id: string; employee_code: string; full_name_snapshot: string }
  leave_type: { id: number; code: string; name: string }
}

type EmbedOne<T> = T | T[] | null
function unwrap<T>(v: EmbedOne<T>): T | null {
  return Array.isArray(v) ? v[0] ?? null : v
}

type Filters = {
  status?: LeaveStatus
  employee_id?: string
  page?: number
  pageSize?: number
}

export async function listLeaveApplications(filters: Filters = {}) {
  await verifySession()
  const supabase = await createClient()

  const pageSize = Math.max(1, Math.min(100, filters.pageSize ?? 50))
  const page = Math.max(1, filters.page ?? 1)
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('leave_applications')
    .select(
      `
      id, employee_id, leave_type_id, from_date, to_date, days_count, is_half_day, reason, status,
      applied_at, reviewed_at,
      manager_approved_at, manager_approved_by, manager_decision_note,
      employee:employees!inner ( id, employee_code, full_name_snapshot ),
      leave_type:leave_types!inner ( id, code, name )
    `,
      { count: 'exact' },
    )
    .order('applied_at', { ascending: false })
    .range(from, to)

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.employee_id) query = query.eq('employee_id', filters.employee_id)

  const { data, count, error } = await query
  if (error) throw new Error(error.message)

  type Row = Omit<LeaveApplicationRow, 'employee' | 'leave_type'> & {
    employee: EmbedOne<LeaveApplicationRow['employee']>
    leave_type: EmbedOne<LeaveApplicationRow['leave_type']>
  }
  const rows = ((data ?? []) as unknown as Row[])
    .map((r) => {
      const emp = unwrap(r.employee)
      const lt = unwrap(r.leave_type)
      if (!emp || !lt) return null
      return { ...r, employee: emp, leave_type: lt }
    })
    .filter((r): r is LeaveApplicationRow => r !== null)

  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  return { rows, total, page: Math.min(page, totalPages), totalPages }
}

/**
 * Leaves awaiting the calling user as the reporting manager — i.e. status='pending'
 * for any direct report (employees.reports_to == calling user's employee id).
 * Returns [] if the caller has no reports or no employee record.
 */
export async function listMyTeamPendingLeaves(): Promise<LeaveApplicationRow[]> {
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
    .from('leave_applications')
    .select(`
      id, employee_id, leave_type_id, from_date, to_date, days_count, is_half_day, reason, status,
      applied_at, reviewed_at,
      manager_approved_at, manager_approved_by, manager_decision_note,
      employee:employees!inner ( id, employee_code, full_name_snapshot, reports_to ),
      leave_type:leave_types!inner ( id, code, name )
    `)
    .eq('status', 'pending')
    .order('applied_at', { ascending: false })
  if (error) throw new Error(error.message)

  type EmpEmbed = { id: string; employee_code: string; full_name_snapshot: string; reports_to: string | null }
  type Row = Omit<LeaveApplicationRow, 'employee' | 'leave_type'> & {
    employee: EmbedOne<EmpEmbed>
    leave_type: EmbedOne<LeaveApplicationRow['leave_type']>
  }
  const rows = ((data ?? []) as unknown as Row[])
    .map((r) => {
      const emp = unwrap(r.employee)
      const lt = unwrap(r.leave_type)
      if (!emp || !lt) return null
      return { row: r, emp, lt }
    })
    .filter((x): x is { row: Row; emp: EmpEmbed; lt: LeaveApplicationRow['leave_type'] } => x !== null)
    // Manager filter — only direct reports.
    .filter((x) => x.emp.reports_to === myEmpId)
    .map((x) => ({ ...x.row, employee: { id: x.emp.id, employee_code: x.emp.employee_code, full_name_snapshot: x.emp.full_name_snapshot }, leave_type: x.lt }))

  return rows
}

export const getLeaveApplication = cache(async (id: string) => {
  await verifySession()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('leave_applications')
    .select(
      `
      *,
      employee:employees!inner ( id, employee_code, full_name_snapshot, work_email, reports_to ),
      leave_type:leave_types!inner ( id, code, name, is_paid )
    `,
    )
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  type EmpEmbed = { id: string; employee_code: string; full_name_snapshot: string; work_email: string; reports_to: string | null }
  const emp = unwrap(data.employee as EmbedOne<EmpEmbed>)
  const lt  = unwrap(data.leave_type as EmbedOne<{ id: number; code: string; name: string; is_paid: boolean }>)
  if (!emp || !lt) return null
  return { ...data, employee: emp, leave_type: lt }
})

export const getFyContext = cache(async (date?: Date) => {
  await verifySession()
  const supabase = await createClient()
  const { data: org } = await supabase
    .from('organizations')
    .select('financial_year_start_month, pt_state_code')
    .limit(1)
    .maybeSingle()
  const fyStartMonth = (org?.financial_year_start_month as number | undefined) ?? 4
  return resolveFy(date ?? new Date(), fyStartMonth)
})

export type LeaveTypeRow = { id: number; code: string; name: string; is_paid: boolean; annual_quota_days: number; display_order: number }

export const getLeaveTypes = cache(async (): Promise<LeaveTypeRow[]> => {
  await verifySession()
  const supabase = await createClient()
  const { data } = await supabase
    .from('leave_types')
    .select('id, code, name, is_paid, annual_quota_days, display_order')
    .eq('is_active', true)
    .order('display_order')
  return (data ?? []) as LeaveTypeRow[]
})

export type BalanceRow = {
  id: string
  employee_id: string
  leave_type_id: number
  fy_start: string
  fy_end: string
  opening_balance: number
  accrued: number
  carried_forward: number
  used: number
  encashed: number
  adjustment: number
  current_balance: number
  notes: string | null
}

export async function getBalancesForFy(fyStart: string) {
  await verifySession()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('leave_balances')
    .select(
      `
      id, employee_id, leave_type_id, fy_start, fy_end,
      opening_balance, accrued, carried_forward, used, encashed, adjustment, current_balance, notes,
      employee:employees!inner ( id, employee_code, full_name_snapshot, employment_status )
    `,
    )
    .eq('fy_start', fyStart)
  if (error) throw new Error(error.message)
  type EmpEmbed = { id: string; employee_code: string; full_name_snapshot: string; employment_status: string }
  type Row = BalanceRow & { employee: EmbedOne<EmpEmbed> }
  type FlatRow = BalanceRow & { employee: EmpEmbed | null }
  const flat: FlatRow[] = ((data ?? []) as unknown as Row[]).map((r) => ({ ...r, employee: unwrap(r.employee) }))
  return flat.filter((r): r is BalanceRow & { employee: EmpEmbed } => r.employee !== null)
}

/** Balances for a single employee for a given FY — fills in zero rows for leave types with no row yet. */
export async function getEmployeeFyBalances(employeeId: string, fyStart: string): Promise<BalanceRow[]> {
  await verifySession()
  const supabase = await createClient()
  const [{ data }, leaveTypes] = await Promise.all([
    supabase.from('leave_balances').select('*').eq('employee_id', employeeId).eq('fy_start', fyStart),
    getLeaveTypes(),
  ])
  const byType = new Map((data ?? []).map((r) => [r.leave_type_id as number, r as unknown as BalanceRow]))
  return leaveTypes.map((lt) => {
    const existing = byType.get(lt.id)
    if (existing) return existing
    return {
      id: '',
      employee_id: employeeId,
      leave_type_id: lt.id,
      fy_start: fyStart,
      fy_end: '',
      opening_balance: 0,
      accrued: 0,
      carried_forward: 0,
      used: 0,
      encashed: 0,
      adjustment: 0,
      current_balance: 0,
      notes: null,
    }
  })
}

export const getHolidaysInRange = cache(async (fromIso: string, toIso: string): Promise<Set<string>> => {
  await verifySession()
  const supabase = await createClient()
  const { data } = await supabase
    .from('holidays')
    .select('holiday_date')
    .gte('holiday_date', fromIso)
    .lte('holiday_date', toIso)
  return new Set((data ?? []).map((h) => h.holiday_date as string))
})

// Employee-aware holiday lookup: returns the set of dates that apply to this
// employee's primary project and location. Holidays with NULL project_id or
// NULL location_id apply to everyone on that axis.
export const getHolidaysForEmployeeInRange = cache(async (
  employeeId: string,
  fromIso: string,
  toIso: string,
): Promise<Set<string>> => {
  await verifySession()
  const supabase = await createClient()
  const { data: emp } = await supabase
    .from('employees')
    .select('primary_project_id, location_id')
    .eq('id', employeeId)
    .maybeSingle()
  const primaryProjectId = (emp?.primary_project_id as number | null | undefined) ?? null
  const locationId = (emp?.location_id as number | null | undefined) ?? null

  let q = supabase
    .from('holidays')
    .select('holiday_date, project_id, location_id')
    .gte('holiday_date', fromIso)
    .lte('holiday_date', toIso)
  // project_id filter: null OR matches primary project.
  q = primaryProjectId == null ? q.is('project_id', null) : q.or(`project_id.is.null,project_id.eq.${primaryProjectId}`)
  // location_id filter: null OR matches employee's location.
  q = locationId == null ? q.is('location_id', null) : q.or(`location_id.is.null,location_id.eq.${locationId}`)

  const { data } = await q
  return new Set((data ?? []).map((h) => h.holiday_date as string))
})

export const getLeaveContext = cache(async () => {
  const [weeklyOffDays, leaveTypes] = await Promise.all([getWeeklyOffDays(), getLeaveTypes()])
  return { weeklyOffDays, leaveTypes }
})
