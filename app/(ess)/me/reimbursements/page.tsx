import { getCurrentEmployee } from '@/lib/auth/dal'
import { listEmployeeReimbursements } from '@/lib/reimbursements/queries'
import { PageHeader } from '@/components/ui/page-header'
import { ReimbursementSubmit } from './_components/submit-form'

export const metadata = { title: 'My Reimbursements' }

export default async function MyReimbursementsPage() {
  const { employeeId } = await getCurrentEmployee()
  const claims = await listEmployeeReimbursements(employeeId)

  const totalPending = claims.filter((c) => c.status === 'pending').reduce((s, c) => s + c.amount, 0)
  const totalApproved = claims.filter((c) => c.status === 'approved').reduce((s, c) => s + c.amount, 0)
  const totalPaid = claims.filter((c) => c.status === 'paid').reduce((s, c) => s + c.amount, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reimbursements"
        subtitle={`₹${Math.round(totalPending).toLocaleString('en-IN')} pending · ₹${Math.round(totalApproved).toLocaleString('en-IN')} approved (awaiting payroll) · ₹${Math.round(totalPaid).toLocaleString('en-IN')} paid`}
      />
      <ReimbursementSubmit claims={claims} />
    </div>
  )
}
