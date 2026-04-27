import {
  listPendingCompOffRequests,
  listRecentCompOffRequests,
} from '@/lib/leave/comp-off-queries'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { CompOffApprovalQueue } from './_components/approval-queue'

export const metadata = { title: 'Comp Off requests' }

const TONE_CLASS: Record<string, string> = {
  submitted: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  approved:  'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
  rejected:  'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200',
  cancelled: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
}

export default async function CompOffRequestsPage() {
  const [pending, recent] = await Promise.all([
    listPendingCompOffRequests(),
    listRecentCompOffRequests({ limit: 50 }),
  ])

  const history = recent.filter((r) => r.status !== 'submitted')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Comp Off"
        subtitle="Approve or reject employee comp off requests. Approved grants expire 30 days after the work date."
      />

      <Card className="overflow-hidden p-0">
        <CardHeader>
          <CardTitle>Pending ({pending.length})</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          <CompOffApprovalQueue rows={pending} />
        </CardBody>
      </Card>

      <Card className="overflow-hidden p-0">
        <CardHeader>
          <CardTitle>Recent decisions</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {history.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">No decisions yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Employee</th>
                    <th className="px-3 py-2">Worked on</th>
                    <th className="px-3 py-2 text-right">Days</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Note</th>
                    <th className="px-3 py-2">Decided</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs dark:divide-slate-800">
                  {history.map((r) => (
                    <tr key={r.id}>
                      <td className="px-3 py-2">
                        <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{r.employee.full_name_snapshot}</div>
                        <div className="text-[11px] text-slate-500">{r.employee.employee_code}</div>
                      </td>
                      <td className="px-3 py-2 tabular-nums">{r.work_date}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{Number(r.days_requested).toFixed(1)}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${TONE_CLASS[r.status]}`}>{r.status}</span>
                      </td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{r.decision_note ?? '—'}</td>
                      <td className="px-3 py-2 text-[11px] text-slate-500">
                        {r.decided_at ? new Date(r.decided_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
