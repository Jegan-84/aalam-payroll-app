import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getFnf } from '@/lib/fnf/queries'
import { formatInr } from '@/lib/format'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Stat } from '@/components/ui/stat'
import { FnfControls } from './_components/fnf-controls'
import { ManualLinesPanel } from './_components/manual-lines-panel'

export const metadata = { title: 'F&F Settlement' }

type PP = Promise<{ id: string }>

const STATUS_TONE: Record<string, 'neutral' | 'info' | 'warn' | 'success' | 'brand'> = {
  draft: 'neutral',
  computed: 'info',
  approved: 'warn',
  paid: 'success',
}

export default async function FnfDetailPage({ params }: { params: PP }) {
  const { id } = await params
  const { settlement, lines } = await getFnf(id)
  if (!settlement) notFound()

  const autoLines = lines.filter((l) => l.source === 'auto')
  const manualLines = lines.filter((l) => l.source === 'manual')
  const earnings = autoLines.filter((l) => l.kind === 'earning')
  const deductions = autoLines.filter((l) => l.kind === 'deduction')

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title={`${settlement.employee_name_snapshot} · F&F`}
        back={{ href: `/employees/${settlement.employee_id}/fnf`, label: settlement.employee_name_snapshot }}
        subtitle={`Last working day: ${settlement.last_working_day} · ${settlement.tax_regime_snapshot} regime`}
        actions={
          <>
            <Badge tone={STATUS_TONE[settlement.status] ?? 'neutral'}>{settlement.status}</Badge>
            <FnfControls id={settlement.id} status={settlement.status} />
            {settlement.status !== 'draft' && (
              <a
                href={`/api/fnf/${settlement.id}`}
                target="_blank"
                rel="noopener"
                className="inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
              >
                Download PDF
              </a>
            )}
          </>
        }
      />

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Tenure" value={`${settlement.service_years} yrs`} />
        <Stat
          label="Gratuity"
          value={settlement.gratuity_eligible ? formatInr(settlement.gratuity_amount) : '—'}
        />
        <Stat label="Leave encashed" value={`${Number(settlement.leave_encashment_days).toFixed(1)} days`} />
        <Stat label="Final TDS" value={formatInr(settlement.final_tds)} />
        <Stat tone="brand" label="Net payout" value={formatInr(settlement.net_payout)} />
      </div>

      {/* Inputs snapshot */}
      <Card>
        <CardHeader><CardTitle>Inputs</CardTitle></CardHeader>
        <CardBody>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <DT label="Employee" value={`${settlement.employee_name_snapshot} (${settlement.employee_code_snapshot})`} />
            <DT label="PAN" value={settlement.pan_snapshot ?? '—'} />
            <DT label="Date of joining" value={settlement.date_of_joining_snapshot} />
            <DT label="Last working day" value={settlement.last_working_day} />
            <DT label="Service" value={`${settlement.service_days} days (${settlement.service_years} yrs)`} />
            <DT label="Notice period" value={`${settlement.notice_period_days} days`} />
            <DT label="Notice served" value={`${settlement.notice_days_served} days`} />
            <DT label="Monthly gross (last)" value={formatInr(settlement.monthly_gross_snapshot)} />
            <DT label="FY gross (before F&F)" value={formatInr(settlement.fy_gross_before_fnf)} />
            <DT label="FY TDS (before F&F)" value={formatInr(settlement.fy_tds_before_fnf)} />
          </dl>
        </CardBody>
      </Card>

      {/* Auto lines */}
      {settlement.status === 'draft' ? (
        <Card>
          <CardBody>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Click <strong>Compute</strong> above to generate salary proration, leave encashment,
              gratuity, notice adjustments, and final TDS.
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <Section title="Earnings (auto)">
            {earnings.length === 0 && <EmptyRow />}
            {earnings.map((l) => <Line key={l.id} label={l.name} amount={l.amount} />)}
            <LineTotal label="Auto earnings" amount={earnings.reduce((s, l) => s + l.amount, 0)} />
          </Section>
          <Section title="Deductions (auto)">
            {deductions.length === 0 && <EmptyRow />}
            {deductions.map((l) => <Line key={l.id} label={l.name} amount={l.amount} />)}
            <LineTotal label="Auto deductions" amount={deductions.reduce((s, l) => s + l.amount, 0)} />
          </Section>
          <Section title="Totals">
            <Line label="Total earnings" amount={settlement.total_earnings} />
            <Line label="Total deductions" amount={settlement.total_deductions} />
            <LineTotal label="Net payout" amount={settlement.net_payout} emphasis />
          </Section>
        </div>
      )}

      <ManualLinesPanel
        settlementId={settlement.id}
        status={settlement.status}
        lines={manualLines.map((l) => ({
          id: l.id,
          code: l.code,
          name: l.name,
          kind: l.kind,
          amount: l.amount,
        }))}
      />

      {settlement.status === 'draft' && (
        <p className="text-xs text-slate-500">
          New or edited manual lines take effect only after the next <strong>Compute</strong>.{' '}
          <Link href={`/employees/${settlement.employee_id}/fnf`} className="underline">Back to employee F&F</Link>
        </p>
      )}
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
