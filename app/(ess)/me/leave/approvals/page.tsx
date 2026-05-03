import Link from 'next/link'
import { listMyTeamPendingLeaves } from '@/lib/leave/queries'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const metadata = { title: 'Team leave approvals' }

export default async function TeamLeaveApprovalsPage() {
  const rows = await listMyTeamPendingLeaves()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team leave approvals"
        back={{ href: '/me/leave', label: 'My leave' }}
        subtitle="Leave requests filed by your direct reports. Approving here advances them to the HR review stage; HR finalises the request and updates the balance."
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
            ✅ All caught up. Direct reports&apos; new leave requests will appear here for your approval.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
              <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2">Employee</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">From → To</th>
                  <th className="px-4 py-2 text-right">Days</th>
                  <th className="px-4 py-2">Reason</th>
                  <th className="px-4 py-2">Applied</th>
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
                    <td className="px-4 py-2.5">
                      <span className="font-medium">{r.leave_type.code}</span>
                      <span className="ml-1.5 text-xs text-slate-500">{r.leave_type.name}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs tabular-nums text-slate-600 dark:text-slate-300">
                      {r.from_date} → {r.to_date}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                      {Number(r.days_count).toFixed(1)}
                      {r.is_half_day && (
                        <Badge tone="warn" className="ml-2">½</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2.5 max-w-[280px] truncate text-xs text-slate-600 dark:text-slate-300">
                      {r.reason ?? <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">
                      {new Date(r.applied_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link
                        href={`/me/leave/approvals/${r.id}`}
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
        You&apos;re seeing requests from employees whose <code>reports_to</code> is set to your employee record. Once you approve, HR sees the request in their queue and gives the final approval — only then is the balance debited and attendance updated.
      </p>
    </div>
  )
}
