import Link from 'next/link'
import { listMyTeamPendingCompOff } from '@/lib/leave/comp-off-queries'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'

export const metadata = { title: 'Team comp-off approvals' }

export default async function TeamCompOffApprovalsPage() {
  const rows = await listMyTeamPendingCompOff()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team comp-off approvals"
        back={{ href: '/me/comp-off', label: 'My comp off' }}
        subtitle="Comp-off requests filed by your direct reports. Approving here advances them to HR; HR finalises and credits the balance."
      />

      <Card className="overflow-hidden p-0">
        <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <div className="text-sm font-semibold">Awaiting your approval</div>
          <div className="text-[11px] text-slate-500">
            {rows.length === 0 ? 'Nothing pending.' : `${rows.length} request${rows.length === 1 ? '' : 's'} from your team.`}
          </div>
        </div>
        {rows.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-slate-500">
            ✅ All caught up. New comp-off requests from your direct reports will appear here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
              <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2">Employee</th>
                  <th className="px-4 py-2">Worked on</th>
                  <th className="px-4 py-2 text-right">Days</th>
                  <th className="px-4 py-2">Reason</th>
                  <th className="px-4 py-2">Submitted</th>
                  <th className="px-4 py-2 text-right"> </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
                {rows.map((r) => (
                  <tr key={r.id} className="transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-950/30">
                    <td className="px-4 py-2.5">
                      <span className="font-medium text-slate-900 dark:text-slate-100">{r.employee.full_name_snapshot}</span>
                      <span className="ml-2 text-xs text-slate-500">{r.employee.employee_code}</span>
                    </td>
                    <td className="px-4 py-2.5 tabular-nums">{r.work_date}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{Number(r.days_requested).toFixed(1)}</td>
                    <td className="px-4 py-2.5 max-w-[280px] truncate text-xs text-slate-600 dark:text-slate-300">
                      {r.reason ?? <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">
                      {new Date(r.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link
                        href={`/me/comp-off/approvals/${r.id}`}
                        className="inline-flex h-8 items-center rounded-md bg-brand-600 px-3 text-xs font-medium text-white shadow-sm hover:bg-brand-700"
                      >
                        Review →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="text-[11px] text-slate-500">
        You&apos;re seeing requests where the employee&apos;s <code>reports_to</code> matches your employee record. Once you approve, HR sees the request in their queue and gives the final approval — only then is the comp-off grant created and the balance credited.
      </p>
    </div>
  )
}
