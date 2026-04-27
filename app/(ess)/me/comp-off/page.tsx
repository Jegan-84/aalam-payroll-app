import { getCurrentEmployee } from '@/lib/auth/dal'
import { listMyCompOffRequests, listEmployeeCompOff } from '@/lib/leave/comp-off-queries'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MyCompOffRequest } from './_components/comp-off-request'

export const metadata = { title: 'My Comp Off' }

const STATUS_TONE: Record<string, 'warn' | 'success' | 'danger' | 'neutral'> = {
  active:   'success',
  used:     'neutral',
  expired:  'danger',
  revoked:  'danger',
}

export default async function MyCompOffPage() {
  const { employeeId } = await getCurrentEmployee()
  const [requests, grants] = await Promise.all([
    listMyCompOffRequests(employeeId),
    listEmployeeCompOff(employeeId),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Comp Off"
        subtitle="Worked on a holiday or weekend? Request comp off here. HR approves it, and you get 30 days from the work date to use it."
      />

      <MyCompOffRequest requests={requests} />

      <Card className="overflow-hidden p-0">
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-50">
          My active grants
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Worked on</th>
                <th className="px-4 py-3 text-right">Days</th>
                <th className="px-4 py-3">Expires</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {grants.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-500">No comp off grants yet.</td></tr>
              )}
              {grants.map((g) => (
                <tr key={g.id}>
                  <td className="px-4 py-3 tabular-nums">{g.work_date}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{Number(g.granted_days).toFixed(1)}</td>
                  <td className="px-4 py-3 tabular-nums">{g.expires_on}</td>
                  <td className="px-4 py-3"><Badge tone={STATUS_TONE[g.status]}>{g.status}</Badge></td>
                  <td className="px-4 py-3 text-xs text-slate-500">{g.reason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
