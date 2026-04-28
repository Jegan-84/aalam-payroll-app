import { notFound } from 'next/navigation'
import { getApprovalScope, getApprovalDetail } from '@/lib/timesheet/approval-queries'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ApprovalActions } from '../_components/approval-actions'
import { ReopenButton } from '../_components/reopen-button'

export const metadata = { title: 'Review timesheet' }

type PP = Promise<{ weekId: string }>

const STATUS_TONE: Record<string, 'brand' | 'warn' | 'danger' | 'neutral'> = {
  draft: 'neutral',
  submitted: 'warn',
  approved: 'brand',
  rejected: 'danger',
}

export default async function ApprovalDetailPage({ params }: { params: PP }) {
  const { weekId } = await params
  const scope = await getApprovalScope()
  const detail = await getApprovalDetail(weekId, scope)
  if (!detail) notFound()

  const dailyTotals: Record<string, number> = {}
  for (const d of detail.days) dailyTotals[d.iso] = 0
  for (const r of detail.rows) {
    for (const [d, h] of Object.entries(r.hoursByDate)) {
      dailyTotals[d] = (dailyTotals[d] ?? 0) + h
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${detail.employeeName} — ${detail.rangeLabel}`}
        back={{ href: '/me/timesheet/approvals', label: 'Approvals' }}
        subtitle={
          detail.submittedAt
            ? `Submitted ${new Date(detail.submittedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })}`
            : undefined
        }
        actions={<Badge tone={STATUS_TONE[detail.status]}>{detail.status}</Badge>}
      />

      {detail.decisionNote && (
        <Card className="border-amber-300 dark:border-amber-900">
          <div className="px-4 py-3">
            <div className="text-sm font-semibold text-amber-900 dark:text-amber-200">Decision note</div>
            <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">{detail.decisionNote}</div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Total hours" value={detail.totalHours.toFixed(2)} />
        <Stat label="Rows" value={String(detail.rows.length)} />
        <Stat label="Days covered" value={String(Object.values(dailyTotals).filter((h) => h > 0).length)} />
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 w-[260px]">Project / Activity / Task</th>
                {detail.days.map((d) => (
                  <th key={d.iso} className="px-2 py-3 text-center">
                    <div className="text-[10px] tracking-wide text-slate-500">{d.label}</div>
                    <div className="text-base font-semibold tabular-nums text-slate-900 dark:text-slate-50">{d.dayNumber}</div>
                  </th>
                ))}
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {detail.rows.length === 0 ? (
                <tr><td colSpan={9} className="px-6 py-12 text-center text-sm text-slate-500">No entries.</td></tr>
              ) : (
                detail.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2.5 align-top">
                      <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                        <span>{r.project_code} <span className="font-normal text-slate-500">· {r.project_name}</span></span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                          r.work_mode === 'WFH'
                            ? 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                        }`}>
                          {r.work_mode === 'WFH' ? '🏠 WFH' : '🏢 WFO'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {r.activity_code}
                        {r.task ? <> · <span className="italic">{r.task}</span></> : null}
                      </div>
                    </td>
                    {detail.days.map((d) => {
                      const h = r.hoursByDate[d.iso] ?? 0
                      return (
                        <td key={d.iso} className="px-2 py-2 text-center text-sm tabular-nums text-slate-700 dark:text-slate-200">
                          {h === 0 ? <span className="text-slate-400">—</span> : h.toFixed(2)}
                        </td>
                      )
                    })}
                    <td className="px-4 py-2 text-right text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                      {r.totalHours.toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
              <tr className="bg-slate-50/60 dark:bg-slate-950/30">
                <td className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Daily total</td>
                {detail.days.map((d) => (
                  <td key={d.iso} className="px-2 py-2 text-center text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                    {(dailyTotals[d.iso] ?? 0).toFixed(2)}
                  </td>
                ))}
                <td className="px-4 py-2 text-right text-base font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                  {detail.totalHours.toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {detail.canApprove && <ApprovalActions weekId={detail.weekId} />}
      {detail.status === 'approved' && <ReopenButton weekId={detail.weekId} />}
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5 text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-50">{value}</div>
      {hint && <div className="text-[11px] text-slate-500">{hint}</div>}
    </div>
  )
}
