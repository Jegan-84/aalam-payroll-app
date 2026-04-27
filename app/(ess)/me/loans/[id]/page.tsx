import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentEmployee } from '@/lib/auth/dal'
import { getLoan, listLoanRepayments } from '@/lib/loans/queries'
import { MONTH_NAMES } from '@/lib/attendance/engine'
import { formatInr } from '@/lib/format'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { Stat } from '@/components/ui/stat'
import { Badge } from '@/components/ui/badge'

export const metadata = { title: 'Loan' }

type PP = Promise<{ id: string }>

const STATUS_TONE: Record<string, 'success' | 'info' | 'warn' | 'neutral'> = {
  active: 'info',
  closed: 'success',
  foreclosed: 'success',
  written_off: 'warn',
}

export default async function MyLoanDetailPage({ params }: { params: PP }) {
  const { employeeId } = await getCurrentEmployee()
  const { id } = await params
  const loan = await getLoan(id)
  if (!loan) notFound()

  // Employees can only see their own loans. If someone crafts a URL to another
  // employee's loan id, bounce them out.
  if (loan.employee_id !== employeeId) redirect('/me/loans')

  const repayments = await listLoanRepayments(id)
  const monthsPaid = repayments.length
  const remaining = Math.max(0, loan.tenure_months - monthsPaid)

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Loan — ${loan.loan_type}${loan.loan_number ? ` (${loan.loan_number})` : ''}`}
        back={{ href: '/me/loans', label: 'Loans' }}
        subtitle={`Sanctioned ${loan.sanctioned_at.slice(0, 10)} · tenure ${loan.tenure_months} months`}
        actions={<Badge tone={STATUS_TONE[loan.status] ?? 'neutral'}>{loan.status.replace('_', ' ')}</Badge>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Principal" value={formatInr(loan.principal)} />
        <Stat label="EMI" value={formatInr(loan.emi_amount)} />
        <Stat label="Paid" value={formatInr(loan.total_paid)} />
        <Stat tone="brand" label="Outstanding" value={formatInr(loan.outstanding_balance)} />
        <Stat label="Months paid" value={`${monthsPaid} / ${loan.tenure_months}`} />
      </div>

      <Card>
        <CardHeader><CardTitle>Repayment ledger</CardTitle></CardHeader>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
              <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
                <tr>
                  <Th>Cycle</Th>
                  <Th className="text-right">Amount paid</Th>
                  <Th className="text-right">Running balance</Th>
                  <Th>Recorded</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
                {repayments.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-sm text-slate-500">
                      No repayments recorded yet. EMIs appear here once the monthly payroll cycle is approved.
                    </td>
                  </tr>
                )}
                {repayments.map((r) => (
                  <tr key={r.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-950">
                    <Td>{MONTH_NAMES[r.cycle_month - 1]} {r.cycle_year}</Td>
                    <Td className="text-right tabular-nums">{formatInr(r.amount_paid)}</Td>
                    <Td className="text-right tabular-nums">{formatInr(r.running_balance)}</Td>
                    <Td className="text-xs text-slate-500">{r.created_at.slice(0, 10)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {remaining > 0 && loan.status === 'active' && (
        <p className="text-xs text-slate-500">
          At the current EMI, approximately <strong>{remaining} more month{remaining === 1 ? '' : 's'}</strong> to close the loan.
        </p>
      )}

      <p className="text-xs text-slate-500">
        Need to foreclose or have a query on the EMI? <Link href="mailto:hr@aalamsoft.com" className="underline">Email HR</Link>.
      </p>
    </div>
  )
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 ${className}`}>{children}</th>
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-slate-900 dark:text-slate-100 ${className}`}>{children}</td>
}
