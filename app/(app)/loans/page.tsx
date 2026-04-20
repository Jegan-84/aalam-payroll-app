import Link from 'next/link'
import { listLoans, type LoanStatus } from '@/lib/loans/queries'
import { formatInr } from '@/lib/format'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Pagination } from '@/components/ui/pagination'

export const metadata = { title: 'Loans' }

type SP = Promise<{ page?: string; status?: string }>

const STATUS_TONE: Record<string, 'success' | 'info' | 'warn' | 'neutral'> = {
  active: 'info',
  closed: 'success',
  foreclosed: 'success',
  written_off: 'warn',
}

const STATUSES: LoanStatus[] = ['active', 'closed', 'foreclosed', 'written_off']

export default async function LoansListPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams
  const pageNum = sp.page ? Number(sp.page) : 1
  const status = STATUSES.includes(sp.status as LoanStatus) ? (sp.status as LoanStatus) : undefined

  const { rows, total, page, totalPages } = await listLoans({ page: pageNum, status })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Loans"
        subtitle={`${total} ${total === 1 ? 'loan' : 'loans'} · sanction a new one from the employee's Loans tab`}
      />

      <div className="flex flex-wrap gap-2 text-sm">
        <TabLink href="/loans" label="All" active={!status} />
        {STATUSES.map((s) => (
          <TabLink key={s} href={`/loans?status=${s}`} label={s.replace('_', ' ')} active={status === s} />
        ))}
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
              <tr>
                <Th>Employee</Th>
                <Th>Type</Th>
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
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-sm text-slate-500">
                    No loans yet.
                  </td>
                </tr>
              )}
              {rows.map((l) => (
                <tr key={l.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-950">
                  <Td>
                    {l.employee ? (
                      <Link href={`/loans/${l.id}`} className="font-medium text-slate-900 hover:text-brand-700 hover:underline dark:text-slate-100">
                        {l.employee.full_name_snapshot}{' '}
                        <span className="text-slate-500">({l.employee.employee_code})</span>
                      </Link>
                    ) : '—'}
                  </Td>
                  <Td>{l.loan_type}</Td>
                  <Td className="text-right tabular-nums">{formatInr(l.principal)}</Td>
                  <Td className="text-right tabular-nums">{formatInr(l.emi_amount)}</Td>
                  <Td className="tabular-nums">{l.start_year}-{String(l.start_month).padStart(2, '0')}</Td>
                  <Td className="text-right tabular-nums">{formatInr(l.total_paid)}</Td>
                  <Td className="text-right font-semibold tabular-nums">{formatInr(l.outstanding_balance)}</Td>
                  <Td><Badge tone={STATUS_TONE[l.status] ?? 'neutral'}>{l.status.replace('_', ' ')}</Badge></Td>
                  <Td><Link href={`/loans/${l.id}`} className="text-xs font-medium text-brand-700 hover:underline">Open →</Link></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        basePath="/loans"
        searchParams={sp}
        noun={{ singular: 'loan', plural: 'loans' }}
      />
    </div>
  )
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 ${className}`}>{children}</th>
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-slate-900 dark:text-slate-100 ${className}`}>{children}</td>
}

function TabLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? 'border-brand-600 bg-brand-600 text-white'
          : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
      }`}
    >
      {label}
    </Link>
  )
}
