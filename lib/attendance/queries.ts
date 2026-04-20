import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/auth/dal'
import {
  daysInMonth,
  defaultStatusForDate,
  iterateMonthDates,
  summarizeMonth,
  type AttendanceCell,
  type MonthSummary,
} from '@/lib/attendance/engine'

export const getWeeklyOffDays = cache(async (): Promise<number[]> => {
  await verifySession()
  const supabase = await createClient()
  const { data } = await supabase.from('organizations').select('weekly_off_days').limit(1).maybeSingle()
  return ((data?.weekly_off_days ?? [0]) as number[]).filter((d) => Number.isInteger(d))
})

export const getHolidaysForMonth = cache(async (year: number, month: number): Promise<Set<string>> => {
  await verifySession()
  const supabase = await createClient()
  const first = `${year}-${String(month).padStart(2, '0')}-01`
  const last = `${year}-${String(month).padStart(2, '0')}-${daysInMonth(year, month)}`
  const { data } = await supabase
    .from('holidays')
    .select('holiday_date')
    .gte('holiday_date', first)
    .lte('holiday_date', last)
  return new Set((data ?? []).map((h) => h.holiday_date as string))
})

export type AttendanceEmployeeSummary = {
  employee: {
    id: string
    employee_code: string
    full_name_snapshot: string
    date_of_joining: string
    date_of_exit: string | null
    employment_status: string
  }
  summary: MonthSummary
}

export async function getMonthSummaryForAllEmployees(
  year: number,
  month: number,
): Promise<AttendanceEmployeeSummary[]> {
  await verifySession()
  const supabase = await createClient()

  const first = `${year}-${String(month).padStart(2, '0')}-01`
  const last = `${year}-${String(month).padStart(2, '0')}-${daysInMonth(year, month)}`

  const [{ data: employees }, { data: cells }, weeklyOffDays, holidays] = await Promise.all([
    supabase
      .from('employees')
      .select('id, employee_code, full_name_snapshot, date_of_joining, date_of_exit, employment_status')
      .order('full_name_snapshot'),
    supabase
      .from('attendance_days')
      .select('employee_id, attendance_date, status, leave_type_id, locked')
      .gte('attendance_date', first)
      .lte('attendance_date', last),
    getWeeklyOffDays(),
    getHolidaysForMonth(year, month),
  ])

  const cellsByEmp = new Map<string, AttendanceCell[]>()
  for (const c of cells ?? []) {
    const list = cellsByEmp.get(c.employee_id as string) ?? []
    list.push({
      attendance_date: c.attendance_date as string,
      status: c.status as AttendanceCell['status'],
      leave_type_id: c.leave_type_id as number | null,
      locked: c.locked as boolean,
    })
    cellsByEmp.set(c.employee_id as string, list)
  }

  return (employees ?? []).map((e) => {
    const stored = cellsByEmp.get(e.id as string) ?? []
    const storedByDate = new Map(stored.map((c) => [c.attendance_date, c]))
    const dates = iterateMonthDates(year, month)

    // Materialize defaults for days without an explicit row so the summary is honest
    const virtual: AttendanceCell[] = dates.map((iso) => {
      const existing = storedByDate.get(iso)
      if (existing) return existing
      return {
        attendance_date: iso,
        status: defaultStatusForDate(iso, {
          weeklyOffDays,
          holidayDates: holidays,
          joiningDate: e.date_of_joining as string,
          exitDate: (e.date_of_exit as string | null) ?? null,
        }),
      }
    })

    return {
      employee: {
        id: e.id as string,
        employee_code: e.employee_code as string,
        full_name_snapshot: e.full_name_snapshot as string,
        date_of_joining: e.date_of_joining as string,
        date_of_exit: (e.date_of_exit as string | null) ?? null,
        employment_status: e.employment_status as string,
      },
      summary: summarizeMonth(year, month, virtual),
    }
  })
}

export async function getEmployeeMonthGrid(
  employeeId: string,
  year: number,
  month: number,
) {
  await verifySession()
  const supabase = await createClient()

  const first = `${year}-${String(month).padStart(2, '0')}-01`
  const last = `${year}-${String(month).padStart(2, '0')}-${daysInMonth(year, month)}`

  const [{ data: employee }, { data: cells }, weeklyOffDays, holidays, { data: leaveTypes }] = await Promise.all([
    supabase
      .from('employees')
      .select('id, employee_code, full_name_snapshot, date_of_joining, date_of_exit, employment_status')
      .eq('id', employeeId)
      .maybeSingle(),
    supabase
      .from('attendance_days')
      .select('attendance_date, status, leave_type_id, locked, note')
      .eq('employee_id', employeeId)
      .gte('attendance_date', first)
      .lte('attendance_date', last),
    getWeeklyOffDays(),
    getHolidaysForMonth(year, month),
    supabase.from('leave_types').select('id, code, name').eq('is_active', true).order('display_order'),
  ])

  if (!employee) return null

  const storedByDate = new Map(
    (cells ?? []).map((c) => [
      c.attendance_date as string,
      {
        attendance_date: c.attendance_date as string,
        status: c.status as AttendanceCell['status'],
        leave_type_id: c.leave_type_id as number | null,
        locked: c.locked as boolean,
        note: (c.note as string | null) ?? null,
      },
    ]),
  )

  const virtualCells: AttendanceCell[] = iterateMonthDates(year, month).map((iso) => {
    const existing = storedByDate.get(iso)
    if (existing) return existing
    return {
      attendance_date: iso,
      status: defaultStatusForDate(iso, {
        weeklyOffDays,
        holidayDates: holidays,
        joiningDate: employee.date_of_joining as string,
        exitDate: (employee.date_of_exit as string | null) ?? null,
      }),
    }
  })

  return {
    employee: {
      id: employee.id as string,
      employee_code: employee.employee_code as string,
      full_name_snapshot: employee.full_name_snapshot as string,
      date_of_joining: employee.date_of_joining as string,
      date_of_exit: (employee.date_of_exit as string | null) ?? null,
    },
    cells: virtualCells,
    summary: summarizeMonth(year, month, virtualCells),
    leaveTypes: (leaveTypes ?? []) as { id: number; code: string; name: string }[],
    weeklyOffDays,
    holidayDates: Array.from(holidays),
  }
}
