import 'server-only'
import { createClient } from '@/lib/supabase/server'

// -----------------------------------------------------------------------------
// Common entry-fetch helper. Pulls every approved + submitted entry in the
// window with the embeds the reports need, then we aggregate in JS.
//
// Design choice: only `approved` rows count for reports by default. `submitted`
// rows are still in flux. Drafts never count. Pass `includeSubmitted: true`
// if HR wants a "live" view including in-flight weeks.
// -----------------------------------------------------------------------------
export type RawEntry = {
  employee_id: string
  employee_code: string
  employee_name: string
  project_id: number
  project_code: string
  project_name: string
  activity_type_id: number
  activity_code: string
  activity_name: string
  entry_date: string
  hours: number
  week_status: string
}

async function fetchEntriesInRange(
  fromIso: string,
  toIso: string,
  opts: { includeSubmitted?: boolean } = {},
): Promise<RawEntry[]> {
  const supabase = await createClient()

  const statuses = opts.includeSubmitted ? ['approved', 'submitted'] : ['approved']
  const { data: weeks } = await supabase
    .from('timesheet_weeks')
    .select('employee_id, week_start, status')
    .in('status', statuses)
    .gte('week_start', shiftIso(fromIso, -6))
    .lte('week_start', toIso)
  const weekRows = (weeks ?? []) as Array<{ employee_id: string; week_start: string; status: string }>
  if (weekRows.length === 0) return []

  const employeeIds = Array.from(new Set(weekRows.map((w) => w.employee_id)))
  const weekStatusKey = (employeeId: string, weekStart: string) =>
    weekRows.find((w) => w.employee_id === employeeId && w.week_start === weekStart)?.status ?? 'unknown'

  const { data, error } = await supabase
    .from('timesheet_entries')
    .select(`
      employee_id, project_id, activity_type_id, entry_date, hours,
      employee:employees!inner(employee_code, full_name_snapshot),
      project:projects(code, name),
      activity:activity_types(code, name)
    `)
    .in('employee_id', employeeIds)
    .gte('entry_date', fromIso)
    .lte('entry_date', toIso)
  if (error) throw new Error(error.message)

  type Embed<T> = T | T[] | null
  type Row = {
    employee_id: string
    project_id: number
    activity_type_id: number
    entry_date: string
    hours: number
    employee: Embed<{ employee_code: string; full_name_snapshot: string }>
    project: Embed<{ code: string; name: string }>
    activity: Embed<{ code: string; name: string }>
  }

  const out: RawEntry[] = []
  for (const r of (data ?? []) as unknown as Row[]) {
    const emp = Array.isArray(r.employee) ? r.employee[0] : r.employee
    const proj = Array.isArray(r.project) ? r.project[0] : r.project
    const act = Array.isArray(r.activity) ? r.activity[0] : r.activity
    if (!emp || !proj || !act) continue

    const weekStart = mondayOf(r.entry_date)
    const status = weekStatusKey(r.employee_id, weekStart)
    if (!statuses.includes(status)) continue

    out.push({
      employee_id: r.employee_id,
      employee_code: emp.employee_code,
      employee_name: emp.full_name_snapshot,
      project_id: r.project_id,
      project_code: proj.code,
      project_name: proj.name,
      activity_type_id: r.activity_type_id,
      activity_code: act.code,
      activity_name: act.name,
      entry_date: r.entry_date,
      hours: Number(r.hours),
      week_status: status,
    })
  }
  return out
}

function shiftIso(iso: string, days: number): string {
  return new Date(new Date(iso + 'T00:00:00Z').getTime() + days * 86_400_000).toISOString().slice(0, 10)
}

function mondayOf(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z')
  const dow = d.getUTCDay()
  const offset = dow === 0 ? 6 : dow - 1
  return new Date(d.getTime() - offset * 86_400_000).toISOString().slice(0, 10)
}

// -----------------------------------------------------------------------------
// Report shapes
// -----------------------------------------------------------------------------
export type ProjectReportRow = {
  project_id: number
  project_code: string
  project_name: string
  totalHours: number
  employeeCount: number
}

export type EmployeeReportRow = {
  employee_id: string
  employee_code: string
  employee_name: string
  totalHours: number
  workingDays: number
  capacityHours: number
  utilizationPct: number
  daysLogged: number
  daysWithGaps: number
}

export type ActivityReportRow = {
  activity_type_id: number
  activity_code: string
  activity_name: string
  totalHours: number
  projectCount: number
  employeeCount: number
}

