import 'server-only'
import { createClient } from '@/lib/supabase/server'

// Activity codes that count as "leave-like" entries on the timesheet. These
// correspond 1:1 with leave_types codes seeded in migration 26.
const LEAVE_ACTIVITY_CODES = new Set(['SL', 'PL', 'EL', 'COMP_OFF', 'LOP'])

export type ReconciliationKind = 'leave_no_timesheet' | 'timesheet_no_leave' | 'mismatch'

export type ReconciliationRow = {
  employeeId: string
  employeeCode: string
  employeeName: string
  date: string                  // YYYY-MM-DD
  leaveType: string | null      // SL / PL / EL / COMP_OFF / LOP — or null
  leaveStatus: 'approved' | 'pending' | null
  timesheetActivity: string | null
  timesheetHours: number        // 0 if no entry
  kind: ReconciliationKind
  detail: string
}

export type CleanEmployee = {
  employeeId: string
  employeeCode: string
  employeeName: string
  matchedDays: number   // days where leave application and timesheet entry agree
}

export type ReconciliationSummary = {
  total: number
  leaveNoTimesheet: number
  timesheetNoLeave: number
  mismatch: number
  matchedDays: number               // total perfectly-aligned days across everyone
  rows: ReconciliationRow[]
  cleanEmployees: CleanEmployee[]   // employees with leave events in window and zero issues
}

