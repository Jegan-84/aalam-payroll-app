import { getCurrentEmployee } from '@/lib/auth/dal'
import { getFnfForEmployee, getFnf } from '@/lib/fnf/queries'
import { formatInr } from '@/lib/format'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Stat } from '@/components/ui/stat'

export const metadata = { title: 'My F&F' }

const STATUS_TONE: Record<string, 'neutral' | 'info' | 'warn' | 'success'> = {
  draft: 'neutral',
  computed: 'info',
  approved: 'warn',
  paid: 'success',
}

export default async function MyFnfPage() {
  const { employeeId } = await getCurrentEmployee()
  const existing = await getFnfForEmployee(employeeId)

  if (!existing) {
    return (
      <div className="space-y-6">
        <PageHeader title="Full & Final Settlement" subtitle="You don't have an F&F settlement on record." />
        <Card>
          <CardBody>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              F&F appears here when HR initiates your exit settlement. It consolidates your final month&apos;s salary,
              leave encashment, gratuity (if eligible), notice-pay adjustments, any bonuses, and any loan recoveries
              into a single statement with a reconciled final TDS.
            </p>
          </CardBody>
        </Card>
      </div>
    )
  }

  // Only show employees their own computed / approved / paid settlements in full detail.
  // Drafts are HR-side workspace; we just show a "preparing" placeholder.
  if (existing.status === 'draft') {
    return (
      <div className="space-y-6">
        <PageHeader title="Full & Final Settlement" subtitle="Preparation in progress." />
        <Card>
          <CardBody>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              HR is preparing your F&F settlement. Once it&apos;s computed, you&apos;ll see the full breakdown here with the
              net payout amount and the option to download the statement PDF.
            </p>
          </CardBody>
        </Card>
      </div>
    )
  }

  const { settlement, lines } = await getFnf(existing.id)
  if (!settlement) return null

  const earnings = lines.filter((l) => l.kind === 'earning')
  const deductions = lines.filter((l) => l.kind === 'deduction')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Full & Final Settlement"
        subtitle={`Last working day: ${settlement.last_working_day}${settlement.service_years ? ` · ${settlement.service_years} yrs of service` : ''}`}
        actions={
          <>
            <Badge tone={STATUS_TONE[settlement.status] ?? 'neutral'}>{settlement.status}</Badge>
            <a
              href={`/api/fnf/${settlement.id}`}
              target="_blank"
              rel="noopener"
              className="inline-flex h-9 items-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
            >
              Download PDF
            </a>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Gratuity" value={settlement.gratuity_eligible ? formatInr(settlement.gratuity_amount) : '—'} />
        <Stat label="Leave encashed" value={`${Number(settlement.leave_encashment_days).toFixed(1)} days · ${formatInr(settlement.leave_encashment_amount)}`} />
        <Stat label="Final TDS" value={formatInr(settlement.final_tds)} />
        <Stat tone="brand" label="Net payout" value={formatInr(settlement.net_payout)} />
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <Section title="Earnings">
          {earnings.length === 0 && <EmptyRow />}
          {earnings.map((l) => <Line key={l.id} label={l.name} amount={l.amount} />)}
          <LineTotal label="Total earnings" amount={settlement.total_earnings} />
        </Section>
        <Section title="Deductions">
          {deductions.length === 0 && <EmptyRow />}
          {deductions.map((l) => <Line key={l.id} label={l.name} amount={l.amount} />)}
          <LineTotal label="Total deductions" amount={settlement.total_deductions} />
        </Section>
        <Section title="Net payout">
          <LineTotal label="Net payout" amount={settlement.net_payout} emphasis />
        </Section>
      </div>

      <Card>
        <CardHeader><CardTitle>Tax reconciliation</CardTitle></CardHeader>
        <CardBody>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <DT label="FY gross before F&F" value={formatInr(settlement.fy_gross_before_fnf)} />
            <DT label="FY TDS before F&F" value={formatInr(settlement.fy_tds_before_fnf)} />
            <DT label="Final TDS (on F&F)" value={formatInr(settlement.final_tds)} />
          </dl>
          <p className="mt-3 text-xs text-slate-500">
            The Final TDS is computed on your FY income + this settlement minus the TDS already deducted from your monthly
            payslips this financial year. Gratuity is exempt up to ₹20 L, leave encashment up to ₹25 L, under the Income Tax Act.
          </p>
        </CardBody>
      </Card>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-slate-100 p-4 last:border-b-0 dark:border-slate-800">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</div>
      <table className="w-full text-sm"><tbody>{children}</tbody></table>
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
      <td className={`py-1 ${emphasis ? 'font-semibold text-slate-900 dark:text-slate-50' : 'font-medium text-slate-900 dark:text-slate-100'}`}>{label}</td>
      <td className={`py-1 text-right tabular-nums ${emphasis ? 'font-semibold' : 'font-medium'}`}>{formatInr(amount)}</td>
    </tr>
  )
}
function EmptyRow() {
  return <tr><td colSpan={2} className="py-2 text-xs text-slate-500">None.</td></tr>
}
function DT({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">{value}</dd>
    </div>
  )
}
