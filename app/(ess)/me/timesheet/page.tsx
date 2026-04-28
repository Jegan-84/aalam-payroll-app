import Link from 'next/link'
import { getCurrentEmployee } from '@/lib/auth/dal'
import { listMyWeeks, mondayAnchorOf } from '@/lib/timesheet/queries'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const metadata = { title: 'My timesheets' }

const STATUS_TONE: Record<string, 'brand' | 'warn' | 'danger' | 'neutral'> = {
  draft: 'neutral',
  submitted: 'warn',
  approved: 'brand',
  rejected: 'danger',
}

export default async function MyTimesheetIndexPage() {
  const { employeeId } = await getCurrentEmployee()
  const weeks = await listMyWeeks(employeeId)

  const today = mondayAnchorOf()
  const hasThisWeek = weeks.some((w) => w.weekStart === today)

  return (
    <div className="space-y-6">
      <PageHeader
        title="My timesheets"
        subtitle="One row per week. Click any week to view, edit, or submit."
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={`/me/timesheet/${today}`}
              className="inline-flex h-9 items-center whitespace-nowrap rounded-md bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700 active:bg-brand-800"
            >
              {hasThisWeek ? 'Open this week →' : '+ Start this week'}
            </Link>
          </div>
        }
      />

      {weeks.length === 0 ? (
        <Card className="p-6 text-center text-sm text-slate-500">
          You haven&apos;t logged any timesheets yet. Click <span className="font-medium">+ Start this week</span> to begin.
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
              <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Week</th>
                  <th className="px-4 py-3">Dates</th>
                  <th className="px-4 py-3 text-right">Total hours</th>
                  <th className="px-4 py-3 text-right">Rows</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Last update</th>
                  <th className="px-4 py-3 text-right">{' '}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
                {weeks.map((w) => (
                  <tr key={w.weekId} className="transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-950/30">
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                      <Link
                        href={`/me/timesheet/${w.weekStart}`}
                        className="hover:text-brand-700 dark:hover:text-brand-400"
                      >
                        {w.rangeLabel}
                      </Link>
                      {w.weekStart === today && (
                        <span className="ml-2 rounded-full bg-brand-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-brand-800 dark:bg-brand-950/40 dark:text-brand-300">
                          this week
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums text-slate-600 dark:text-slate-300">
                      {w.weekStart} → {w.weekEnd}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-900 dark:text-slate-50">
                      {w.totalHours.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-500">{w.rowCount}</td>
                    <td className="px-4 py-3"><Badge tone={STATUS_TONE[w.status]}>{w.status}</Badge></td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {w.updatedAt
                        ? new Date(w.updatedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/me/timesheet/${w.weekStart}`}
                        className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-400"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500 dark:border-slate-800">
            Showing the last {weeks.length} week{weeks.length === 1 ? '' : 's'}. Click a row to view, edit, or submit.
          </div>
        </Card>
      )}
    </div>
  )
}
