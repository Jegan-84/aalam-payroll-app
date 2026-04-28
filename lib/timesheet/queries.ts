import 'server-only'
import { createClient } from '@/lib/supabase/server'

export type WeekStatus = 'draft' | 'submitted' | 'approved' | 'rejected'
export type WorkMode = 'WFH' | 'WFO'

export type TimesheetRow = {
  id: string
  project_id: number
  project_code: string
  project_name: string
  activity_type_id: number
  activity_code: string
  activity_name: string
  task: string | null
  description: string | null
  work_mode: WorkMode
  source: 'manual' | 'timer' | 'auto'
  // Hours per ISO date in the week — keys are YYYY-MM-DD
  hoursByDate: Record<string, number>
  // Per-day start/end if the entry has them — for display in the cell tooltip.
  startEndByDate: Record<string, { start: string | null; end: string | null }>
  totalHours: number
}

export type WeekState = {
  weekStart: string                  // YYYY-MM-DD (Mon)
  weekEnd: string                    // YYYY-MM-DD (Sun)
  rangeLabel: string                 // "06 Apr 2026 - 12 Apr 2026"
  prevWeek: string
  nextWeek: string
  todayIso: string
  status: WeekStatus
  totalHours: number
  decisionNote: string | null
  submittedAt: string | null
  decidedAt: string | null
  rows: TimesheetRow[]
  days: { iso: string; label: string; dayNumber: string }[]   // 7 days, Mon..Sun
}

const DAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmt(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z')
  return `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

function isoDate(d: Date): string { return d.toISOString().slice(0, 10) }

function mondayAnchor(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const dow = d.getUTCDay() // 0..6, Sun=0
  const offset = dow === 0 ? 6 : dow - 1
  return new Date(d.getTime() - offset * 86_400_000)
}

export async function getMyWeek(employeeId: string, anchorIso: string): Promise<WeekState> {
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(anchorIso)
    ? new Date(anchorIso + 'T00:00:00Z')
    : new Date()
  const monday = mondayAnchor(anchor)
  const sunday = new Date(monday.getTime() + 6 * 86_400_000)
  const weekStart = isoDate(monday)
  const weekEnd = isoDate(sunday)

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday.getTime() + i * 86_400_000)
    return {
      iso: isoDate(d),
      label: DAY_LABELS[i],
      dayNumber: String(d.getUTCDate()).padStart(2, '0'),
    }
  })

  const supabase = await createClient()

  // Week submission state
  const { data: weekRow } = await supabase
    .from('timesheet_weeks')
    .select('status, total_hours, decision_note, submitted_at, approved_at')
    .eq('employee_id', employeeId)
    .eq('week_start', weekStart)
    .maybeSingle()

  // Entries
  const { data: entriesData } = await supabase
    .from('timesheet_entries')
    .select(`
      id, project_id, activity_type_id, entry_date, hours, task, description, work_mode, source, start_at, end_at,
      project:projects(code, name),
      activity:activity_types(code, name)
    `)
    .eq('employee_id', employeeId)
    .gte('entry_date', weekStart)
    .lte('entry_date', weekEnd)

  type Embed<T> = T | T[] | null
  type Raw = {
    id: string
    project_id: number
    activity_type_id: number
    entry_date: string
    hours: number
    task: string | null
    description: string | null
    work_mode: WorkMode
    source: 'manual' | 'timer' | 'auto'
    start_at: string | null
    end_at: string | null
    project: Embed<{ code: string; name: string }>
    activity: Embed<{ code: string; name: string }>
  }

  // Group rows by (project_id, activity_type_id, task, work_mode). Each unique
  // mode gets its own row so an employee can split a day across WFH and WFO.
  const buckets = new Map<string, TimesheetRow>()
  for (const r of (entriesData ?? []) as unknown as Raw[]) {
    const proj = Array.isArray(r.project) ? r.project[0] : r.project
    const act = Array.isArray(r.activity) ? r.activity[0] : r.activity
    const key = `${r.project_id}:${r.activity_type_id}:${r.task ?? ''}:${r.work_mode}`
    if (!buckets.has(key)) {
      buckets.set(key, {
        id: r.id,
        project_id: r.project_id,
        project_code: proj?.code ?? '?',
        project_name: proj?.name ?? '?',
        activity_type_id: r.activity_type_id,
        activity_code: act?.code ?? '?',
        activity_name: act?.name ?? '?',
        task: r.task,
        description: r.description,
        work_mode: r.work_mode,
        source: r.source,
        hoursByDate: {},
        startEndByDate: {},
        totalHours: 0,
      })
    }
    const bucket = buckets.get(key)!
    bucket.hoursByDate[r.entry_date] = (bucket.hoursByDate[r.entry_date] ?? 0) + Number(r.hours)
    bucket.totalHours = Math.round((bucket.totalHours + Number(r.hours)) * 100) / 100
    if (r.start_at || r.end_at) {
      bucket.startEndByDate[r.entry_date] = { start: r.start_at, end: r.end_at }
    }
  }

  const rows = Array.from(buckets.values()).sort((a, b) => {
    if (a.project_code !== b.project_code) return a.project_code.localeCompare(b.project_code)
    if (a.activity_code !== b.activity_code) return a.activity_code.localeCompare(b.activity_code)
    if ((a.task ?? '') !== (b.task ?? '')) return (a.task ?? '').localeCompare(b.task ?? '')
    return a.work_mode.localeCompare(b.work_mode)
  })

  const totalHours = Math.round(rows.reduce((s, r) => s + r.totalHours, 0) * 100) / 100

  return {
    weekStart, weekEnd,
    rangeLabel: `${fmt(weekStart)} - ${fmt(weekEnd)}`,
    prevWeek: isoDate(new Date(monday.getTime() - 7 * 86_400_000)),
    nextWeek: isoDate(new Date(monday.getTime() + 7 * 86_400_000)),
    todayIso: isoDate(new Date()),
    status: (weekRow?.status as WeekStatus) ?? 'draft',
    totalHours: Number(weekRow?.total_hours ?? totalHours),
    decisionNote: weekRow?.decision_note ?? null,
    submittedAt: weekRow?.submitted_at ?? null,
    decidedAt: weekRow?.approved_at ?? null,
    rows,
    days,
  }
}

// Active timer for the current employee — null when nothing is running.
export type ActiveTimer = {
  project_id: number
  project_code: string
  project_name: string
  activity_type_id: number
  activity_code: string
  activity_name: string
  task: string | null
  description: string | null
  work_mode: WorkMode
  startedAt: string  // ISO
}

export async function getActiveTimer(employeeId: string): Promise<ActiveTimer | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('active_timers')
    .select(`
      project_id, activity_type_id, task, description, work_mode, started_at,
      project:projects(code, name),
      activity:activity_types(code, name)
    `)
    .eq('employee_id', employeeId)
    .maybeSingle()
  if (!data) return null
  type Raw = {
    project_id: number; activity_type_id: number; task: string | null; description: string | null;
    work_mode: WorkMode; started_at: string;
    project: { code: string; name: string } | { code: string; name: string }[] | null
    activity: { code: string; name: string } | { code: string; name: string }[] | null
  }
  const r = data as unknown as Raw
  const proj = Array.isArray(r.project) ? r.project[0] : r.project
  const act = Array.isArray(r.activity) ? r.activity[0] : r.activity
  return {
    project_id: r.project_id,
    project_code: proj?.code ?? '?',
    project_name: proj?.name ?? '?',
    activity_type_id: r.activity_type_id,
    activity_code: act?.code ?? '?',
    activity_name: act?.name ?? '?',
    task: r.task,
    description: r.description,
    work_mode: r.work_mode,
    startedAt: r.started_at,
  }
}

// -----------------------------------------------------------------------------
// listMyWeeks — every timesheet_week row this employee has touched, newest
// first. Used by the index list at /me/timesheet.
// -----------------------------------------------------------------------------
export type WeekListRow = {
  weekId: string
  weekStart: string
  weekEnd: string
  rangeLabel: string
  status: WeekStatus
  totalHours: number
  rowCount: number
  submittedAt: string | null
  decidedAt: string | null
  updatedAt: string | null
}

const MONTHS_LIST = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
function fmtRange(startIso: string, endIso: string): string {
  const s = new Date(startIso + 'T00:00:00Z')
  const e = new Date(endIso + 'T00:00:00Z')
  const sd = String(s.getUTCDate()).padStart(2, '0')
  const ed = String(e.getUTCDate()).padStart(2, '0')
  if (s.getUTCFullYear() === e.getUTCFullYear() && s.getUTCMonth() === e.getUTCMonth()) {
    return `${sd} – ${ed} ${MONTHS_LIST[s.getUTCMonth()]} ${s.getUTCFullYear()}`
  }
  if (s.getUTCFullYear() === e.getUTCFullYear()) {
    return `${sd} ${MONTHS_LIST[s.getUTCMonth()]} – ${ed} ${MONTHS_LIST[e.getUTCMonth()]} ${s.getUTCFullYear()}`
  }
  return `${sd} ${MONTHS_LIST[s.getUTCMonth()]} ${s.getUTCFullYear()} – ${ed} ${MONTHS_LIST[e.getUTCMonth()]} ${e.getUTCFullYear()}`
}

export async function listMyWeeks(employeeId: string): Promise<WeekListRow[]> {
  const supabase = await createClient()
  const { data: weeks, error } = await supabase
    .from('timesheet_weeks')
    .select('id, week_start, status, total_hours, submitted_at, approved_at, updated_at')
    .eq('employee_id', employeeId)
    .order('week_start', { ascending: false })
    .limit(52)
  if (error) throw new Error(error.message)
  const weekRows = (weeks ?? []) as Array<{
    id: string; week_start: string; status: WeekStatus; total_hours: number;
    submitted_at: string | null; approved_at: string | null; updated_at: string | null;
  }>
  if (weekRows.length === 0) return []

  // Fetch entry counts in one round trip.
  const weekStartsAsc = [...weekRows].map((w) => w.week_start).sort()
  const earliest = weekStartsAsc[0]
  const latestStart = weekStartsAsc[weekStartsAsc.length - 1]
  const latestEnd = new Date(new Date(latestStart + 'T00:00:00Z').getTime() + 6 * 86_400_000)
    .toISOString().slice(0, 10)
  const { data: entries } = await supabase
    .from('timesheet_entries')
    .select('entry_date')
    .eq('employee_id', employeeId)
    .gte('entry_date', earliest)
    .lte('entry_date', latestEnd)

  const countByWeek = new Map<string, number>()
  for (const e of (entries ?? []) as Array<{ entry_date: string }>) {
    const d = new Date(e.entry_date + 'T00:00:00Z')
    const dow = d.getUTCDay()
    const offset = dow === 0 ? 6 : dow - 1
    const ws = new Date(d.getTime() - offset * 86_400_000).toISOString().slice(0, 10)
    countByWeek.set(ws, (countByWeek.get(ws) ?? 0) + 1)
  }

  return weekRows.map((w) => {
    const weekEnd = new Date(new Date(w.week_start + 'T00:00:00Z').getTime() + 6 * 86_400_000)
      .toISOString().slice(0, 10)
    return {
      weekId: w.id,
      weekStart: w.week_start,
      weekEnd,
      rangeLabel: fmtRange(w.week_start, weekEnd),
      status: w.status,
      totalHours: Number(w.total_hours ?? 0),
      rowCount: countByWeek.get(w.week_start) ?? 0,
      submittedAt: w.submitted_at,
      decidedAt: w.approved_at,
      updatedAt: w.updated_at,
    }
  })
}

// Monday-anchored ISO of the week containing the given date (defaults to today).
export function mondayAnchorOf(dateIso?: string): string {
  const d = new Date((dateIso || new Date().toISOString().slice(0, 10)) + 'T00:00:00Z')
  const dow = d.getUTCDay()
  const offset = dow === 0 ? 6 : dow - 1
  return new Date(d.getTime() - offset * 86_400_000).toISOString().slice(0, 10)
}
