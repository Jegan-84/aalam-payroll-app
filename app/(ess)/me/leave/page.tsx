import Link from 'next/link'
import { getCurrentEmployee } from '@/lib/auth/dal'
import {
  getEmployeeFyBalances,
  getLeaveTypes,
  listLeaveApplications,
} from '@/lib/leave/queries'
import { resolveLeaveYear } from '@/lib/leave/year'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ButtonLink } from '@/components/ui/button'

export const metadata = { title: 'My Leave' }

const STATUS_TONE: Record<string, 'warn' | 'success' | 'danger' | 'neutral'> = {
  pending: 'warn',
  approved: 'success',
  rejected: 'danger',
  cancelled: 'neutral',
}

export default async function MyLeavePage() {
  const { employeeId } = await getCurrentEmployee()
  const ly = resolveLeaveYear()

  const [balances, leaveTypes, apps] = await Promise.all([
    getEmployeeFyBalances(employeeId, ly.yearStart),
    getLeaveTypes(),
    listLeaveApplications({ employee_id: employeeId, pageSize: 50 }),
  ])

  const typeById = new Map(leaveTypes.map((lt) => [lt.id, lt]))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave"
        subtitle={`Leave year ${ly.label} (Jan–Dec) balances and application history.`}
        actions={<ButtonLink href="/me/leave/new" variant="primary">+ Apply for leave</ButtonLink>}
      />

      <Card className="overflow-hidden p-0">
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-50">
          Balances · {ly.label}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
              <tr>
                <Th>Type</Th>
                <Th className="text-right">Opening</Th>
                <Th className="text-right">Accrued</Th>
                <Th className="text-right">Carried fwd</Th>
                <Th className="text-right">Used</Th>
                <Th className="text-right">Encashed</Th>
                <Th className="text-right">Balance</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {balances.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-sm text-slate-500">No balances seeded for this FY yet.</td></tr>
              )}
              {balances.map((b) => {
                const lt = typeById.get(b.leave_type_id)
                return (
                  <tr key={`${b.leave_type_id}`} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-950">
                    <Td>
                      <Badge tone="brand">{lt?.code ?? '—'}</Badge>
                      <span className="ml-2 text-xs text-slate-500">{lt?.name}</span>
                    </Td>
                    <Td className="text-right tabular-nums">{Number(b.opening_balance).toFixed(1)}</Td>
                    <Td className="text-right tabular-nums">{Number(b.accrued).toFixed(1)}</Td>
                    <Td className="text-right tabular-nums">{Number(b.carried_forward).toFixed(1)}</Td>
                    <Td className="text-right tabular-nums">{Number(b.used).toFixed(1)}</Td>
                    <Td className="text-right tabular-nums">{Number(b.encashed).toFixed(1)}</Td>
                    <Td className="text-right font-semibold tabular-nums">{Number(b.current_balance).toFixed(1)}</Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-50">
          My applications
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
              <tr>
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
              {apps.rows.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-sm text-slate-500">
                  No leave applications yet. <Link href="/me/leave/new" className="text-brand-700 underline">Apply now →</Link>
                </td></tr>
              )}
              {apps.rows.map((r) => (
                <tr key={r.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-950">
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
                  <Td className="text-xs text-slate-500">{new Date(r.applied_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</Td>
                  <Td><Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge></Td>
                  <Td>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-500">{r.reason ?? '—'}</span>
                      {(r.status === 'rejected' || r.status === 'cancelled') && (
                        <Link
                          href={`/me/leave/new?from_application=${r.id}`}
                          className="shrink-0 text-[11px] font-medium text-brand-700 hover:underline dark:text-brand-400"
                        >
                          Re-apply →
                        </Link>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-xs text-slate-500">
        Leave applications go to HR for approval. Once approved, your Used count increases and the cycle reflects it on your next payslip.
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
