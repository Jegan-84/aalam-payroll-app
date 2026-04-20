import Link from 'next/link'
import { listCyclesPaged } from '@/lib/payroll/queries'
import { MONTH_NAMES } from '@/lib/attendance/engine'
import { formatInr } from '@/lib/format'
import { OpenCycleButton } from './_components/open-cycle'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Pagination } from '@/components/ui/pagination'

export const metadata = { title: 'Payroll' }

type SP = Promise<{ page?: string }>

const STATUS_TONE: Record<string, 'neutral' | 'info' | 'warn' | 'success' | 'brand'> = {
  draft: 'neutral',
  computed: 'info',
  approved: 'warn',
  locked: 'success',
  paid: 'brand',
}

export default async function PayrollListPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams
  const pageNum = sp.page ? Number(sp.page) : 1
  const { rows, total, page, totalPages } = await listCyclesPaged({ page: pageNum })
  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll Runs"
        subtitle="Lifecycle: draft → computed → approved (attendance locks) → locked (payslips ready) → paid"
        actions={<OpenCycleButton />}
      />

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
              <tr>
                <Th>Cycle</Th>
                <Th>Status</Th>
                <Th className="text-right">Employees</Th>
                <Th className="text-right">Gross</Th>
                <Th className="text-right">Deductions</Th>
                <Th className="text-right">Net pay</Th>
                <Th className="text-right">Employer cost</Th>
                <Th>{' '}</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm text-slate-500">
                    No payroll cycles yet. Open one above to get started.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-950">
                  <Td>
                    <Link href={`/payroll/${r.id}`} className="font-medium text-slate-900 hover:text-brand-700 hover:underline dark:text-slate-100">
                      {MONTH_NAMES[r.month - 1]} {r.year}
                    </Link>
                  </Td>
                  <Td>
                    <Badge tone={STATUS_TONE[r.status] ?? 'neutral'}>{r.status}</Badge>
                  </Td>
                  <Td className="text-right tabular-nums">{r.employee_count}</Td>
                  <Td className="text-right tabular-nums">{formatInr(r.total_gross)}</Td>
                  <Td className="text-right tabular-nums">{formatInr(r.total_deductions)}</Td>
                  <Td className="text-right font-semibold tabular-nums">{formatInr(r.total_net_pay)}</Td>
                  <Td className="text-right tabular-nums">{formatInr(r.total_employer_cost)}</Td>
                  <Td><Link href={`/payroll/${r.id}`} className="text-xs font-medium text-brand-700 hover:underline">Open →</Link></Td>
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
        basePath="/payroll"
        searchParams={sp}
        noun={{ singular: 'cycle', plural: 'cycles' }}
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
