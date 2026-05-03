import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { PlanKind } from './queries'

// =============================================================================
// Monthly Plan Report — admin/HR/payroll view
// =============================================================================
// Per-employee aggregation of monthly_plans for a single (year, month). All
// active employees are returned, even those with zero plans, so HR can see who
// hasn't filed their plan yet.
// =============================================================================

export type PlanReportRow = {
  employeeId: string
  employeeCode: string
  employeeName: string
  wfhDays: number
  firstHalfLeaveDays: number      // count of half-day-morning entries
  secondHalfLeaveDays: number     // count of half-day-afternoon entries
  fullDayLeaveDays: number
  totalLeaveDays: number          // full + (halves × 0.5)
  plannedDays: number             // wfh + any-leave
  // Optional per-leave-type breakdown (code → days, halves count as 0.5)
  leaveByType: Record<string, number>
}

export type PlanReportSummary = {
  rows: PlanReportRow[]
  totals: {
    employees: number
    employeesWithPlans: number
    wfhDays: number
    fullDayLeaveDays: number
    halfDayLeaveDays: number      // count of half-day entries (FH + SH)
    totalLeaveDays: number        // full + halves × 0.5
  }
  daysInMonth: number
  weekdaysInMonth: number
}

export async function getMonthPlanReport(
  year: number,
  month: number,                 // 1..12
  opts: { employeeId?: string } = {},
): Promise<PlanReportSummary> {
  const supabase = await createClient()
  const fromIso = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const toIso = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  // Active employees (or just the filtered one)
  let empQ = supabase
    .from('employees')
    .select('id, employee_code, full_name_snapshot, employment_status')
    .eq('employment_status', 'active')
    .order('full_name_snapshot')
  if (opts.employeeId) empQ = empQ.eq('id', opts.employeeId)
  const { data: empData, error: empErr } = await empQ
  if (empErr) throw new Error(empErr.message)

  type EmpRow = { id: string; employee_code: string; full_name_snapshot: string }
  const employees = (empData ?? []) as EmpRow[]

  // All plans in the window
  let planQ = supabase
    .from('monthly_plans')
    .select(`
      employee_id, plan_date, kind, leave_type_id,
      leave_type:leave_types(code)
    `)
    .gte('plan_date', fromIso)
    .lte('plan_date', toIso)
  if (opts.employeeId) planQ = planQ.eq('employee_id', opts.employeeId)
  const { data: planData, error: planErr } = await planQ
  if (planErr) throw new Error(planErr.message)

  type PlanRow = {
    employee_id: string
    plan_date: string
    kind: PlanKind
    leave_type_id: number | null
    leave_type: { code: string } | { code: string }[] | null
  }
  const plans = (planData ?? []) as unknown as PlanRow[]

  // Aggregate
  const byEmp = new Map<string, PlanReportRow>()
  for (const e of employees) {
    byEmp.set(e.id, {
      employeeId: e.id,
      employeeCode: e.employee_code,
      employeeName: e.full_name_snapshot,
      wfhDays: 0,
      firstHalfLeaveDays: 0,
      secondHalfLeaveDays: 0,
      fullDayLeaveDays: 0,
      totalLeaveDays: 0,
      plannedDays: 0,
      leaveByType: {},
    })
  }

  for (const p of plans) {
    const row = byEmp.get(p.employee_id)
    if (!row) continue
    const lt = Array.isArray(p.leave_type) ? p.leave_type[0] : p.leave_type
    const code = lt?.code ?? null

    if (p.kind === 'WFH') {
      row.wfhDays += 1
    } else {
      // Leave-flavored
      const fraction = p.kind === 'FULL_DAY_LEAVE' ? 1 : 0.5
      if (p.kind === 'FIRST_HALF_LEAVE') row.firstHalfLeaveDays += 1
      else if (p.kind === 'SECOND_HALF_LEAVE') row.secondHalfLeaveDays += 1
      else row.fullDayLeaveDays += 1
      row.totalLeaveDays += fraction
      if (code) row.leaveByType[code] = (row.leaveByType[code] ?? 0) + fraction
    }
    row.plannedDays += 1
  }

  const rows = Array.from(byEmp.values()).sort((a, b) =>
    a.employeeName.localeCompare(b.employeeName),
  )

  // Working-days count for context (Mon–Fri inside the window)
  let weekdays = 0
  for (let d = 1; d <= lastDay; d++) {
    const dow = new Date(Date.UTC(year, month - 1, d)).getUTCDay()
    if (dow !== 0 && dow !== 6) weekdays += 1
  }

  const totals = rows.reduce(
    (acc, r) => {
      acc.wfhDays += r.wfhDays
      acc.fullDayLeaveDays += r.fullDayLeaveDays
      acc.halfDayLeaveDays += r.firstHalfLeaveDays + r.secondHalfLeaveDays
      acc.totalLeaveDays += r.totalLeaveDays
      if (r.plannedDays > 0) acc.employeesWithPlans += 1
      return acc
    },
    {
      employees: rows.length,
      employeesWithPlans: 0,
      wfhDays: 0,
      fullDayLeaveDays: 0,
      halfDayLeaveDays: 0,
      totalLeaveDays: 0,
    },
  )

  return {
    rows,
    totals,
    daysInMonth: lastDay,
    weekdaysInMonth: weekdays,
  }
}
