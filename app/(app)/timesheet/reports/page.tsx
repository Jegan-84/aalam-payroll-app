import Link from 'next/link'
import {
  reportByProject,
  reportByEmployee,
  reportByActivity,
} from '@/lib/timesheet/report-queries'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RangePicker } from './_components/range-picker'

export const metadata = { title: 'Timesheet reports' }

type SP = Promise<{ tab?: string; from?: string; to?: string; live?: string }>

const TABS = ['project', 'employee', 'activity'] as const
type Tab = typeof TABS[number]

function defaultRange(): { from: string; to: string } {
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const end = new Date(now.getTime())
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) }
}

export default async function ReportsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams
  const def = defaultRange()
  const from = sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from : def.from
  const to = sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? sp.to : def.to
  const tab: Tab = (TABS as readonly string[]).includes(sp.tab ?? '') ? (sp.tab as Tab) : 'project'
  const includeSubmitted = sp.live === '1'

  const exportHref = `/api/timesheet/reports/export?tab=${tab}&from=${from}&to=${to}${includeSubmitted ? '&live=1' : ''}`

  return (
    <div className="space-y-6">
      <PageHeader
        title="Timesheet reports"
        back={{ href: '/dashboard', label: 'Dashboard' }}
        subtitle={`Showing ${from} to ${to}. ${includeSubmitted ? 'Includes submitted (in-flight) weeks.' : 'Approved weeks only.'}`}
        actions={
          <Link
            href={exportHref}
            className="inline-flex h-9 items-center whitespace-nowrap rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
          >
            Download CSV
          </Link>
        }
      />

      <RangePicker from={from} to={to} tab={tab} live={includeSubmitted} />

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
        {(['project', 'employee', 'activity'] as Tab[]).map((t) => {
          const params = new URLSearchParams({ tab: t, from, to })
          if (includeSubmitted) params.set('live', '1')
          const href = `/timesheet/reports?${params.toString()}`
          const active = tab === t
          return (
            <Link
              key={t}
              href={href}
              className={`flex-1 rounded-md px-3 py-1.5 text-center text-sm font-medium transition-colors ${
                active
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              By {t}
            </Link>
          )
        })}
      </div>

      {tab === 'project' && <ProjectTab from={from} to={to} includeSubmitted={includeSubmitted} />}
      {tab === 'employee' && <EmployeeTab from={from} to={to} includeSubmitted={includeSubmitted} />}
      {tab === 'activity' && <ActivityTab from={from} to={to} includeSubmitted={includeSubmitted} />}
    </div>
  )
}

// -----------------------------------------------------------------------------
async function ProjectTab({ from, to, includeSubmitted }: { from: string; to: string; includeSubmitted: boolean }) {
  const rows = await reportByProject(from, to, { includeSubmitted })
  const totalHours = rows.reduce((s, r) => s + r.totalHours, 0)

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <div className="text-sm font-semibold">Hours by project</div>
        <div className="text-[11px] text-slate-500">
          {rows.length} project(s) · {totalHours.toFixed(2)}h total
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="px-6 py-12 text-center text-sm text-slate-500">No approved entries in this range.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
              <tr>
                <th className="px-4 py-2">Project</th>
                <th className="px-4 py-2 text-right">Total hours</th>
                <th className="px-4 py-2 text-right">Employees</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {rows.map((r) => (
                <tr key={r.project_id}>
                  <td className="px-4 py-2.5">
                    <span className="font-medium">{r.project_code}</span>
                    <span className="ml-2 text-xs text-slate-500">{r.project_name}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{r.totalHours.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.employeeCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

// -----------------------------------------------------------------------------
async function EmployeeTab({ from, to, includeSubmitted }: { from: string; to: string; includeSubmitted: boolean }) {
  const rows = await reportByEmployee(from, to, { includeSubmitted })
  const workingDays = rows[0]?.workingDays ?? 0
  const capacity = rows[0]?.capacityHours ?? 0

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <div className="text-sm font-semibold">Hours by employee</div>
        <div className="text-[11px] text-slate-500">
          {rows.length} employee(s) · {workingDays} weekdays in range · capacity {capacity}h per person
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="px-6 py-12 text-center text-sm text-slate-500">No approved entries in this range.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
              <tr>
                <th className="px-4 py-2">Employee</th>
                <th className="px-4 py-2 text-right">Logged</th>
                <th className="px-4 py-2 text-right">Utilization</th>
                <th className="px-4 py-2 text-right">Days logged</th>
                <th className="px-4 py-2 text-right">Days with gaps</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {rows.map((r) => {
                const utilTone =
                  r.utilizationPct >= 80 ? 'brand'
                  : r.utilizationPct >= 50 ? 'warn'
                  : 'danger'
                return (
                  <tr key={r.employee_id}>
                    <td className="px-4 py-2.5">
                      <Link href={`/employees/${r.employee_id}`} className="font-medium text-slate-900 hover:text-brand-700 dark:text-slate-100">
                        {r.employee_name}
                      </Link>
                      <span className="ml-2 text-xs text-slate-500">{r.employee_code}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{r.totalHours.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <Badge tone={utilTone}>{r.utilizationPct}%</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{r.daysLogged}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">{r.daysWithGaps}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500 dark:border-slate-800">
        Capacity = weekdays × 8h. Sat / Sun excluded; project holidays not yet subtracted (refinement on the backlog).
      </div>
    </Card>
  )
}

// -----------------------------------------------------------------------------
async function ActivityTab({ from, to, includeSubmitted }: { from: string; to: string; includeSubmitted: boolean }) {
  const rows = await reportByActivity(from, to, { includeSubmitted })
  const totalHours = rows.reduce((s, r) => s + r.totalHours, 0)

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <div className="text-sm font-semibold">Hours by activity type</div>
        <div className="text-[11px] text-slate-500">
          {rows.length} activity type(s) · {totalHours.toFixed(2)}h total
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="px-6 py-12 text-center text-sm text-slate-500">No approved entries in this range.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
              <tr>
                <th className="px-4 py-2">Activity</th>
                <th className="px-4 py-2 text-right">Total hours</th>
                <th className="px-4 py-2 text-right">Share</th>
                <th className="px-4 py-2 text-right">Projects</th>
                <th className="px-4 py-2 text-right">Employees</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {rows.map((r) => {
                const share = totalHours > 0 ? Math.round((r.totalHours / totalHours) * 100) : 0
                return (
                  <tr key={r.activity_type_id}>
                    <td className="px-4 py-2.5">
                      <span className="font-medium">{r.activity_code}</span>
                      <span className="ml-2 text-xs text-slate-500">{r.activity_name}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{r.totalHours.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-slate-100 sm:block dark:bg-slate-800">
                          <div className="h-full bg-brand-500" style={{ width: `${share}%` }} />
                        </div>
                        <span className="tabular-nums">{share}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{r.projectCount}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{r.employeeCount}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
