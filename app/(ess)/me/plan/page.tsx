import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentEmployee } from '@/lib/auth/dal'
import { getMonthPlan, getEligibleLeaveTypes } from '@/lib/plan/queries'
import { getHolidaysForEmployeeInRange } from '@/lib/leave/queries'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { CalendarClient } from './_components/calendar-client'

export const metadata = { title: 'My monthly plan' }

type SP = Promise<{ month?: string }>

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

export default async function MyPlanPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams
  const today = new Date()
  let year = today.getUTCFullYear()
  let month = today.getUTCMonth() + 1   // 1..12

  if (sp.month && /^\d{4}-\d{2}$/.test(sp.month)) {
    const [y, m] = sp.month.split('-').map(Number)
    if (y >= 2020 && y <= 2100 && m >= 1 && m <= 12) {
      year = y
      month = m
    } else {
      redirect('/me/plan')
    }
  }

  const { employeeId } = await getCurrentEmployee()
  const fromIso = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const toIso = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const [plans, leaveTypes, holidaySet] = await Promise.all([
    getMonthPlan(employeeId, year, month),
    getEligibleLeaveTypes(employeeId),
    getHolidaysForEmployeeInRange(employeeId, fromIso, toIso),
  ])

  // Build calendar grid: 6 rows × 7 cols, leading days from prev month, trailing
  // from next month. Sunday-first to match Indian convention. Server-prepares
  // the days so the client component just renders.
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1))
  const firstDow = firstOfMonth.getUTCDay()  // 0..6 Sun..Sat
  const gridStart = new Date(firstOfMonth.getTime() - firstDow * 86_400_000)

  type DayCell = {
    iso: string
    dayNumber: number
    inMonth: boolean
    isToday: boolean
    isWeekend: boolean
    isHoliday: boolean
  }
  const todayIso = today.toISOString().slice(0, 10)
  const cells: DayCell[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart.getTime() + i * 86_400_000)
    const iso = d.toISOString().slice(0, 10)
    const dow = d.getUTCDay()
    cells.push({
      iso,
      dayNumber: d.getUTCDate(),
      inMonth: d.getUTCMonth() === month - 1,
      isToday: iso === todayIso,
      isWeekend: dow === 0 || dow === 6,
      isHoliday: holidaySet.has(iso),
    })
  }

  const prevMonth = month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`
  const nextMonth = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`
  const thisMonth = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}`

  // Roll-up summary for the month
  const counts = {
    wfh: plans.filter((p) => p.kind === 'WFH').length,
    fhLeave: plans.filter((p) => p.kind === 'FIRST_HALF_LEAVE').length,
    shLeave: plans.filter((p) => p.kind === 'SECOND_HALF_LEAVE').length,
    fullLeave: plans.filter((p) => p.kind === 'FULL_DAY_LEAVE').length,
  }
  const totalLeaveDays = counts.fullLeave + (counts.fhLeave + counts.shLeave) * 0.5

  return (
    <div className="space-y-6">
      <PageHeader
        title="Monthly plan"
        subtitle="Plan ahead — mark which days you'll WFH and when you'll be on leave. This is your intent calendar; you'll still file formal leave applications via the Leave page."
      />

      {/* Month navigator */}
      <div className="flex items-center justify-center gap-4 rounded-lg border border-slate-200 bg-white py-2 dark:border-slate-800 dark:bg-slate-900">
        <Link
          href={`/me/plan?month=${prevMonth}`}
          className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800"
          aria-label="Previous month"
        >‹</Link>
        <div className="text-sm font-medium text-slate-900 dark:text-slate-50">
          {MONTHS[month - 1]} {year}
        </div>
        <Link
          href={`/me/plan?month=${nextMonth}`}
          className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800"
          aria-label="Next month"
        >›</Link>
        {`${year}-${String(month).padStart(2, '0')}` !== thisMonth && (
          <Link href="/me/plan" className="ml-2 text-xs font-medium text-brand-700 hover:underline dark:text-brand-400">
            This month
          </Link>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Pill tone="brand" label="WFH days"        value={counts.wfh} icon="🏠" />
        <Pill tone="warn" label="First-half leave" value={counts.fhLeave} icon="🌅" />
        <Pill tone="warn" label="Second-half leave" value={counts.shLeave} icon="🌇" />
        <Pill tone="amber" label="Full-day leave"   value={counts.fullLeave} icon="🌴" />
      </div>
      <p className="text-[11px] text-slate-500">
        Effective leave for this month: <strong>{totalLeaveDays.toFixed(1)}</strong> day{totalLeaveDays === 1 ? '' : 's'} (full-day = 1, half-day = 0.5).
      </p>

      <Card className="overflow-hidden p-0">
        <CalendarClient
          cells={cells}
          plans={plans}
          leaveTypes={leaveTypes}
          monthLabel={`${MONTHS[month - 1]} ${year}`}
          year={year}
          month={month}
        />
      </Card>

      <p className="text-[11px] text-slate-500">
        Note: this is a <strong>planning tool</strong>, not a leave request. To actually consume leave balance, file an application from
        the <Link href="/me/leave" className="underline">Leave page</Link>. WFH and leave plans here help your manager anticipate coverage.
      </p>
    </div>
  )
}

function Pill({ tone, label, value, icon }: { tone: 'brand' | 'warn' | 'amber'; label: string; value: number; icon: string }) {
  const cls =
    tone === 'brand' ? 'bg-sky-50 ring-sky-200 text-sky-900 dark:bg-sky-950/40 dark:ring-sky-900 dark:text-sky-100'
    : tone === 'warn' ? 'bg-amber-50 ring-amber-200 text-amber-900 dark:bg-amber-950/40 dark:ring-amber-900 dark:text-amber-100'
    : 'bg-rose-50 ring-rose-200 text-rose-900 dark:bg-rose-950/40 dark:ring-rose-900 dark:text-rose-100'
  return (
    <div className={`rounded-lg p-3 ring-1 ring-inset ${cls}`}>
      <div className="text-[11px] font-medium uppercase tracking-wide opacity-80">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
        <span className="text-base">{icon}</span>
      </div>
    </div>
  )
}
