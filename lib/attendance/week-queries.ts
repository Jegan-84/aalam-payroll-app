import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { getHolidaysForEmployeeInRange } from '@/lib/leave/queries'

export type WeekDayStatus = 'weekend' | 'holiday' | 'leave' | 'present' | 'absent'

export type WeekDayRow = {
  date: string                  // YYYY-MM-DD (UTC)
  dayLabel: string              // "MON", "TUE", ...
  dayNumber: string             // "06"
  status: WeekDayStatus
  centerLabel: string           // "Office-in" | "Absent" | "Weekend" | "Holiday: Republic Day" | "Leave (PL)"
  firstIn: string | null        // ISO
  lastOut: string | null        // ISO
  hoursWorked: number | null    // 0..24, two decimals
}

export type WeekData = {
  rangeFrom: string             // YYYY-MM-DD
  rangeTo: string               // YYYY-MM-DD
  rangeLabel: string            // "05 Jan 2025 - 11 Jan 2025"
  prevAnchor: string            // YYYY-MM-DD pointing inside the previous week
  nextAnchor: string
  todayIso: string
  rows: WeekDayRow[]
}

const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function fmtDmy(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z')
  return `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

// Resolve the Sunday-anchored week containing the given date.
function weekRangeAround(date: Date): { from: Date; to: Date } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const dow = d.getUTCDay() // 0..6 (Sun..Sat)
  const from = new Date(d.getTime() - dow * 86_400_000)
  const to = new Date(from.getTime() + 6 * 86_400_000)
  return { from, to }
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export async function getEmployeeWeek(employeeId: string, anchorIso: string): Promise<WeekData> {
  const supabase = await createClient()
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(anchorIso)
    ? new Date(anchorIso + 'T00:00:00Z')
    : new Date()
  const { from, to } = weekRangeAround(anchor)
  const fromIso = isoDate(from)
  const toIso = isoDate(to)

  // Biometric punches were retired; firstIn/lastOut/hoursWorked are always
  // null until the new biometric flow lands. The week view still surfaces
  // leave + holiday + weekend correctly.
  // Holidays in window (project + location scoped)
  const holidaySet = await getHolidaysForEmployeeInRange(employeeId, fromIso, toIso)
  // Pull names too — getHolidaysForEmployeeInRange returns just dates, so re-query for labels.
  const { data: holRows } = await supabase
    .from('holidays')
    .select('holiday_date, name')
    .gte('holiday_date', fromIso)
    .lte('holiday_date', toIso)
  const holidayName = new Map<string, string>()
  for (const h of (holRows ?? []) as Array<{ holiday_date: string; name: string }>) {
    if (holidaySet.has(h.holiday_date)) holidayName.set(h.holiday_date, h.name)
  }

  // Approved leave applications overlapping the window
  const { data: leaveRows } = await supabase
    .from('leave_applications')
    .select('from_date, to_date, status, leave_type:leave_types(code)')
    .eq('employee_id', employeeId)
    .in('status', ['approved'])
    .lte('from_date', toIso)
    .gte('to_date', fromIso)
  type LeaveRow = { from_date: string; to_date: string; status: string; leave_type: { code: string } | { code: string }[] | null }
  const leaveByDate = new Map<string, string>()
  for (const lv of (leaveRows ?? []) as unknown as LeaveRow[]) {
    const code = (Array.isArray(lv.leave_type) ? lv.leave_type[0]?.code : lv.leave_type?.code) ?? 'LEAVE'
    let cursor = new Date(lv.from_date + 'T00:00:00Z').getTime()
    const end = new Date(lv.to_date + 'T00:00:00Z').getTime()
    while (cursor <= end) {
      const k = isoDate(new Date(cursor))
      if (k >= fromIso && k <= toIso) leaveByDate.set(k, code)
      cursor += 86_400_000
    }
  }

  const rows: WeekDayRow[] = []
  for (let i = 0; i < 7; i++) {
    const cur = new Date(from.getTime() + i * 86_400_000)
    const iso = isoDate(cur)
    const dow = cur.getUTCDay()
    const dayLabel = DAY_LABELS[dow]
    const dayNumber = String(cur.getUTCDate()).padStart(2, '0')

    let status: WeekDayStatus
    let centerLabel: string

    const isWeekend = dow === 0 || dow === 6
    const holidayN = holidayName.get(iso)
    const leaveCode = leaveByDate.get(iso)

    if (holidayN) {
      status = 'holiday'
      centerLabel = `Holiday: ${holidayN}`
    } else if (leaveCode) {
      status = 'leave'
      centerLabel = `Leave (${leaveCode})`
    } else if (isWeekend) {
      status = 'weekend'
      centerLabel = 'Weekend'
    } else {
      // No punches available since biometric sync is retired. Default to a
      // neutral "Working day" until the new flow records actual presence.
      status = 'absent'
      centerLabel = 'Working day'
    }

    rows.push({
      date: iso, dayLabel, dayNumber, status, centerLabel,
      firstIn: null, lastOut: null, hoursWorked: null,
    })
  }

  const prevAnchor = isoDate(new Date(from.getTime() - 7 * 86_400_000))
  const nextAnchor = isoDate(new Date(from.getTime() + 7 * 86_400_000))

  return {
    rangeFrom: fromIso,
    rangeTo: toIso,
    rangeLabel: `${fmtDmy(fromIso)} - ${fmtDmy(toIso)}`,
    prevAnchor,
    nextAnchor,
    todayIso: isoDate(new Date()),
    rows,
  }
}
