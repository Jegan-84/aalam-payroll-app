import Link from 'next/link'
import { getCurrentEmployee } from '@/lib/auth/dal'
import { listEmployeeLoans } from '@/lib/loans/queries'
import { MONTH_NAMES } from '@/lib/attendance/engine'
import { formatInr } from '@/lib/format'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const metadata = { title: 'My Loans' }

const STATUS_TONE: Record<string, 'success' | 'info' | 'warn' | 'neutral'> = {
  active: 'info',
  closed: 'success',
  foreclosed: 'success',
  written_off: 'warn',
}

export default async function MyLoansPage() {
  const { employeeId } = await getCurrentEmployee()
  const loans = await listEmployeeLoans(employeeId)

  const totalOutstanding = loans
    .filter((l) => l.status === 'active')
    .reduce((s, l) => s + Number(l.outstanding_balance), 0)
  const totalPaid = loans.reduce((s, l) => s + Number(l.total_paid), 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Loans"
        subtitle={`${loans.length} loan${loans.length === 1 ? '' : 's'} on record · ₹${new Intl.NumberFormat('en-IN').format(totalOutstanding)} outstanding · ₹${new Intl.NumberFormat('en-IN').format(totalPaid)} paid so far`}
      />

      {loans.length === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-500">
          No loans. If the company sanctions you a loan, EMIs will auto-deduct from your salary and appear here.
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
              <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
                <tr>
                  <Th>Type</Th>
                  <Th>Sanctioned</Th>
                  <Th className="text-right">Principal</Th>
                  <Th className="text-right">EMI</Th>
                  <Th>Start</Th>
                  <Th className="text-right">Paid</Th>
                  <Th className="text-right">Outstanding</Th>
                  <Th>Status</Th>
                  <Th>{' '}</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
                {loans.map((l) => (
                  <tr key={l.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-950">
                    <Td>
                      <span className="capitalize">{l.loan_type}</span>
                      {l.loan_number && <span className="ml-1 text-xs text-slate-500">({l.loan_number})</span>}
                    </Td>
                    <Td className="text-xs text-slate-500">{l.sanctioned_at.slice(0, 10)}</Td>
                    <Td className="text-right tabular-nums">{formatInr(l.principal)}</Td>
                    <Td className="text-right tabular-nums">{formatInr(l.emi_amount)}</Td>
                    <Td className="tabular-nums">{MONTH_NAMES[l.start_month - 1]} {l.start_year}</Td>
                    <Td className="text-right tabular-nums">{formatInr(l.total_paid)}</Td>
                    <Td className="text-right font-semibold tabular-nums">{formatInr(l.outstanding_balance)}</Td>
                    <Td><Badge tone={STATUS_TONE[l.status] ?? 'neutral'}>{l.status.replace('_', ' ')}</Badge></Td>
                    <Td><Link href={`/me/loans/${l.id}`} className="text-xs font-medium text-brand-700 hover:underline">View →</Link></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <p className="text-xs text-slate-500">
        Loans are interest-free. A perquisite value (notional interest at the SBI prime rate) is added to your taxable salary for balances above ₹20,000, as per Section 17(2)(viii) of the Income Tax Act. It appears on your payslip as a separate &quot;notional perquisite&quot; line — it does not affect your take-home.
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
