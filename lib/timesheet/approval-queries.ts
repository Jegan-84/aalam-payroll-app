import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { getUserWithRoles, findCurrentEmployee } from '@/lib/auth/dal'

export type ApprovalScope = {
  employeeId: string | null      // viewer's employee record (null for admin-only users)
  isAdminish: boolean            // admin / hr / payroll
  isManager: boolean             // viewer has at least one direct report
  scopeLabel: string             // "All employees" | "Your team (4)" | "No team"
}

export async function getApprovalScope(): Promise<ApprovalScope> {
  const me = await getUserWithRoles()
  const isAdminish = me.roles.some((r) => r === 'admin' || r === 'hr' || r === 'payroll')
  const found = await findCurrentEmployee()
  const employeeId = found?.employeeId ?? null

  let isManager = false
  let teamSize = 0
  if (employeeId) {
    const supabase = await createClient()
    const { count } = await supabase
      .from('employees')
      .select('id', { count: 'exact', head: true })
      .eq('reports_to', employeeId)
      .eq('employment_status', 'active')
    teamSize = count ?? 0
    isManager = teamSize > 0
  }

  let scopeLabel = 'No team'
  if (isAdminish) scopeLabel = 'All employees'
  else if (isManager) scopeLabel = `Your team (${teamSize})`

  return { employeeId, isAdminish, isManager, scopeLabel }
}

