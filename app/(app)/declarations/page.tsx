import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/auth/dal'
import { approveDeclarationAction, rejectDeclarationAction } from '@/lib/tax/actions'
import { countPendingPoi } from '@/lib/poi/queries'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ButtonLink } from '@/components/ui/button'

export const metadata = { title: 'Declarations (HR review)' }

type SP = Promise<{ status?: string }>

const STATUS_TONE: Record<string, 'neutral' | 'warn' | 'success' | 'danger'> = {
  draft: 'neutral',
  submitted: 'warn',
  approved: 'success',
  rejected: 'danger',
}

export default async function DeclarationsListPage({ searchParams }: { searchParams: SP }) {
  await verifySession()
  const sp = await searchParams
  const status = sp.status && ['draft', 'submitted', 'approved', 'rejected'].includes(sp.status) ? sp.status : 'submitted'

  const pendingPoiCount = await countPendingPoi()

  const supabase = await createClient()
  const { data } = await supabase
    .from('employee_tax_declarations')
    .select(
      `
      id, employee_id, fy_start, fy_end, regime, status, submitted_at, reviewed_at, review_notes,
      employee:employees!inner ( employee_code, full_name_snapshot )
    `,
    )
    .eq('status', status)
    .order('submitted_at', { ascending: false })

  type Emb = { employee_code: string; full_name_snapshot: string }
  type Row = NonNullable<typeof data>[number] & { employee: Emb | Emb[] | null }
  const rows = ((data ?? []) as unknown as Row[]).map((r) => ({
    ...r,
    employee: Array.isArray(r.employee) ? r.employee[0] : r.employee,
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tax Declarations"
        subtitle="Only approved declarations are consumed by the payroll engine for OLD regime employees."
        actions={
          <ButtonLink href="/declarations/poi" variant="outline">
            POI queue{pendingPoiCount > 0 ? ` · ${pendingPoiCount}` : ''}
          </ButtonLink>
        }
      />

      <div className="flex flex-wrap gap-2 text-sm">
        {(['submitted', 'approved', 'rejected', 'draft'] as const).map((s) => (
          <Link
            key={s}
            href={`/declarations?status=${s}`}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              status === s
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            {s}
          </Link>
        ))}
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
              <tr>
                <Th>Employee</Th>
                <Th>FY</Th>
                <Th>Regime</Th>
                <Th>Submitted</Th>
                <Th>Status</Th>
                <Th>{' '}</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {rows.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-500">No declarations in &quot;{status}&quot;.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-950">
                  <Td>
                    <span className="font-medium text-slate-900 dark:text-slate-100">{r.employee?.full_name_snapshot}</span>{' '}
                    <span className="text-slate-500">({r.employee?.employee_code})</span>
                  </Td>
                  <Td className="tabular-nums">{String(r.fy_start).slice(0, 4)}-{String(r.fy_end).slice(2, 4)}</Td>
                  <Td>{r.regime}</Td>
                  <Td className="text-xs text-slate-500">{r.submitted_at ? new Date(r.submitted_at).toLocaleDateString('en-IN') : '—'}</Td>
                  <Td><Badge tone={STATUS_TONE[r.status as string] ?? 'neutral'}>{r.status}</Badge></Td>
                  <Td>
                    <div className="flex gap-2">
                      <Link href={`/employees/${r.employee_id}/declaration`} className="text-xs font-medium text-brand-700 hover:underline">View</Link>
                      {status === 'submitted' && (
                        <>
                          <form action={approveDeclarationAction}>
                            <input type="hidden" name="id" value={r.id as string} />
                            <button className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400">Approve</button>
                          </form>
                          <form action={rejectDeclarationAction}>
                            <input type="hidden" name="id" value={r.id as string} />
                            <button className="text-xs font-medium text-red-700 hover:underline dark:text-red-400">Reject</button>
                          </form>
                        </>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
