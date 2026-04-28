import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getApprovalScope, listPendingWeeks } from '@/lib/timesheet/approval-queries'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ApprovalQueueTable } from './_components/approval-queue-table'

export const metadata = { title: 'Timesheet approvals' }

export default async function ApprovalsPage() {
  const scope = await getApprovalScope()
  if (!scope.isAdminish && !scope.isManager) {
    // Not admin and no direct reports — nothing to approve.
    redirect('/me/timesheet')
  }

  const pending = await listPendingWeeks(scope, { includeRejected: true })
  const submittedRows = pending.filter((p) => p.status === 'submitted')
  const rejectedRows = pending.filter((p) => p.status === 'rejected')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Timesheet approvals"
        back={{ href: '/me/timesheet', label: 'My timesheet' }}
        subtitle={
          scope.isAdminish
            ? 'You see every submitted week across the company.'
            : 'You see every submitted week from your direct reports.'
        }
        actions={<Badge tone="brand">{scope.scopeLabel}</Badge>}
      />

      <Card className="overflow-hidden p-0">
        <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            Pending ({submittedRows.length})
          </div>
        </div>
        {submittedRows.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-slate-500">No pending submissions. 🎉</p>
        ) : (
          <ApprovalQueueTable rows={submittedRows} />
        )}
      </Card>

      {rejectedRows.length > 0 && (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
              Recently rejected ({rejectedRows.length})
            </div>
          </div>
          <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
            {rejectedRows.map((r) => (
              <li key={r.id} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <div className="font-medium text-slate-900 dark:text-slate-100">
                    {r.employeeName} <span className="text-slate-500">({r.employeeCode})</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {r.rangeLabel} · {r.totalHours.toFixed(2)}h
                  </div>
                </div>
                <Link
                  href={`/me/timesheet/approvals/${r.id}`}
                  className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-400"
                >
                  View →
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
