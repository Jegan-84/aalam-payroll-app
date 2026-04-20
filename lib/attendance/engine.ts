/**
 * Attendance engine — pure functions. Zero framework deps.
 *
 * The grid for a month is conceptually:
 *   - N cells per employee (N = days in month)
 *   - Each cell has a status: P / A / H / HOL / WO / LEAVE / LOP / NA
 *
 * We compute:
 *   - workingDays    = days that should have been worked (excludes WO, HOL, NA)
 *   - presentDays    = P + 0.5 × H
 *   - paidLeaveDays  = days marked LEAVE
 *   - lopDays        = A + 0.5 × H + LOP
 *   - paidDays       = presentDays + paidLeaveDays + holidayDays + weeklyOffDays
 *
 * Payroll gross is prorated by `paidDays / daysInMonth`.
 */

export type AttendanceStatus = 'P' | 'A' | 'H' | 'HOL' | 'WO' | 'LEAVE' | 'LOP' | 'NA'

export type AttendanceCell = {
  attendance_date: string // 'YYYY-MM-DD'
  status: AttendanceStatus
  leave_type_id?: number | null
  locked?: boolean
  note?: string | null
}

export type MonthSummary = {
  year: number
  month: number                 // 1-12
  daysInMonth: number
  workingDays: number
  holidayDays: number
  weeklyOffDays: number
  presentDays: number
  paidLeaveDays: number
  lopDays: number
  paidDays: number
  naDays: number
  anyLocked: boolean
}

export const MONTH_NAMES = [
  'January','February','March','April','May','June','July','August','September','October','November','December',
] as const

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export function iterateMonthDates(year: number, month: number): string[] {
  const n = daysInMonth(year, month)
  const out: string[] = []
  for (let d = 1; d <= n; d++) {
    out.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }
  return out
}

/**
 * Decide the default status for a cell with no explicit entry.
 * Uses org weekly-off rule and holiday calendar, then P by default.
 */
export function defaultStatusForDate(
  iso: string,
  ctx: {
    weeklyOffDays: number[]              // 0=Sun..6=Sat
    holidayDates: Set<string>            // YYYY-MM-DD
    joiningDate?: string                 // YYYY-MM-DD
    exitDate?: string | null             // YYYY-MM-DD
  },
): AttendanceStatus {
  if (ctx.joiningDate && iso < ctx.joiningDate) return 'NA'
  if (ctx.exitDate && iso > ctx.exitDate) return 'NA'
  if (ctx.holidayDates.has(iso)) return 'HOL'
  const dow = new Date(iso + 'T00:00:00Z').getUTCDay()
  if (ctx.weeklyOffDays.includes(dow)) return 'WO'
  return 'P'
}

export function summarizeMonth(
  year: number,
  month: number,
  cells: AttendanceCell[],
): MonthSummary {
  const n = daysInMonth(year, month)
  const byDate = new Map(cells.map((c) => [c.attendance_date, c]))

  let present = 0
  let paidLeave = 0
  let lop = 0
  let holiday = 0
  let weeklyOff = 0
  let na = 0
  let anyLocked = false

  for (let d = 1; d <= n; d++) {
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const cell = byDate.get(iso)
    if (!cell) continue
    if (cell.locked) anyLocked = true
    switch (cell.status) {
      case 'P':     present += 1; break
      case 'H':     present += 0.5; lop += 0.5; break
      case 'LEAVE': paidLeave += 1; break
      case 'HOL':   holiday += 1; break
      case 'WO':    weeklyOff += 1; break
      case 'A':     lop += 1; break
      case 'LOP':   lop += 1; break
      case 'NA':    na += 1; break
    }
  }

  const workingDays = n - holiday - weeklyOff - na
  const paidDays = present + paidLeave + holiday + weeklyOff

  return {
    year, month, daysInMonth: n,
    workingDays, holidayDays: holiday, weeklyOffDays: weeklyOff,
    presentDays: present, paidLeaveDays: paidLeave, lopDays: lop,
    paidDays, naDays: na, anyLocked,
  }
}
