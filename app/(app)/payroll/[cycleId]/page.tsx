import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCycle, listCycleItems } from '@/lib/payroll/queries'
import { listVpAllocations } from '@/lib/payroll/vp-queries'
import { MONTH_NAMES } from '@/lib/attendance/engine'
import { formatInr } from '@/lib/format'
import { CycleControls } from './_components/cycle-controls'
import { VpToggle } from './_components/vp-toggle'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Stat } from '@/components/ui/stat'
import { Badge } from '@/components/ui/badge'
import { ButtonLink } from '@/components/ui/button'

export const metadata = { title: 'Payroll cycle' }

type PP = Promise<{ cycleId: string }>

const CYCLE_TONE: Record<string, 'neutral' | 'info' | 'warn' | 'success' | 'brand'> = {
  draft: 'neutral', computed: 'info', approved: 'warn', locked: 'success', paid: 'brand',
}

const ITEM_TONE: Record<string, 'neutral' | 'warn' | 'success'> = {
  draft: 'neutral', approved: 'warn', locked: 'success',
}

export default async function CycleDetailPage({ params }: { params: PP }) {
  const { cycleId } = await params
  const [cycle, items, vpAllocs] = await Promise.all([
    getCycle(cycleId),
    listCycleItems(cycleId),
    listVpAllocations(cycleId),
  ])
  if (!cycle) notFound()

  const vpByEmp = new Map(vpAllocs.map((a) => [a.employee_id, a]))
  const showVp = cycle.include_vp

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${MONTH_NAMES[cycle.month - 1]} ${cycle.year}`}
        back={{ href: '/payroll', label: 'Payroll' }}
        subtitle={`${cycle.cycle_start} → ${cycle.cycle_end}`}
        actions={
          <>
            <Badge tone={CYCLE_TONE[cycle.status] ?? 'neutral'}>{cycle.status}</Badge>
            <VpToggle cycleId={cycle.id} enabled={cycle.include_vp} status={cycle.status} />
            <CycleControls cycleId={cycle.id} status={cycle.status} />
            {items.length > 0 && (
              <ButtonLink href={`/api/payslip/${cycle.id}/bulk`} variant="outline">Download all (ZIP)</ButtonLink>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Employees" value={String(cycle.employee_count)} />
        <Stat label="Gross" value={formatInr(cycle.total_gross)} />
        <Stat label="Deductions" value={formatInr(cycle.total_deductions)} />
        <Stat tone="brand" label="Net pay" value={formatInr(cycle.total_net_pay)} />
        <Stat label="Employer cost" value={formatInr(cycle.total_employer_cost)} />
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
              <tr>
                <Th>Employee</Th>
                <Th className="text-right">Paid days</Th>
                <Th className="text-right">LOP</Th>
                <Th className="text-right">Gross</Th>
                {showVp && <Th className="text-right">VP</Th>}
                <Th className="text-right">Deductions</Th>
                <Th className="text-right">TDS</Th>
                <Th className="text-right">Net pay</Th>
                <Th className="text-right">Employer retirals</Th>
                <Th>Status</Th>
                <Th>{' '}</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {items.length === 0 && (
                <tr><td colSpan={showVp ? 11 : 10} className="px-6 py-12 text-center text-sm text-slate-500">
                  No items yet. Click <strong>Compute</strong> to generate payroll for all active employees with a salary structure.
                </td></tr>
              )}
              {items.map((i) => {
                const vp = vpByEmp.get(i.employee_id)
                return (
                <tr key={i.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-950">
                  <Td>
                    <Link href={`/payroll/${cycleId}/${i.employee_id}`} className="font-medium text-slate-900 hover:text-brand-700 hover:underline dark:text-slate-100">
                      {i.employee_name_snapshot}{' '}
                      <span className="text-slate-500">({i.employee_code_snapshot})</span>
                    </Link>
                  </Td>
                  <Td className="text-right tabular-nums">{Number(i.paid_days).toFixed(1)}</Td>
                  <Td className={`text-right tabular-nums ${Number(i.lop_days) > 0 ? 'text-red-700 dark:text-red-400' : ''}`}>
                    {Number(i.lop_days).toFixed(1)}
                  </Td>
                  <Td className="text-right tabular-nums">{formatInr(i.monthly_gross)}</Td>
                  {showVp && (
                    <Td className="text-right tabular-nums">
                      {vp ? (
                        <span title={`${vp.vp_pct}% of annual CTC`}>{formatInr(vp.vp_amount)}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </Td>
                  )}
                  <Td className="text-right tabular-nums">{formatInr(i.total_deductions)}</Td>
                  <Td className="text-right tabular-nums">{formatInr(i.monthly_tds)}</Td>
                  <Td className="text-right font-semibold tabular-nums">{formatInr(i.net_pay)}</Td>
                  <Td className="text-right tabular-nums">{formatInr(i.employer_retirals)}</Td>
                  <Td><Badge tone={ITEM_TONE[i.status] ?? 'neutral'}>{i.status}</Badge></Td>
                  <Td>
                    <a href={`/api/payslip/${cycleId}/${i.employee_id}`} target="_blank" rel="noopener" className="text-xs font-medium text-brand-700 hover:underline">
                      Payslip PDF
                    </a>
                  </Td>
                </tr>
                )
              })}
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