// -----------------------------------------------------------------------------
// getTimesheetLeaveReconciliation
// -----------------------------------------------------------------------------
export async function getTimesheetLeaveReconciliation(
  fromIso: string,
  toIso: string,
  opts: { employeeId?: string } = {},
): Promise<ReconciliationSummary> {
  const supabase = await createClient()

  // 1. Submitted (pending) or approved leave applications overlapping the
  // window. We include both — the goal is to show "the employee has logged
  // a leave application but didn't mark it on the timesheet" the moment the
  // employee submits, not only after HR has approved. Drafts (none in this
  // app — applications are 'pending' on insert) and rejected/cancelled are
  // excluded.
  let leaveQ = supabase
    .from('leave_applications')
    .select(`
      employee_id, from_date, to_date, status,
      leave_type:leave_types(code),
      employee:employees!inner(employee_code, full_name_snapshot)
    `)
    .in('status', ['approved', 'pending'])
    .lte('from_date', toIso)
    .gte('to_date', fromIso)
  if (opts.employeeId) leaveQ = leaveQ.eq('employee_id', opts.employeeId)

  const { data: leaves, error: leaveErr } = await leaveQ
  if (leaveErr) throw new Error(leaveErr.message)

  type LeaveRow = {
    employee_id: string; from_date: string; to_date: string; status: string;
    leave_type: { code: string } | { code: string }[] | null
    employee:
      | { employee_code: string; full_name_snapshot: string }
      | { employee_code: string; full_name_snapshot: string }[]
  }

  // Expand each leave application into per-day map keys.
  type LeaveCell = { code: string; status: 'approved' | 'pending'; empCode: string; empName: string }
  const leaveByEmpDate = new Map<string, LeaveCell>()
  for (const l of (leaves ?? []) as unknown as LeaveRow[]) {
    const lt = Array.isArray(l.leave_type) ? l.leave_type[0] : l.leave_type
    const emp = Array.isArray(l.employee) ? l.employee[0] : l.employee
    if (!emp) continue
    const code = lt?.code ?? '?'
    const status = (l.status === 'approved' ? 'approved' : 'pending') as 'approved' | 'pending'
    let cursor = new Date(l.from_date + 'T00:00:00Z').getTime()
    const end = new Date(l.to_date + 'T00:00:00Z').getTime()
    while (cursor <= end) {
      const iso = new Date(cursor).toISOString().slice(0, 10)
      if (iso >= fromIso && iso <= toIso) {
        // If both an approved and a pending application exist for the same
        // day (rare, but possible during edits), prefer 'approved'.
        const existing = leaveByEmpDate.get(`${l.employee_id}:${iso}`)
        if (!existing || status === 'approved') {
          leaveByEmpDate.set(`${l.employee_id}:${iso}`, {
            code,
            status,
            empCode: emp.employee_code,
            empName: emp.full_name_snapshot,
          })
        }
      }
      cursor += 86_400_000
    }
  }

  // 2. Timesheet entries with leave activity codes.
  let tsQ = supabase
    .from('timesheet_entries')
    .select(`
      employee_id, entry_date, hours,
      activity:activity_types(code),
      employee:employees!inner(employee_code, full_name_snapshot)
    `)
    .gte('entry_date', fromIso)
    .lte('entry_date', toIso)
  if (opts.employeeId) tsQ = tsQ.eq('employee_id', opts.employeeId)

  const { data: tsEntries, error: tsErr } = await tsQ
  if (tsErr) throw new Error(tsErr.message)

  type TsRow = {
    employee_id: string; entry_date: string; hours: number;
    activity: { code: string } | { code: string }[] | null
    employee:
      | { employee_code: string; full_name_snapshot: string }
      | { employee_code: string; full_name_snapshot: string }[]
  }

  type TsCell = { code: string; hours: number; empCode: string; empName: string }
  const tsLeaveByEmpDate = new Map<string, TsCell>()
  for (const r of (tsEntries ?? []) as unknown as TsRow[]) {
    const act = Array.isArray(r.activity) ? r.activity[0] : r.activity
    const code = act?.code ?? '?'
    if (!LEAVE_ACTIVITY_CODES.has(code)) continue
    const emp = Array.isArray(r.employee) ? r.employee[0] : r.employee
    if (!emp) continue
    const key = `${r.employee_id}:${r.entry_date}`
    const existing = tsLeaveByEmpDate.get(key)
    if (existing && existing.code === code) {
      // Same activity, multiple entries (split rows) — sum hours.
      existing.hours += Number(r.hours)
    } else {
      tsLeaveByEmpDate.set(key, {
        code,
        hours: Number(r.hours),
        empCode: emp.employee_code,
        empName: emp.full_name_snapshot,
      })
    }
  }

  // 3. Diff.
  const out: ReconciliationRow[] = []

  // Per-employee tally so we can list "clean" employees alongside the
  // mismatched ones — the report should also confirm everyone whose leave
  // applications and timesheet agree perfectly across the window.
  type Tally = { code: string; name: string; matched: number; issues: number }
  const tally = new Map<string, Tally>()
  const ensure = (id: string, code: string, name: string): Tally => {
    let t = tally.get(id)
    if (!t) {
      t = { code, name, matched: 0, issues: 0 }
      tally.set(id, t)
    }
    return t
  }

  for (const [key, leave] of leaveByEmpDate) {
    const [empId, date] = key.split(':')
    const ts = tsLeaveByEmpDate.get(key)
    const statusWord = leave.status === 'approved' ? 'Approved' : 'Submitted'
    const t = ensure(empId, leave.empCode, leave.empName)
    if (!ts) {
      t.issues += 1
      out.push({
        employeeId: empId,
        employeeCode: leave.empCode,
        employeeName: leave.empName,
        date,
        leaveType: leave.code,
        leaveStatus: leave.status,
        timesheetActivity: null,
        timesheetHours: 0,
        kind: 'leave_no_timesheet',
        detail: `${statusWord} ${leave.code} leave but no leave entry in timesheet.`,
      })
    } else if (ts.code !== leave.code) {
      t.issues += 1
      out.push({
        employeeId: empId,
        employeeCode: ts.empCode,
        employeeName: ts.empName,
        date,
        leaveType: leave.code,
        leaveStatus: leave.status,
        timesheetActivity: ts.code,
        timesheetHours: round2(ts.hours),
        kind: 'mismatch',
        detail: `${statusWord} leave application says ${leave.code} but timesheet logs ${ts.code} (${ts.hours.toFixed(2)}h).`,
      })
    } else {
      // Leave application and timesheet activity agree — this is a clean match.
      t.matched += 1
    }
  }

  for (const [key, ts] of tsLeaveByEmpDate) {
    if (leaveByEmpDate.has(key)) continue
    const [empId, date] = key.split(':')
    const t = ensure(empId, ts.empCode, ts.empName)
    t.issues += 1
    out.push({
      employeeId: empId,
      employeeCode: ts.empCode,
      employeeName: ts.empName,
      date,
      leaveType: null,
      leaveStatus: null,
      timesheetActivity: ts.code,
      timesheetHours: round2(ts.hours),
      kind: 'timesheet_no_leave',
      detail: `Timesheet logs ${ts.code} (${ts.hours.toFixed(2)}h) but no leave application (submitted or approved) for this day.`,
    })
  }

  out.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    return a.employeeName.localeCompare(b.employeeName)
  })

  const cleanEmployees: CleanEmployee[] = Array.from(tally.entries())
    .filter(([, t]) => t.issues === 0 && t.matched > 0)
    .map(([id, t]) => ({
      employeeId: id,
      employeeCode: t.code,
      employeeName: t.name,
      matchedDays: t.matched,
    }))
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName))

  const matchedDays = Array.from(tally.values()).reduce((s, t) => s + t.matched, 0)

  return {
    total: out.length,
    leaveNoTimesheet: out.filter((r) => r.kind === 'leave_no_timesheet').length,
    timesheetNoLeave: out.filter((r) => r.kind === 'timesheet_no_leave').length,
    mismatch: out.filter((r) => r.kind === 'mismatch').length,
    matchedDays,
    rows: out,
    cleanEmployees,
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
