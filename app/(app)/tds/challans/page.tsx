import Link from 'next/link'
import { listTdsChallans } from '@/lib/tds/challan-queries'
import { formatInr } from '@/lib/format'
import { MONTH_NAMES } from '@/lib/attendance/engine'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { ButtonLink } from '@/components/ui/button'
import { Pagination } from '@/components/ui/pagination'

export const metadata = { title: 'TDS Challans' }

type SP = Promise<{ page?: string }>

export default async function ChallansListPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams
  const pageNum = sp.page ? Number(sp.page) : 1
  const { rows, total, page, totalPages } = await listTdsChallans({ page: pageNum })

  return (
    <div className="space-y-6">
      <PageHeader
        title="TDS Challans"
        back={{ href: '/tds', label: 'TDS & Form 16' }}
        subtitle={`${total} ${total === 1 ? 'challan' : 'challans'} recorded. Each monthly TDS deposit to the government should be entered here so Form 24Q reconciles.`}
        actions={<ButtonLink href="/tds/challans/new" variant="primary">+ Record challan</ButtonLink>}
      />

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
              <tr>
                <Th>Period</Th>
                <Th>Quarter</Th>
                <Th>BSR code</Th>
                <Th>Challan serial</Th>
                <Th>Deposited</Th>
                <Th className="text-right">TDS ₹</Th>
                <Th className="text-right">Total ₹</Th>
                <Th>{' '}</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm text-slate-500">
                    No challans recorded yet.
                  </td>
                </tr>
              )}
              {rows.map((c) => (
                <tr key={c.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-950">
                  <Td>{MONTH_NAMES[c.month - 1]} {c.year}</Td>
                  <Td>Q{c.quarter}</Td>
                  <Td className="font-mono tabular-nums">{c.bsr_code}</Td>
                  <Td className="font-mono tabular-nums">{c.challan_serial_no}</Td>
                  <Td className="tabular-nums">{c.deposit_date}</Td>
                  <Td className="text-right tabular-nums">{formatInr(c.tds_amount)}</Td>
                  <Td className="text-right font-semibold tabular-nums">{formatInr(c.total_amount)}</Td>
                  <Td>
                    <Link href={`/tds/challans/${c.id}`} className="text-xs font-medium text-brand-700 hover:underline">
                      Edit →
                    </Link>
                  </Td>
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
        basePath="/tds/challans"
        searchParams={sp}
        noun={{ singular: 'challan', plural: 'challans' }}
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
