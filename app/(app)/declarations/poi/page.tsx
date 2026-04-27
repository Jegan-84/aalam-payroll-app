import Link from 'next/link'
import { listPoiReviewQueue, type PoiStatus, SECTION_LABELS } from '@/lib/poi/queries'
import { getCurrentFy, listAvailableFys } from '@/lib/tds/queries'
import { formatInr } from '@/lib/format'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Pagination } from '@/components/ui/pagination'
import { ReviewActions } from './_components/review-actions'

export const metadata = { title: 'POI Review' }

type SP = Promise<{ fy?: string; status?: string; page?: string }>

const STATUSES: PoiStatus[] = ['pending', 'approved', 'rejected']

const STATUS_TONE: Record<PoiStatus, string> = {
  pending:  'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200',
}

export default async function PoiQueuePage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams
  const currentFy = await getCurrentFy()
  const fyStart = sp.fy && /^\d{4}-\d{2}-\d{2}$/.test(sp.fy) ? sp.fy : currentFy.fyStart
  const status = STATUSES.includes(sp.status as PoiStatus) ? (sp.status as PoiStatus) : 'pending'
  const pageNum = sp.page ? Number(sp.page) : 1

  const availableFys = await listAvailableFys()
  const allFys = (() => {
    const set = new Map<string, { fyStart: string; label: string }>()
    set.set(currentFy.fyStart, { fyStart: currentFy.fyStart, label: currentFy.label })
    for (const f of availableFys) set.set(f.fyStart, { fyStart: f.fyStart, label: f.label })
    return Array.from(set.values()).sort((a, b) => (a.fyStart < b.fyStart ? 1 : -1))
  })()

  const { rows, total, page, totalPages } = await listPoiReviewQueue({
    fyStart,
    status,
    page: pageNum,
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Proof of Investment — Review"
        subtitle={`Employees upload tax proofs (rent receipts, 80C certificates, etc.) for OLD-regime claims. Review each one before approving the final declaration.`}
        back={{ href: '/declarations', label: 'Declarations' }}
        actions={
          <form className="flex items-center gap-2">
            <select name="fy" defaultValue={fyStart} className={selectCls}>
              {allFys.map((f) => <option key={f.fyStart} value={f.fyStart}>FY {f.label}</option>)}
            </select>
            <button className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800">
              Apply
            </button>
          </form>
        }
      />

      <div className="flex flex-wrap gap-2 text-sm">
        {STATUSES.map((s) => (
          <TabLink key={s} href={`/declarations/poi?fy=${fyStart}&status=${s}`} label={s} active={status === s} />
        ))}
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
              <tr>
                <Th>Uploaded</Th>
                <Th>Employee</Th>
                <Th>Section</Th>
                <Th>Description</Th>
                <Th className="text-right">Claimed</Th>
                <Th>File</Th>
                <Th>Status</Th>
                <Th>Action</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm text-slate-500">
                    No {status} proofs for FY {allFys.find((f) => f.fyStart === fyStart)?.label ?? ''}.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-950">
                  <Td className="text-xs text-slate-500">{r.uploaded_at.slice(0, 10)}</Td>
                  <Td>
                    {r.employee ? (
                      <Link href={`/employees/${r.employee.id}/declaration`} className="font-medium text-slate-900 hover:text-brand-700 hover:underline dark:text-slate-100">
                        {r.employee.full_name_snapshot}{' '}
                        <span className="text-slate-500">({r.employee.employee_code})</span>
                      </Link>
                    ) : '—'}
                  </Td>
                  <Td>
                    <span className="font-mono text-xs">{r.section}</span>
                    <div className="text-[11px] text-slate-500">{SECTION_LABELS[r.section]}</div>
                  </Td>
                  <Td>{r.sub_category ?? '—'}</Td>
                  <Td className="text-right tabular-nums">{formatInr(r.claimed_amount)}</Td>
                  <Td>
                    <a href={`/api/poi/${r.id}`} target="_blank" rel="noopener" className="text-xs font-medium text-brand-700 hover:underline">
                      {r.file_name}
                    </a>
                    {r.file_size_bytes && (
                      <div className="text-[10px] text-slate-400">{Math.round(r.file_size_bytes / 1024)} KB</div>
                    )}
                  </Td>
                  <Td>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_TONE[r.status]}`}>
                      {r.status}
                    </span>
                    {r.review_notes && r.status === 'rejected' && (
                      <div className="mt-0.5 text-[11px] text-red-700 dark:text-red-400">{r.review_notes}</div>
                    )}
                  </Td>
                  <Td>
                    <ReviewActions id={r.id} status={r.status} />
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
        basePath="/declarations/poi"
        searchParams={sp}
        noun={{ singular: 'proof', plural: 'proofs' }}
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

const selectCls = 'h-9 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950'
