import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getDailyTimesheetGrid, formatHHMM, type GridState } from '@/lib/timesheet/grid-queries'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Stat } from '@/components/ui/stat'
import { RangePicker } from './_components/range-picker'

export const metadata = { title: 'Daily timesheet grid' }

const MAX_DAYS = 92   // ~3 months — keep the table from growing pathologically wide

type SP = Promise<{ from?: string; to?: string; employee?: string; live?: string }>

function defaultRange(): { from: string; to: string } {
  // Default to month-to-date, like the other timesheet reports
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  return { from: start.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) }
}

export default async function DailyGridPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams
  const def = defaultRange()
  const from = sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from : def.from
  const to   = sp.to   && /^\d{4}-\d{2}-\d{2}$/.test(sp.to)   ? sp.to   : def.to
  const employeeId = sp.employee && /^[0-9a-f-]{36}$/i.test(sp.employee) ? sp.employee : undefined
  const includeSubmitted = sp.live === '1'

  // Bail with a friendly message if range is too wide — the grid renders one
  // column per day and we don't want to ship 1000 columns of HTML.
  const dayCount = Math.floor((new Date(to + 'T00:00:00Z').getTime() - new Date(from + 'T00:00:00Z').getTime()) / 86_400_000) + 1
  const tooWide = dayCount > MAX_DAYS

  const supabase = await createClient()
  const empOptionsP = supabase
    .from('employees')
    .select('id, employee_code, full_name_snapshot')
    .eq('employment_status', 'active')
    .order('full_name_snapshot')

  const [grid, empOptionsRes] = await Promise.all([
    tooWide
      ? Promise.resolve(null)
      : getDailyTimesheetGrid(from, to, { employeeId, includeSubmitted }),
    empOptionsP,
  ])
  const employeeOptions = (empOptionsRes.data ?? []) as Array<{ id: string; employee_code: string; full_name_snapshot: string }>

  const exportParams = new URLSearchParams({ from, to })
  if (employeeId) exportParams.set('employee', employeeId)
  if (includeSubmitted) exportParams.set('live', '1')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daily timesheet grid"
        back={{ href: '/dashboard', label: 'Dashboard' }}
        subtitle={`${from} → ${to} (${dayCount} day${dayCount === 1 ? '' : 's'}). ${includeSubmitted ? 'Live view: drafts + submitted + approved.' : 'Approved weeks only.'}`}
        actions={
          <Link
            href={`/api/timesheet/daily-grid/export?${exportParams.toString()}`}
            className="inline-flex h-9 items-center whitespace-nowrap rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
          >
            Download Excel
          </Link>
        }
      />

      <RangePicker from={from} to={to} employeeId={employeeId} employees={employeeOptions} live={includeSubmitted} />

      {tooWide ? (
        <Card className="px-6 py-12 text-center text-sm text-slate-600">
          The selected range covers <strong>{dayCount}</strong> days. The grid is capped at <strong>{MAX_DAYS}</strong> days
          to keep the page readable. Narrow the range, or use the CSV export for longer windows.
        </Card>
      ) : !grid ? null : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Employees"            value={grid.totals.employees} />
            <Stat label="Days in range"        value={grid.daysInRange} />
            <Stat label="Total working hours"  value={formatHHMM(grid.totals.workedHours)} tone="brand" />
            <Stat label="Total leave hours"    value={formatHHMM(grid.totals.leaveHours)}  tone={grid.totals.leaveHours > 0 ? 'warn' : 'default'} />
          </div>

          <Legend />

          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
                  <tr>
                    <th className="sticky left-0 z-10 border-r border-slate-200 bg-slate-50/80 px-3 py-2 text-left dark:border-slate-800 dark:bg-slate-950/60">Aalam ID</th>
                    <th className="sticky left-[88px] z-10 border-r border-slate-200 bg-slate-50/80 px-3 py-2 text-left dark:border-slate-800 dark:bg-slate-950/60">Employee Name</th>
                    {grid.dates.map((d) => (
                      <th key={d} className="whitespace-nowrap px-2 py-2 text-center">{formatDateHeader(d)}</th>
                    ))}
                    <th className="whitespace-nowrap px-3 py-2 text-right">Total Working Hours</th>
                    <th className="whitespace-nowrap px-3 py-2 text-right">Total Leave Hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {grid.rows.length === 0 ? (
                    <tr>
                      <td colSpan={grid.dates.length + 4} className="px-6 py-12 text-center text-sm text-slate-500">
                        No active employees match this filter.
                      </td>
                    </tr>
                  ) : grid.rows.map((r, idx) => (
                    <tr key={r.employeeId} className={idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/40 dark:bg-slate-950/30'}>
                      <td className={`sticky left-0 z-[5] whitespace-nowrap border-r border-slate-200 px-3 py-2 dark:border-slate-800 ${idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/40 dark:bg-slate-950/30'}`}>
                        <Link href={`/employees/${r.employeeId}`} className="font-medium text-slate-900 hover:text-brand-700 dark:text-slate-100">
                          {r.employeeCode}
                        </Link>
                      </td>
                      <td className={`sticky left-[88px] z-[5] whitespace-nowrap border-r border-slate-200 px-3 py-2 dark:border-slate-800 ${idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/40 dark:bg-slate-950/30'}`}>
                        {r.employeeName}
                      </td>
                      {grid.dates.map((d) => {
                        const c = r.cells[d]
                        return (
                          <td key={d} className={`whitespace-nowrap px-2 py-2 text-center text-xs tabular-nums ${cellClass(c.state)}`}>
                            {cellLabel(c.state, c.workedHours, c.leaveCode)}
                          </td>
                        )
                      })}
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums font-semibold">
                        {formatHHMM(r.totalWorkedHours)}
                      </td>
                      <td className={`whitespace-nowrap px-3 py-2 text-right tabular-nums ${r.totalLeaveHours > 0 ? 'font-semibold text-amber-700 dark:text-amber-300' : ''}`}>
                        {formatHHMM(r.totalLeaveHours)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <p className="text-[11px] text-slate-500">
            All values come <strong>only from timesheet entries</strong> — leave applications and monthly plans are not consulted.
            Hours under activity codes <code>SL</code>, <code>PL</code>, <code>EL</code>, <code>COMP_OFF</code>, <code>LOP</code> count as leave; everything else counts as worked hours.
            A cell tints sky-blue (<strong>WFH</strong>) when at least half the worked hours that day were logged with <code>work_mode = WFH</code>. A day with both leave and worked hours renders as a half-day. {includeSubmitted ? 'Live view includes drafts and submitted weeks.' : 'Only approved weeks are summed; tick "Include drafts & submitted" to see live data.'}
          </p>
        </>
      )}
    </div>
  )
}

// -----------------------------------------------------------------------------
function cellClass(state: GridState): string {
  switch (state) {
    case 'full_leave': return 'bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-200 font-semibold'
    case 'half_leave': return 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
    case 'wfh':        return 'bg-sky-50 text-sky-900 dark:bg-sky-950/40 dark:text-sky-200'
    case 'weekend':    return 'bg-slate-50 text-slate-400 italic dark:bg-slate-950/40 dark:text-slate-500'
    case 'work':       return 'text-slate-900 dark:text-slate-100'
    case 'empty':      return 'text-slate-300 dark:text-slate-600'
  }
}

function cellLabel(state: GridState, workedHours: number, leaveCode: string | null): React.ReactNode {
  if (state === 'full_leave') {
    return (
      <div className="flex flex-col items-center leading-tight">
        <span>Leave</span>
        {leaveCode && <span className="text-[9px] font-normal opacity-70">{leaveCode}</span>}
      </div>
    )
  }
  if (state === 'wfh') {
    return (
      <div className="flex flex-col items-center leading-tight">
        <span>{formatHHMM(workedHours)}</span>
        <span className="text-[9px] font-normal opacity-70">WFH</span>
      </div>
    )
  }
  return formatHHMM(workedHours)
}

function formatDateHeader(iso: string): string {
  // "26 Apr 26"
  const d = new Date(iso + 'T00:00:00Z')
  const day = d.getUTCDate()
  const mon = d.toLocaleString('en-IN', { month: 'short', timeZone: 'UTC' })
  const yy = String(d.getUTCFullYear()).slice(-2)
  return `${day} ${mon} ${yy}`
}

// -----------------------------------------------------------------------------
function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400">
      <Swatch className="bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-200">Leave (full day)</Swatch>
      <Swatch className="bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">Half-day leave</Swatch>
      <Swatch className="bg-sky-50 text-sky-900 dark:bg-sky-950/40 dark:text-sky-200">WFH</Swatch>
      <Swatch className="bg-slate-50 text-slate-400 italic dark:bg-slate-950/40 dark:text-slate-500">Weekend</Swatch>
    </div>
  )
}

function Swatch({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={`rounded px-2 py-0.5 ring-1 ring-inset ring-slate-200 dark:ring-slate-800 ${className}`}>
      {children}
    </span>
  )
}
