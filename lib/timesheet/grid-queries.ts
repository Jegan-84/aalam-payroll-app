import 'server-only'
import { createClient } from '@/lib/supabase/server'

// =============================================================================
// Daily Timesheet Grid
// =============================================================================
// One row per employee, one column per date in the window. Pure timesheet view —
// every value comes from `timesheet_entries`. We do NOT cross-check against
// leave applications or monthly plans; the grid reflects exactly what the
// employee logged (including each entry's `work_mode` of WFH/WFO).
//
// Per (employee, date):
//   - workedHours = sum of entries whose activity is NOT a leave code
//   - leaveHours  = sum of entries whose activity IS a leave code
//   - wfhHours    = portion of workedHours logged with work_mode='WFH'
// Cell state is derived from those values:
//   - full_leave  → leaveHours > 0 and workedHours = 0
//   - half_leave  → leaveHours > 0 and workedHours > 0
//   - wfh         → workedHours > 0 and the majority of those hours are WFH
//   - work        → workedHours > 0 (mostly/all WFO, no leave)
//   - weekend     → Sat/Sun with no entries (cosmetic only — date math, not data)
//   - empty       → weekday with no entries
// =============================================================================

// Activity codes that map to leave on the timesheet. Hours under these codes
// land in `leaveHours`; everything else lands in `workedHours`.
const LEAVE_ACTIVITY_CODES = new Set(['SL', 'PL', 'EL', 'COMP_OFF', 'LOP'])

export type GridState =
  | 'work'
  | 'wfh'
  | 'half_leave'
  | 'full_leave'
  | 'weekend'
  | 'empty'

export type GridCell = {
  date: string
  workedHours: number
  leaveHours: number
  wfhHours: number           // worked hours logged with work_mode='WFH'
  state: GridState
  leaveCode: string | null   // top leave-activity code on this date (display hint only)
}

export type GridRow = {
  employeeId: string
  employeeCode: string
  employeeName: string
  cells: Record<string, GridCell>     // keyed by date (YYYY-MM-DD)
  totalWorkedHours: number
  totalLeaveHours: number
}

export type GridSummary = {
  dates: string[]                     // every date in the range, ordered
  rows: GridRow[]
  totals: {
    employees: number
    workedHours: number
    leaveHours: number
  }
  daysInRange: number
}

