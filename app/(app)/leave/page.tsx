import Link from 'next/link'
import { listLeaveApplications, type LeaveStatus } from '@/lib/leave/queries'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ButtonLink } from '@/components/ui/button'
import { Pagination } from '@/components/ui/pagination'
import { LeaveBulkUpload } from './_components/leave-bulk-upload'

export const metadata = { title: 'Leave' }

type SP = Promise<{ status?: string; page?: string }>

const STATUS_TONE: Record<LeaveStatus, 'warn' | 'success' | 'danger' | 'neutral'> = {
  pending:          'warn',
  manager_approved: 'warn',
  approved:         'success',
  rejected:         'danger',
  cancelled:        'neutral',
}

const STATUS_LABEL: Record<LeaveStatus, string> = {
  pending:          'awaiting manager',
  manager_approved: 'awaiting HR',
  approved:         'approved',
  rejected:         'rejected',
  cancelled:        'cancelled',
}

export default async function LeaveListPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams
  const status = (sp.status && ['pending','manager_approved','approved','rejected','cancelled'].includes(sp.status)
    ? (sp.status as LeaveStatus)
    : undefined)
  const pageNum = sp.page ? Number(sp.page) : 1
  const { rows, total, page, totalPages } = await listLeaveApplications({ status, page: pageNum })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave"
        subtitle={`${total} ${total === 1 ? 'application' : 'applications'}`}
        actions={
          <>
            <LeaveBulkUpload />
            <ButtonLink href="/leave/balances" variant="outline">Balances</ButtonLink>
            <ButtonLink href="/leave/new" variant="primary">+ Apply for leave</ButtonLink>
          </>
        }
      />

      <div className="flex flex-wrap gap-2 text-sm">
        <TabLink href="/leave" label="All" active={!status} />
        <TabLink href="/leave?status=pending" label="Awaiting manager" active={status === 'pending'} />
        <TabLink href="/leave?status=manager_approved" label="Awaiting HR" active={status === 'manager_approved'} />
        <TabLink href="/leave?status=approved" label="Approved" active={status === 'approved'} />
        <TabLink href="/leave?status=rejected" label="Rejected" active={status === 'rejected'} />
        <TabLink href="/leave?status=cancelled" label="Cancelled" active={status === 'cancelled'} />
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
              <tr>
                <Th>Employee</Th>
                <Th>Type</Th>
                <Th>From</Th>
                <Th>To</Th>
                <Th className="text-right">Days</Th>
                <Th>Applied</Th>
                <Th>Status</Th>
                <Th>{' '}</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {rows.length === 0 && (
                <tr><td colSpan={8} className="px-6 py-12 text-center text-sm text-slate-500">No leave applications.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-950">
                  <Td>
                    <span className="font-medium text-slate-900 dark:text-slate-100">{r.employee.full_name_snapshot}</span>{' '}
                    <span className="text-slate-500">({r.employee.employee_code})</span>
                  </Td>
                  <Td><Badge tone="brand">{r.leave_type.code}</Badge></Td>
                  <Td className="tabular-nums">{r.from_date}</Td>
                  <Td className="tabular-nums">{r.to_date}</Td>
                  <Td className="text-right">
                    <span className="tabular-nums">{Number(r.days_count).toFixed(1)}</span>
                    {r.is_half_day && (
                      <span className="ml-1.5 inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                        ½ day
                      </span>
                    )}
                  </Td>
                  <Td className="text-xs text-slate-500">{formatTs(r.applied_at)}</Td>
                  <Td><Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge></Td>
                  <Td><Link href={`/leave/${r.id}`} className="text-xs font-medium text-brand-700 hover:underline">View →</Link></Td>
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
        basePath="/leave"
        searchParams={sp}
        noun={{ singular: 'application', plural: 'applications' }}
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
function formatTs(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}
