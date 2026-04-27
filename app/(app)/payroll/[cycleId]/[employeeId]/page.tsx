import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCycle, getCycleItem } from '@/lib/payroll/queries'
import { getVpAllocation, getEmployeeActiveCtc } from '@/lib/payroll/vp-queries'
import { listAdjustments, listEmployeeComponents } from '@/lib/components/queries'
import { MONTH_NAMES } from '@/lib/attendance/engine'
import { formatInr } from '@/lib/format'
import { AdjustmentsPanel } from './_components/adjustments-panel'
import { VpEditor } from './_components/vp-editor'

export const metadata = { title: 'Payslip preview' }

type PP = Promise<{ cycleId: string; employeeId: string }>

type Comp = {
  code: string
  name: string
  kind: 'earning' | 'deduction' | 'employer_retiral' | 'reimbursement' | 'variable' | 'perquisite'
  amount: number
  display_order: number
}

export default async function ItemDetailPage({ params }: { params: PP }) {
  const { cycleId, employeeId } = await params
  const [cycle, cycleItem, recurring, adjustments, vp, ctcInfo] = await Promise.all([
    getCycle(cycleId),
    getCycleItem(cycleId, employeeId),
    listEmployeeComponents(employeeId),
    listAdjustments(cycleId, employeeId),
    getVpAllocation(cycleId, employeeId),
    getEmployeeActiveCtc(employeeId),
  ])
  const { item, components } = cycleItem
  if (!cycle || !item) notFound()

  const annualCtc = ctcInfo?.annualFixedCtc ?? 0
  const seedPct = vp?.vp_pct ?? ctcInfo?.variablePayPercent ?? 0
  const seedAmount = vp?.vp_amount ?? Math.round((annualCtc * seedPct) / 100)

  const comps = (components as unknown as Comp[]).slice().sort((a, b) => a.display_order - b.display_order)

  const earnings = comps.filter((c) => c.kind === 'earning')
  const deductions = comps.filter((c) => c.kind === 'deduction')
  const retirals = comps.filter((c) => c.kind === 'employer_retiral')
  const reimb = comps.filter((c) => c.kind === 'reimbursement')
  const perquisites = comps.filter((c) => c.kind === 'perquisite')

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href={`/payroll/${cycleId}`} className="text-sm text-slate-500 hover:underline">← Cycle</Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            {item.employee_name_snapshot}{' '}
            <span className="text-base font-normal text-slate-500">({item.employee_code_snapshot})</span>
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {MONTH_NAMES[cycle.month - 1]} {cycle.year} · {item.tax_regime_snapshot} regime
          </p>
        </div>
        <a
          href={`/api/payslip/${cycleId}/${employeeId}`}
          target="_blank"
          rel="noopener"
          className="inline-flex h-9 items-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
        >
          Payslip PDF
        </a>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Paid days" value={`${Number(item.paid_days).toFixed(1)} / ${item.days_in_month}`} />
        <Stat label="LOP" value={Number(item.lop_days).toFixed(1)} />
        <Stat label="Proration" value={`${(Number(item.proration_factor) * 100).toFixed(2)}%`} />
        <Stat label="Status" value={String(item.status)} />
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <Section title="Earnings (paid)">
          {earnings.map((c) => <Line key={c.code} label={c.name} amount={c.amount} />)}
          <LineTotal label="Gross earnings" amount={Number(item.total_earnings)} />
        </Section>
        <Section title="Deductions">
          {deductions.map((c) => <Line key={c.code} label={c.name} amount={c.amount} />)}
          <LineTotal label="Total deductions" amount={Number(item.total_deductions)} />
          <LineTotal label="Net pay" amount={Number(item.net_pay)} emphasis />
        </Section>
        <Section title="Employer retirals">
          {retirals.map((c) => <Line key={c.code} label={c.name} amount={c.amount} />)}
          <LineTotal label="Total retirals" amount={Number(item.employer_retirals)} />
        </Section>
        {reimb.length > 0 && (
          <Section title="Reimbursements (monthly share)">
            {reimb.map((c) => <Line key={c.code} label={c.name} amount={c.amount} />)}
          </Section>
        )}
        {perquisites.length > 0 && (
          <Section title="Notional perquisites (taxable, not paid)">
            {perquisites.map((c) => <Line key={c.code} label={c.name} amount={c.amount} />)}
            <tr>
              <td colSpan={2} className="pt-1 text-[11px] text-slate-500">
                Folded into annualised gross for TDS only. Does not affect net pay, PF, or ESI.
              </td>
            </tr>
          </Section>
        )}
      </div>

      {annualCtc > 0 && (
        <VpEditor
          cycleId={cycleId}
          employeeId={employeeId}
          cycleStatus={cycle.status}
          cycleIncludesVp={cycle.include_vp}
          annualCtc={annualCtc}
          initialPct={seedPct}
          initialAmount={seedAmount}
        />
      )}

      <AdjustmentsPanel
        cycleId={cycleId}
        employeeId={employeeId}
        cycleStatus={cycle.status}
        itemComponents={comps.map((c) => ({
          code: c.code,
          name: c.name,
          kind: c.kind,
          amount: Number(c.amount),
        }))}
        recurring={recurring.filter((r) => r.is_active).map((r) => ({
          code: r.code,
          name: r.name,
          kind: r.kind,
          monthly_amount: Number(r.monthly_amount),
          prorate: Boolean(r.prorate),
        }))}
        adjustments={adjustments.map((a) => ({
          id: a.id,
          code: a.code,
          name: a.name,
          kind: a.kind,
          amount: Number(a.amount),
          action: a.action,
          notes: a.notes,
        }))}
      />

      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">TDS diagnostics</div>
        <div className="mt-1 grid grid-cols-2 gap-2 text-slate-800 dark:text-slate-200 sm:grid-cols-4">
          <Fact label="Monthly TDS" value={formatInr(Number(item.monthly_tds))} />
          <Fact label="Annual tax (est.)" value={formatInr(Number(item.annual_tax_estimate))} />
          <Fact label="Tax regime" value={String(item.tax_regime_snapshot ?? '—')} />
          <Fact label="PAN" value={String(item.pan_snapshot ?? '—')} />
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-50">{value}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-slate-100 p-4 last:border-b-0 dark:border-slate-800">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {title}
      </div>
      <table className="w-full text-sm">
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}
function Line({ label, amount }: { label: string; amount: number }) {
  return (
    <tr>
      <td className="py-1 text-slate-800 dark:text-slate-200">{label}</td>
      <td className="py-1 text-right tabular-nums">{formatInr(amount)}</td>
    </tr>
  )
}
function LineTotal({ label, amount, emphasis }: { label: string; amount: number; emphasis?: boolean }) {
  return (
    <tr className="border-t border-slate-200 dark:border-slate-800">
      <td className={`py-1 ${emphasis ? 'font-semibold text-slate-900 dark:text-slate-50' : 'font-medium text-slate-900 dark:text-slate-100'}`}>
        {label}
      </td>
      <td className={`py-1 text-right tabular-nums ${emphasis ? 'font-semibold' : 'font-medium'}`}>
        {formatInr(amount)}
      </td>
    </tr>
  )
}
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-slate-900 dark:text-slate-100">{value}</div>
    </div>
  )
}