// -----------------------------------------------------------------------------
// Pending submissions visible to the viewer.
// -----------------------------------------------------------------------------
export type PendingWeek = {
  id: string
  weekStart: string
  weekEnd: string
  rangeLabel: string
  totalHours: number
  submittedAt: string | null
  employeeId: string
  employeeCode: string
  employeeName: string
  reportsToId: string | null
  status: 'submitted' | 'rejected'
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
function fmt(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z')
  return `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS[d.getUTCMonth()]}`
}

export async function listPendingWeeks(
  scope: ApprovalScope,
  opts: { includeRejected?: boolean; includeRecent?: boolean } = {},
): Promise<PendingWeek[]> {
  const supabase = await createClient()

  const statuses = opts.includeRejected ? ['submitted', 'rejected'] : ['submitted']

  let q = supabase
    .from('timesheet_weeks')
    .select(`
      id, week_start, status, total_hours, submitted_at,
      employee:employees!inner(id, employee_code, full_name_snapshot, reports_to, employment_status)
    `)
    .in('status', statuses)
    .order('submitted_at', { ascending: false })
    .limit(opts.includeRecent ? 200 : 100)

  // Manager sees only their direct reports unless they're admin/hr/payroll.
  if (!scope.isAdminish && scope.employeeId) {
    q = q.eq('employee.reports_to', scope.employeeId)
  }

  const { data, error } = await q
  if (error) throw new Error(error.message)

  type Row = {
    id: string; week_start: string; status: 'submitted' | 'rejected'
    total_hours: number; submitted_at: string | null
    employee: {
      id: string; employee_code: string; full_name_snapshot: string;
      reports_to: string | null; employment_status: string;
    } | { id: string; employee_code: string; full_name_snapshot: string; reports_to: string | null; employment_status: string }[]
  }

  const rows = (data ?? []) as unknown as Row[]
  return rows
    .map((r) => {
      const emp = Array.isArray(r.employee) ? r.employee[0] : r.employee
      if (!emp) return null
      const weekStart = r.week_start
      const weekEnd = new Date(new Date(weekStart + 'T00:00:00Z').getTime() + 6 * 86_400_000).toISOString().slice(0, 10)
      return {
        id: r.id,
        weekStart,
        weekEnd,
        rangeLabel: `${fmt(weekStart)} – ${fmt(weekEnd)}`,
        totalHours: Number(r.total_hours ?? 0),
        submittedAt: r.submitted_at,
        employeeId: emp.id,
        employeeCode: emp.employee_code,
        employeeName: emp.full_name_snapshot,
        reportsToId: emp.reports_to,
        status: r.status,
      } as PendingWeek
    })
    .filter((x): x is PendingWeek => x !== null)
}

// -----------------------------------------------------------------------------
// One submitted week's full grid for the approver to review.
// -----------------------------------------------------------------------------
export type ApprovalDetailRow = {
  id: string
  project_code: string
  project_name: string
  activity_code: string
  activity_name: string
  task: string | null
  work_mode: 'WFH' | 'WFO'
  hoursByDate: Record<string, number>
  startEndByDate: Record<string, { start: string | null; end: string | null }>
  totalHours: number
}

export type ApprovalDetail = {
  weekId: string
  employeeId: string
  employeeCode: string
  employeeName: string
  status: 'submitted' | 'approved' | 'rejected' | 'draft'
  weekStart: string
  weekEnd: string
  rangeLabel: string
  submittedAt: string | null
  decidedAt: string | null
  decisionNote: string | null
  totalHours: number
  rows: ApprovalDetailRow[]
  days: { iso: string; label: string; dayNumber: string }[]
  // Whether the viewer is allowed to act on this week.
  canApprove: boolean
}

const DAY_LABELS = ['MON','TUE','WED','THU','FRI','SAT','SUN']

export async function getApprovalDetail(
  weekId: string,
  scope: ApprovalScope,
): Promise<ApprovalDetail | null> {
  const supabase = await createClient()

  const { data: weekData } = await supabase
    .from('timesheet_weeks')
    .select(`
      id, week_start, status, total_hours, submitted_at, approved_at, decision_note,
      employee:employees!inner(id, employee_code, full_name_snapshot, reports_to)
    `)
    .eq('id', weekId)
    .maybeSingle()
  if (!weekData) return null

  type WRow = {
    id: string; week_start: string; status: ApprovalDetail['status']
    total_hours: number; submitted_at: string | null; approved_at: string | null;
    decision_note: string | null
    employee: { id: string; employee_code: string; full_name_snapshot: string; reports_to: string | null }
            | { id: string; employee_code: string; full_name_snapshot: string; reports_to: string | null }[]
  }
  const w = weekData as unknown as WRow
  const emp = Array.isArray(w.employee) ? w.employee[0] : w.employee
  if (!emp) return null

  // Authorization: admin/hr/payroll can see any; managers can see their reports only.
  const canSee =
    scope.isAdminish ||
    (scope.employeeId != null && emp.reports_to === scope.employeeId)
  if (!canSee) return null

  const weekStart = w.week_start
  const weekEnd = new Date(new Date(weekStart + 'T00:00:00Z').getTime() + 6 * 86_400_000).toISOString().slice(0, 10)

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(new Date(weekStart + 'T00:00:00Z').getTime() + i * 86_400_000)
    return {
      iso: d.toISOString().slice(0, 10),
      label: DAY_LABELS[i],
      dayNumber: String(d.getUTCDate()).padStart(2, '0'),
    }
  })

  const { data: entriesData } = await supabase
    .from('timesheet_entries')
    .select(`
      id, project_id, activity_type_id, entry_date, hours, task, work_mode, start_at, end_at,
      project:projects(code, name),
      activity:activity_types(code, name)
    `)
    .eq('employee_id', emp.id)
    .gte('entry_date', weekStart)
    .lte('entry_date', weekEnd)

  type ERow = {
    id: string; project_id: number; activity_type_id: number; entry_date: string;
    hours: number; task: string | null; work_mode: 'WFH' | 'WFO';
    start_at: string | null; end_at: string | null;
    project: { code: string; name: string } | { code: string; name: string }[] | null
    activity: { code: string; name: string } | { code: string; name: string }[] | null
  }

  const buckets = new Map<string, ApprovalDetailRow>()
  for (const r of (entriesData ?? []) as unknown as ERow[]) {
    const proj = Array.isArray(r.project) ? r.project[0] : r.project
    const act = Array.isArray(r.activity) ? r.activity[0] : r.activity
    const key = `${r.project_id}:${r.activity_type_id}:${r.task ?? ''}:${r.work_mode}`
    if (!buckets.has(key)) {
      buckets.set(key, {
        id: r.id,
        project_code: proj?.code ?? '?',
        project_name: proj?.name ?? '?',
        activity_code: act?.code ?? '?',
        activity_name: act?.name ?? '?',
        task: r.task,
        work_mode: r.work_mode,
        hoursByDate: {},
        startEndByDate: {},
        totalHours: 0,
      })
    }
    const b = buckets.get(key)!
    b.hoursByDate[r.entry_date] = (b.hoursByDate[r.entry_date] ?? 0) + Number(r.hours)
    b.totalHours = Math.round((b.totalHours + Number(r.hours)) * 100) / 100
    if (r.start_at || r.end_at) {
      b.startEndByDate[r.entry_date] = { start: r.start_at, end: r.end_at }
    }
  }

  const rows = Array.from(buckets.values()).sort((a, b) => {
    if (a.project_code !== b.project_code) return a.project_code.localeCompare(b.project_code)
    if (a.activity_code !== b.activity_code) return a.activity_code.localeCompare(b.activity_code)
    if ((a.task ?? '') !== (b.task ?? '')) return (a.task ?? '').localeCompare(b.task ?? '')
    return a.work_mode.localeCompare(b.work_mode)
  })

  return {
    weekId: w.id,
    employeeId: emp.id,
    employeeCode: emp.employee_code,
    employeeName: emp.full_name_snapshot,
    status: w.status,
    weekStart, weekEnd,
    rangeLabel: `${fmt(weekStart)} – ${fmt(weekEnd)}, ${weekStart.slice(0, 4)}`,
    submittedAt: w.submitted_at,
    decidedAt: w.approved_at,
    decisionNote: w.decision_note,
    totalHours: Number(w.total_hours ?? 0),
    rows,
    days,
    canApprove: w.status === 'submitted',
  }
}
