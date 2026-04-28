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

  // Punches in window
  const { data: punchesData } = await supabase
    .from('device_punches')
    .select('punch_time')
    .eq('employee_id', employeeId)
    .gte('punch_time', fromIso + 'T00:00:00.000Z')
    .lte('punch_time', toIso + 'T23:59:59.999Z')
    .order('punch_time')
  const punches = (punchesData ?? []) as Array<{ punch_time: string }>

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

  // Bucket punches by day
  const punchesByDay = new Map<string, string[]>()
  for (const p of punches) {
    const day = p.punch_time.slice(0, 10)
    if (!punchesByDay.has(day)) punchesByDay.set(day, [])
    punchesByDay.get(day)!.push(p.punch_time)
  }

  const rows: WeekDayRow[] = []
  for (let i = 0; i < 7; i++) {
    const cur = new Date(from.getTime() + i * 86_400_000)
    const iso = isoDate(cur)
    const dow = cur.getUTCDay()
    const dayLabel = DAY_LABELS[dow]
    const dayNumber = String(cur.getUTCDate()).padStart(2, '0')

    const dayPunches = (punchesByDay.get(iso) ?? []).sort()
    const firstIn = dayPunches[0] ?? null
    const lastOut = dayPunches.length > 1 ? dayPunches[dayPunches.length - 1] : null
    const hoursWorked = firstIn && lastOut
      ? Math.round((new Date(lastOut).getTime() - new Date(firstIn).getTime()) / 3_600_000 * 100) / 100
      : null

    let status: WeekDayStatus
    let centerLabel: string

    const isWeekend = dow === 0 || dow === 6
    const holidayN = holidayName.get(iso)
    const leaveCode = leaveByDate.get(iso)

    if (firstIn) {
      // Worked, regardless of weekend / leave — punches win.
      status = 'present'
      centerLabel = 'Office-in'
    } else if (holidayN) {
      status = 'holiday'
      centerLabel = `Holiday: ${holidayN}`
    } else if (leaveCode) {
      status = 'leave'
      centerLabel = `Leave (${leaveCode})`
    } else if (isWeekend) {
      status = 'weekend'
      centerLabel = 'Weekend'
    } else {
      status = 'absent'
      centerLabel = 'Absent'
    }

    rows.push({
      date: iso, dayLabel, dayNumber, status, centerLabel,
      firstIn, lastOut, hoursWorked,
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
