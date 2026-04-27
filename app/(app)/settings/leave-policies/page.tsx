import { listLeaveTypePolicies } from '@/lib/leave/policy-queries'
import { PageHeader } from '@/components/ui/page-header'
import { PolicyRow } from './_components/policy-row'
import { RunAccrualForm } from './_components/run-accrual-form'
import { NewLeaveTypeForm } from './_components/new-policy-form'

export const metadata = { title: 'Leave Policies' }

export default async function LeavePoliciesPage() {
  const rows = await listLeaveTypePolicies()
  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title="Leave Policies"
        back={{ href: '/settings', label: 'Settings' }}
        subtitle="Per-type rules — quota, accrual cadence, carry-forward cap, maximum balance. Run monthly accrual at the start of every month (or automate via pg_cron)."
      />

      <RunAccrualForm />

      <NewLeaveTypeForm />

      <div className="space-y-3">
        {rows.map((r) => <PolicyRow key={r.id} row={r} />)}
      </div>
    </div>
  )
}
