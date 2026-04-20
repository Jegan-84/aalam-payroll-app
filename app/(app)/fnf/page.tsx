import Link from 'next/link'
import { listFnfSettlements } from '@/lib/fnf/queries'
import { formatInr } from '@/lib/format'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Pagination } from '@/components/ui/pagination'

export const metadata = { title: 'Full & Final Settlements' }

type SP = Promise<{ page?: string }>

const STATUS_TONE: Record<string, 'neutral' | 'info' | 'warn' | 'success'> = {
  draft: 'neutral',
  computed: 'info',
  approved: 'warn',
  paid: 'success',
}

export default async function FnfListPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams
  const pageNum = sp.page ? Number(sp.page) : 1
  const { rows, total, page, totalPages } = await listFnfSettlements({ page: pageNum })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Full & Final Settlements"
        subtitle={`${total} ${total === 1 ? 'settlement' : 'settlements'} · initiate from the employee profile`}
      />

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
              <tr>
                <Th>Employee</Th>
                <Th>LWD</Th>
                <Th className="text-right">Tenure</Th>
                <Th className="text-right">Gratuity</Th>
                <Th className="text-right">Leave enc.</Th>
                <Th className="text-right">TDS</Th>
                <Th className="text-right">Net</Th>
                <Th>Status</Th>
                <Th>{' '}</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {rows.length === 0 && (
                <tr><td colSpan={9} className="px-6 py-12 text-center text-sm text-slate-500">No settlements yet.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-950">
                  <Td>
                    <Link href={`/fnf/${r.id}`} className="font-medium text-slate-900 hover:text-brand-700 hover:underline dark:text-slate-100">
                      {r.employee_name_snapshot}{' '}
                      <span className="text-slate-500">({r.employee_code_snapshot})</span>
                    </Link>
                  </Td>
                  <Td className="tabular-nums">{r.last_working_day}</Td>
                  <Td className="text-right tabular-nums">{Number(r.service_years).toFixed(2)} yrs</Td>
                  <Td className="text-right tabular-nums">{r.gratuity_eligible ? formatInr(r.gratuity_amount) : '—'}</Td>
                  <Td className="text-right tabular-nums">{formatInr(r.leave_encashment_amount)}</Td>
                  <Td className="text-right tabular-nums">{formatInr(r.final_tds)}</Td>
                  <Td className="text-right font-semibold tabular-nums">{formatInr(r.net_payout)}</Td>
                  <Td><Badge tone={STATUS_TONE[r.status] ?? 'neutral'}>{r.status}</Badge></Td>
                  <Td><Link href={`/fnf/${r.id}`} className="text-xs font-medium text-brand-700 hover:underline">Open →</Link></Td>
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
        basePath="/fnf"
        searchParams={sp}
        noun={{ singular: 'settlement', plural: 'settlements' }}
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
