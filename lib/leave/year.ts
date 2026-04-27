/**
 * Leave-year resolver. Leave policy runs on a CALENDAR year (Jan 1 → Dec 31),
 * independent of the payroll / tax FY (Apr 1 → Mar 31).
 *
 * Half-periods H1 / H2 are Jan–Jun and Jul–Dec; the half-yearly accrual
 * cadence credits on the FIRST day of each half.
 */

export type LeaveYearContext = {
  yearStart: string   // 'YYYY-01-01'
  yearEnd:   string   // 'YYYY-12-31'
  label:     string   // '2026'
  half:      'H1' | 'H2'
  halfStart: string   // 'YYYY-01-01' or 'YYYY-07-01'
  halfEnd:   string   // 'YYYY-06-30' or 'YYYY-12-31'
}

export function resolveLeaveYear(date: Date = new Date()): LeaveYearContext {
  const y = date.getUTCFullYear()
  const m = date.getUTCMonth() + 1 // 1..12
  const half: 'H1' | 'H2' = m <= 6 ? 'H1' : 'H2'
  return {
    yearStart: `${y}-01-01`,
    yearEnd:   `${y}-12-31`,
    label:     String(y),
    half,
    halfStart: half === 'H1' ? `${y}-01-01` : `${y}-07-01`,
    halfEnd:   half === 'H1' ? `${y}-06-30` : `${y}-12-31`,
  }
}

/** Return the calendar-year window (Jan 1 – Dec 31) that contains `date`. */
export function leaveYearOf(date: Date): { start: string; end: string; label: string } {
  const y = date.getUTCFullYear()
  return {
    start: `${y}-01-01`,
    end:   `${y}-12-31`,
    label: String(y),
  }
}
