import Link from 'next/link'
import { listReimbursementQueue, CATEGORY_LABELS, type ReimbursementStatus } from '@/lib/reimbursements/queries'
import { formatInr } from '@/lib/format'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Pagination } from '@/components/ui/pagination'
import { ReviewActions } from './_components/review-actions'

export const metadata = { title: 'Reimbursements' }

type SP = Promise<{ status?: string; page?: string }>

const STATUSES: ReimbursementStatus[] = ['pending', 'approved', 'paid', 'rejected']

const STATUS_TONE: Record<ReimbursementStatus, string> = {
  pending:  'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
  approved: 'bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200',
  paid:     'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
}

export default async function ReimbursementsQueuePage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams
  const status = STATUSES.includes(sp.status as ReimbursementStatus) ? (sp.status as ReimbursementStatus) : 'pending'
  const pageNum = sp.page ? Number(sp.page) : 1

  const { rows, total, page, totalPages } = await listReimbursementQueue({ status, page: pageNum })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reimbursements"
        subtitle="Employee-submitted expense claims. Approved claims flow into the next payroll compute as earning lines; they become paid when that cycle is approved."
      />

      <div className="flex flex-wrap gap-2 text-sm">
        {STATUSES.map((s) => (
          <TabLink key={s} href={`/reimbursements?status=${s}`} label={s} active={status === s} />
        ))}
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
              <tr>
                <Th>Submitted</Th>
                <Th>Employee</Th>
                <Th>Category</Th>
                <Th>Description</Th>
                <Th>Claim date</Th>
                <Th className="text-right">Amount</Th>
                <Th>Receipt</Th>
                <Th>Status</Th>
                <Th>Action</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-sm text-slate-500">
                    No {status} claims.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-950">
                  <Td className="text-xs text-slate-500">{r.submitted_at.slice(0, 10)}</Td>
                  <Td>
                    {r.employee ? (
                      <Link href={`/employees/${r.employee.id}`} className="font-medium text-slate-900 hover:text-brand-700 hover:underline dark:text-slate-100">
                        {r.employee.full_name_snapshot}{' '}
                        <span className="text-slate-500">({r.employee.employee_code})</span>
                      </Link>
                    ) : '—'}
                  </Td>
                  <Td className="text-xs">{CATEGORY_LABELS[r.category]}</Td>
                  <Td>{r.sub_category ?? '—'}</Td>
                  <Td className="tabular-nums">{r.claim_date}</Td>
                  <Td className="text-right font-semibold tabular-nums">{formatInr(r.amount)}</Td>
                  <Td>
                    <a href={`/api/reimbursement/${r.id}`} target="_blank" rel="noopener" className="text-xs font-medium text-brand-700 hover:underline">
                      {r.file_name}
                    </a>
                  </Td>
                  <Td>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_TONE[r.status]}`}>
                      {r.status}
                    </span>
                    {r.review_notes && r.status === 'rejected' && (
                      <div className="mt-0.5 text-[11px] text-red-700 dark:text-red-400">{r.review_notes}</div>
                    )}
                  </Td>
                  <Td><ReviewActions id={r.id} status={r.status} /></Td>
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
        basePath="/reimbursements"
        searchParams={sp}
        noun={{ singular: 'claim', plural: 'claims' }}
      />
    </div>
  )
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 ${className}`}>{children}</th>
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-top text-slate-900 dark:text-slate-100 ${className}`}>{children}</td>
}
function TabLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors ${
        active
          ? 'border-brand-600 bg-brand-600 text-white'
          : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
      }`}
    >
      {label}
    </Link>
  )
}
