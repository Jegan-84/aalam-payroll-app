import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireRouteRoles } from '@/lib/auth/dal'
import { createClient } from '@/lib/supabase/server'
import { getMonthPlanReport } from '@/lib/plan/report-queries'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Stat } from '@/components/ui/stat'
import { MonthPicker } from './_components/month-picker'

export const metadata = { title: 'Monthly Plan report' }

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

type SP = Promise<{ month?: string; employee?: string }>

export default async function PlanReportPage({ searchParams }: { searchParams: SP }) {
  await requireRouteRoles('admin', 'hr', 'payroll')
  const sp = await searchParams

  // Default to the current month
  const today = new Date()
  let year = today.getUTCFullYear()
  let month = today.getUTCMonth() + 1
  if (sp.month && /^\d{4}-\d{2}$/.test(sp.month)) {
    const [y, m] = sp.month.split('-').map(Number)
    if (y >= 2020 && y <= 2100 && m >= 1 && m <= 12) {
      year = y
      month = m
    } else {
      redirect('/leave/plan-report')
    }
  }

  const employeeId = sp.employee && /^[0-9a-f-]{36}$/i.test(sp.employee) ? sp.employee : undefined
  const supabase = await createClient()
  const empOptionsP = supabase
    .from('employees')
    .select('id, employee_code, full_name_snapshot')
    .eq('employment_status', 'active')
    .order('full_name_snapshot')

  const [report, empOptionsRes] = await Promise.all([
    getMonthPlanReport(year, month, { employeeId }),
    empOptionsP,
  ])
  const employeeOptions = (empOptionsRes.data ?? []) as Array<{ id: string; employee_code: string; full_name_snapshot: string }>

  const monthIso = `${year}-${String(month).padStart(2, '0')}`
  const exportParams = new URLSearchParams({ month: monthIso })
  if (employeeId) exportParams.set('employee', employeeId)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Monthly Plan report"
        back={{ href: '/dashboard', label: 'Dashboard' }}
        subtitle={`${MONTHS[month - 1]} ${year} · ${report.weekdaysInMonth} weekdays · ${report.totals.employees} active employee${report.totals.employees === 1 ? '' : 's'}`}
        actions={
          <Link
            href={`/api/leave/plan-report/export?${exportParams.toString()}`}
            className="inline-flex h-9 items-center whitespace-nowrap rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
          >
            Download CSV
          </Link>
        }
      />

      <MonthPicker monthIso={monthIso} employeeId={employeeId} employees={employeeOptions} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Plans filed"
          value={`${report.totals.employeesWithPlans} / ${report.totals.employees}`}
          hint="employees with at least one entry"
          tone={report.totals.employeesWithPlans === report.totals.employees && report.totals.employees > 0 ? 'brand' : 'default'}
        />
        <Stat label="WFH days planned"   value={report.totals.wfhDays}            tone="brand" />
        <Stat label="Full-day leave"     value={report.totals.fullDayLeaveDays}   tone={report.totals.fullDayLeaveDays > 0 ? 'warn' : 'default'} />
        <Stat
          label="Total leave days"
          value={report.totals.totalLeaveDays.toFixed(1)}
          hint={`${report.totals.halfDayLeaveDays} half-day entr${report.totals.halfDayLeaveDays === 1 ? 'y' : 'ies'} included`}
          tone={report.totals.totalLeaveDays > 0 ? 'warn' : 'default'}
        />
      </div>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">Per-employee plan</div>
          <div className="text-[11px] text-slate-500">
            Rows are <strong>all active employees</strong>. Empty rows mean the employee hasn&apos;t filed a plan for this month yet.
          </div>
        </div>
        {report.rows.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-slate-500">No active employees match this filter.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
              <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2">Employee</th>
                  <th className="px-4 py-2 text-right">WFH</th>
                  <th className="px-4 py-2 text-right">1st-half</th>
                  <th className="px-4 py-2 text-right">2nd-half</th>
                  <th className="px-4 py-2 text-right">Full-day</th>
                  <th className="px-4 py-2 text-right">Leave days</th>
                  <th className="px-4 py-2">Leave breakdown</th>
                  <th className="px-4 py-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
                {report.rows.map((r) => {
                  const noPlan = r.plannedDays === 0
                  const breakdownChips = Object.entries(r.leaveByType).sort(([a], [b]) => a.localeCompare(b))
                  return (
                    <tr key={r.employeeId} className={noPlan ? 'bg-amber-50/30 dark:bg-amber-950/10' : ''}>
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/employees/${r.employeeId}`}
                          className="font-medium text-slate-900 hover:text-brand-700 dark:text-slate-100"
                        >
                          {r.employeeName}
                        </Link>
                        <span className="ml-2 text-xs text-slate-500">{r.employeeCode}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{r.wfhDays || <span className="text-slate-300">—</span>}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{r.firstHalfLeaveDays || <span className="text-slate-300">—</span>}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{r.secondHalfLeaveDays || <span className="text-slate-300">—</span>}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{r.fullDayLeaveDays || <span className="text-slate-300">—</span>}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                        {r.totalLeaveDays > 0 ? r.totalLeaveDays.toFixed(1) : <span className="text-slate-300 font-normal">—</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        {breakdownChips.length === 0 ? (
                          <span className="text-slate-300">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {breakdownChips.map(([code, days]) => (
                              <span
                                key={code}
                                className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                              >
                                {code} · {days % 1 === 0 ? days : days.toFixed(1)}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {noPlan ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                            No plan
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                            Filed
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="text-[11px] text-slate-500">
        Half-day leave (1st-half / 2nd-half) counts as 0.5 in the totals. WFH days don&apos;t consume leave balance — they&apos;re for capacity / coverage planning only.
        Employees still file formal leave applications via <Link href="/leave" className="underline">Leave</Link> for actual balance impact.
      </p>
    </div>
  )
}