export async function getDailyTimesheetGrid(
  fromIso: string,
  toIso: string,
  opts: { employeeId?: string; includeSubmitted?: boolean } = {},
): Promise<GridSummary> {
  const supabase = await createClient()

  // Date list (inclusive)
  const dates: string[] = []
  let cursor = new Date(fromIso + 'T00:00:00Z').getTime()
  const end = new Date(toIso + 'T00:00:00Z').getTime()
  while (cursor <= end) {
    dates.push(new Date(cursor).toISOString().slice(0, 10))
    cursor += 86_400_000
  }

  // 1. Active employees (or just the one filtered)
  let empQ = supabase
    .from('employees')
    .select('id, employee_code, full_name_snapshot, employment_status')
    .eq('employment_status', 'active')
    .order('employee_code')
  if (opts.employeeId) empQ = empQ.eq('id', opts.employeeId)
  const { data: empData, error: empErr } = await empQ
  if (empErr) throw new Error(empErr.message)
  type EmpRow = { id: string; employee_code: string; full_name_snapshot: string }
  const employees = (empData ?? []) as EmpRow[]

  // 2. Timesheet weeks — gate by status (approved by default, or live)
  const statuses = opts.includeSubmitted
    ? ['approved', 'submitted', 'draft']
    : ['approved']
  const employeeIds = employees.map((e) => e.id)

  const allowedWeekKeys = new Set<string>()
  if (employeeIds.length > 0) {
    const { data: weeks } = await supabase
      .from('timesheet_weeks')
      .select('employee_id, week_start, status')
      .in('employee_id', employeeIds)
      .in('status', statuses)
      .gte('week_start', shiftIso(fromIso, -6))
      .lte('week_start', toIso)
    for (const w of (weeks ?? []) as Array<{ employee_id: string; week_start: string }>) {
      allowedWeekKeys.add(`${w.employee_id}:${w.week_start}`)
    }
  }

  // 3. Timesheet entries for those employees in the window
  type EntryRow = {
    employee_id: string
    entry_date: string
    hours: number
    work_mode: string | null
    activity: { code: string } | { code: string }[] | null
  }
  let entries: EntryRow[] = []
  if (employeeIds.length > 0) {
    let q = supabase
      .from('timesheet_entries')
      .select(`employee_id, entry_date, hours, work_mode, activity:activity_types(code)`)
      .in('employee_id', employeeIds)
      .gte('entry_date', fromIso)
      .lte('entry_date', toIso)
    if (opts.employeeId) q = q.eq('employee_id', opts.employeeId)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    entries = (data ?? []) as unknown as EntryRow[]
  }

  // Aggregate per (employee, date): worked vs leave hours, WFH portion of the
  // worked hours, and the dominant leave-activity code (most-hours-wins) so we
  // can label the cell with SL/PL/etc.
  type Bucket = { worked: number; wfh: number; leave: number; leaveByCode: Map<string, number> }
  const buckets = new Map<string, Bucket>()
  const ensure = (key: string): Bucket => {
    let b = buckets.get(key)
    if (!b) {
      b = { worked: 0, wfh: 0, leave: 0, leaveByCode: new Map() }
      buckets.set(key, b)
    }
    return b
  }
  for (const e of entries) {
    const weekStart = mondayOf(e.entry_date)
    if (!allowedWeekKeys.has(`${e.employee_id}:${weekStart}`)) continue
    const act = Array.isArray(e.activity) ? e.activity[0] : e.activity
    const code = act?.code ?? '?'
    const hours = Number(e.hours)
    const b = ensure(`${e.employee_id}:${e.entry_date}`)
    if (LEAVE_ACTIVITY_CODES.has(code)) {
      b.leave += hours
      b.leaveByCode.set(code, (b.leaveByCode.get(code) ?? 0) + hours)
    } else {
      b.worked += hours
      if ((e.work_mode ?? '').toUpperCase() === 'WFH') b.wfh += hours
    }
  }

  // Assemble rows
  const rows: GridRow[] = employees.map((e) => {
    const cells: Record<string, GridCell> = {}
    let totalWorked = 0
    let totalLeave = 0
    for (const date of dates) {
      const b = buckets.get(`${e.id}:${date}`)
      const worked = b?.worked ?? 0
      const wfh = b?.wfh ?? 0
      const leave = b?.leave ?? 0
      const dow = new Date(date + 'T00:00:00Z').getUTCDay()
      const isWeekend = dow === 0 || dow === 6

      // Pick the dominant leave activity for the cell label.
      let leaveCode: string | null = null
      if (b && b.leaveByCode.size > 0) {
        let topHours = -1
        for (const [code, hrs] of b.leaveByCode) {
          if (hrs > topHours) {
            topHours = hrs
            leaveCode = code
          }
        }
      }

      // WFH wins over WFO when at least half the worked hours were WFH.
      const isWfhDay = worked > 0 && wfh >= worked / 2

      let state: GridState
      if (leave > 0 && worked > 0) state = 'half_leave'
      else if (leave > 0)         state = 'full_leave'
      else if (isWfhDay)          state = 'wfh'
      else if (worked > 0)        state = 'work'
      else if (isWeekend)         state = 'weekend'
      else                        state = 'empty'

      cells[date] = {
        date,
        workedHours: round2(worked),
        leaveHours: round2(leave),
        wfhHours: round2(wfh),
        state,
        leaveCode,
      }
      totalWorked += worked
      totalLeave += leave
    }
    return {
      employeeId: e.id,
      employeeCode: e.employee_code,
      employeeName: e.full_name_snapshot,
      cells,
      totalWorkedHours: round2(totalWorked),
      totalLeaveHours: round2(totalLeave),
    }
  })

  return {
    dates,
    rows,
    totals: {
      employees: rows.length,
      workedHours: round2(rows.reduce((s, r) => s + r.totalWorkedHours, 0)),
      leaveHours: round2(rows.reduce((s, r) => s + r.totalLeaveHours, 0)),
    },
    daysInRange: dates.length,
  }
}

// =============================================================================
// Helpers
// =============================================================================
function round2(n: number): number {
  return Math.round(n * 100) / 100
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

/**
 * Format a decimal hours value to "H:MM" (e.g., 8.3 → "8:18").
 */
export function formatHHMM(decimal: number): string {
  if (!Number.isFinite(decimal) || decimal <= 0) return '0:00'
  const totalMinutes = Math.round(decimal * 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${h}:${String(m).padStart(2, '0')}`
}
