import { requireRouteRoles } from '@/lib/auth/dal'
import { listPendingConfigChanges } from '@/lib/config-approvals/queries'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { ApprovalQueue } from './_components/approval-queue'

export const metadata = { title: 'Config approvals' }

export default async function ConfigApprovalsPage() {
  // Hard-gate: only admin can act on approvals. The page will still render
  // for HR / payroll so they can see what's pending, but the buttons no-op.
  await requireRouteRoles('admin', 'hr', 'payroll')

  const [pending, history] = await Promise.all([
    listPendingConfigChanges({ status: 'submitted', limit: 100 }),
    Promise.all([
      listPendingConfigChanges({ status: 'approved', limit: 25 }),
      listPendingConfigChanges({ status: 'rejected', limit: 25 }),
    ]).then(([a, r]) =>
      [...a, ...r].sort((x, y) => (y.decided_at ?? '').localeCompare(x.decided_at ?? '')).slice(0, 25),
    ),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Config approvals"
        back={{ href: '/settings', label: 'Settings' }}
        subtitle="Two-level approval queue for statutory, income-tax and PT changes. The maker (HR / payroll) submits a change here; an admin (different person) approves before it takes effect."
      />

      <Card className="overflow-hidden p-0">
        <CardHeader>
          <CardTitle>Awaiting approval ({pending.length})</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {pending.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-slate-500">
              ✅ Nothing pending. Statutory / tax / PT changes will land here for admin sign-off.
            </p>
          ) : (
            <ApprovalQueue rows={pending} />
          )}
        </CardBody>
      </Card>

      {history.length > 0 && (
        <Card className="overflow-hidden p-0">
          <CardHeader>
            <CardTitle>Recent decisions</CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-2">Target</th>
                    <th className="px-4 py-2">Description</th>
                    <th className="px-4 py-2">Submitted by</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Decided</th>
                    <th className="px-4 py-2">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs dark:divide-slate-800">
                  {history.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-2 font-medium text-slate-900 dark:text-slate-100">
                        {r.target_table}
                        <span className="ml-1 text-[10px] text-slate-500">/ {r.action}</span>
                      </td>
                      <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{r.description ?? '—'}</td>
                      <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{r.submitted_by_email ?? '—'}</td>
                      <td className="px-4 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          r.status === 'approved' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                          : r.status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
                        }`}>{r.status}</span>
                      </td>
                      <td className="px-4 py-2 text-[11px] text-slate-500">
                        {r.decided_at ? new Date(r.decided_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                        {r.decided_by_email && <div className="text-[10px] text-slate-400">by {r.decided_by_email}</div>}
                      </td>
                      <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{r.decision_note ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      <p className="text-[11px] text-slate-500">
        Two-level rule: the approver must be different from the maker. An admin who submits a change can&apos;t approve it themselves — another admin (or a different login) must sign off.
      </p>
    </div>
  )
}