// -----------------------------------------------------------------------------
// reportByProject
// -----------------------------------------------------------------------------
export async function reportByProject(
  fromIso: string,
  toIso: string,
  opts: { includeSubmitted?: boolean } = {},
): Promise<ProjectReportRow[]> {
  const entries = await fetchEntriesInRange(fromIso, toIso, opts)
  type Bucket = ProjectReportRow & { _employees: Set<string> }
  const buckets = new Map<number, Bucket>()
  for (const e of entries) {
    let b = buckets.get(e.project_id)
    if (!b) {
      b = {
        project_id: e.project_id,
        project_code: e.project_code,
        project_name: e.project_name,
        totalHours: 0,
        employeeCount: 0,
        _employees: new Set(),
      }
      buckets.set(e.project_id, b)
    }
    b.totalHours += e.hours
    b._employees.add(e.employee_id)
  }
  const out = Array.from(buckets.values()).map((b) => ({
    project_id: b.project_id,
    project_code: b.project_code,
    project_name: b.project_name,
    totalHours: round2(b.totalHours),
    employeeCount: b._employees.size,
  }))
  out.sort((a, b) => b.totalHours - a.totalHours)
  return out
}

// -----------------------------------------------------------------------------
// reportByEmployee
// -----------------------------------------------------------------------------
export async function reportByEmployee(
  fromIso: string,
  toIso: string,
  opts: { includeSubmitted?: boolean } = {},
): Promise<EmployeeReportRow[]> {
  const entries = await fetchEntriesInRange(fromIso, toIso, opts)
  const workingDays = countWeekdaysBetween(fromIso, toIso)
  const capacityHours = workingDays * 8

  type Bucket = {
    employee_id: string; employee_code: string; employee_name: string
    totalHours: number
    daysLogged: Set<string>
  }
  const buckets = new Map<string, Bucket>()
  for (const e of entries) {
    let b = buckets.get(e.employee_id)
    if (!b) {
      b = {
        employee_id: e.employee_id,
        employee_code: e.employee_code,
        employee_name: e.employee_name,
        totalHours: 0,
        daysLogged: new Set(),
      }
      buckets.set(e.employee_id, b)
    }
    b.totalHours += e.hours
    if (e.hours > 0) b.daysLogged.add(e.entry_date)
  }

  const out: EmployeeReportRow[] = []
  for (const b of buckets.values()) {
    const total = round2(b.totalHours)
    const daysWithGaps = Math.max(0, workingDays - b.daysLogged.size)
    out.push({
      employee_id: b.employee_id,
      employee_code: b.employee_code,
      employee_name: b.employee_name,
      totalHours: total,
      workingDays,
      capacityHours,
      utilizationPct: capacityHours > 0 ? Math.round((total / capacityHours) * 100) : 0,
      daysLogged: b.daysLogged.size,
      daysWithGaps,
    })
  }
  out.sort((a, b) => b.totalHours - a.totalHours)
  return out
}

// -----------------------------------------------------------------------------
// reportByActivity
// -----------------------------------------------------------------------------
export async function reportByActivity(
  fromIso: string,
  toIso: string,
  opts: { includeSubmitted?: boolean } = {},
): Promise<ActivityReportRow[]> {
  const entries = await fetchEntriesInRange(fromIso, toIso, opts)
  type Bucket = ActivityReportRow & { _projects: Set<number>; _employees: Set<string> }
  const buckets = new Map<number, Bucket>()
  for (const e of entries) {
    let b = buckets.get(e.activity_type_id)
    if (!b) {
      b = {
        activity_type_id: e.activity_type_id,
        activity_code: e.activity_code,
        activity_name: e.activity_name,
        totalHours: 0,
        projectCount: 0,
        employeeCount: 0,
        _projects: new Set(),
        _employees: new Set(),
      }
      buckets.set(e.activity_type_id, b)
    }
    b.totalHours += e.hours
    b._projects.add(e.project_id)
    b._employees.add(e.employee_id)
  }
  const out = Array.from(buckets.values()).map((b) => ({
    activity_type_id: b.activity_type_id,
    activity_code: b.activity_code,
    activity_name: b.activity_name,
    totalHours: round2(b.totalHours),
    projectCount: b._projects.size,
    employeeCount: b._employees.size,
  }))
  out.sort((a, b) => b.totalHours - a.totalHours)
  return out
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function countWeekdaysBetween(fromIso: string, toIso: string): number {
  let from = new Date(fromIso + 'T00:00:00Z').getTime()
  const to = new Date(toIso + 'T00:00:00Z').getTime()
  let count = 0
  while (from <= to) {
    const dow = new Date(from).getUTCDay()
    if (dow !== 0 && dow !== 6) count++
    from += 86_400_000
  }
  return count
}
