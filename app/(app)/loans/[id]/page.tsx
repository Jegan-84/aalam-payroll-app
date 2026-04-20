import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getLoan, listLoanRepayments } from '@/lib/loans/queries'
import { getEmployee } from '@/lib/employees/queries'
import { formatInr } from '@/lib/format'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { Stat } from '@/components/ui/stat'
import { Badge } from '@/components/ui/badge'
import { LoanActions } from './_components/loan-actions'
import { MONTH_NAMES } from '@/lib/attendance/engine'

export const metadata = { title: 'Loan' }

type PP = Promise<{ id: string }>

const STATUS_TONE: Record<string, 'success' | 'info' | 'warn' | 'neutral'> = {
  active: 'info',
  closed: 'success',
  foreclosed: 'success',
  written_off: 'warn',
}

export default async function LoanDetailPage({ params }: { params: PP }) {
  const { id } = await params
  const loan = await getLoan(id)
  if (!loan) notFound()

  const [emp, repayments] = await Promise.all([getEmployee(loan.employee_id), listLoanRepayments(id)])

  const monthsPaid = repayments.length
  const remainingMonths = Math.max(0, loan.tenure_months - monthsPaid)

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title={`Loan — ${loan.loan_type}${loan.loan_number ? ` (${loan.loan_number})` : ''}`}
        back={
          emp
            ? { href: `/employees/${emp.id}/loans`, label: emp.full_name_snapshot }
            : { href: '/loans', label: 'Loans' }
        }
        subtitle={`Sanctioned ${loan.sanctioned_at.slice(0, 10)} · tenure ${loan.tenure_months} months`}
        actions={
          <>
            <Badge tone={STATUS_TONE[loan.status] ?? 'neutral'}>{loan.status.replace('_', ' ')}</Badge>
            <LoanActions id={loan.id} status={loan.status} />
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Principal" value={formatInr(loan.principal)} />
        <Stat label="EMI" value={formatInr(loan.emi_amount)} />
        <Stat label="Paid" value={formatInr(loan.total_paid)} />
        <Stat tone="brand" label="Outstanding" value={formatInr(loan.outstanding_balance)} />
        <Stat label="Months paid" value={`${monthsPaid} / ${loan.tenure_months}`} />
      </div>

      <Card>
        <CardHeader><CardTitle>Terms</CardTitle></CardHeader>
        <CardBody>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <DT label="Type" value={loan.loan_type} />
            <DT label="Interest" value={loan.interest_rate_percent === 0 ? 'Interest-free' : `${loan.interest_rate_percent}%`} />
            <DT label="Tenure" value={`${loan.tenure_months} months`} />
            <DT label="Start" value={`${MONTH_NAMES[loan.start_month - 1]} ${loan.start_year}`} />
            <DT label="Remaining" value={remainingMonths > 0 ? `~${remainingMonths} months` : '—'} />
            <DT label="Sanctioned on" value={loan.sanctioned_at.slice(0, 10)} />
            {loan.closed_at && <DT label="Closed on" value={loan.closed_at.slice(0, 10)} />}
            {loan.notes && <DT label="Notes" value={loan.notes} />}
          </dl>
        </CardBody>
      </Card>

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
                  <Th>{' '}</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
                {repayments.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-500">
                      No repayments yet. EMIs are recorded here when a payroll cycle is approved.
                    </td>
                  </tr>
                )}
                {repayments.map((r) => (
                  <tr key={r.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-950">
                    <Td>{MONTH_NAMES[r.cycle_month - 1]} {r.cycle_year}</Td>
                    <Td className="text-right tabular-nums">{formatInr(r.amount_paid)}</Td>
                    <Td className="text-right tabular-nums">{formatInr(r.running_balance)}</Td>
                    <Td className="text-xs text-slate-500">{r.created_at.slice(0, 10)}</Td>
                    <Td>
                      <Link href={`/payroll/${r.cycle_id}`} className="text-xs font-medium text-brand-700 hover:underline">
                        Cycle →
                      </Link>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 ${className}`}>{children}</th>
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-slate-900 dark:text-slate-100 ${className}`}>{children}</td>
}
function DT({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">{value}</dd>
    </div>
  )
}
