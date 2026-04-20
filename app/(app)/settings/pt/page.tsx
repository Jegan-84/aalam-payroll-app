import { PageHeader } from '@/components/ui/page-header'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getOrgPtState, listPtPeriods } from '@/lib/settings/pt-queries'
import { rollNewPtPeriodAction } from '@/lib/settings/pt-actions'
import { PeriodEditor } from './_components/period-editor'

export const metadata = { title: 'Professional Tax slabs' }

export default async function PtSettingsPage() {
  const orgState = await getOrgPtState()
  const periods = await listPtPeriods(orgState)

  const currentPeriod = periods.find((p) => p.isCurrent) ?? periods[0]

  // Default next period starts 6 months after current start
  const nextFromDefault = currentPeriod
    ? nextHalf(currentPeriod.effective_from)
    : new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Professional Tax slabs"
        back={{ href: '/settings', label: 'Settings' }}
        subtitle={`State: ${orgState}. Half-yearly. Monthly deduction = half-year PT ÷ 6.`}
      />

      {/* Periods — newest first */}
      {periods.length === 0 ? (
        <Card><CardBody><p className="text-sm text-slate-500">No PT slabs configured. Apply the initial seed first.</p></CardBody></Card>
      ) : (
        periods.map((p) => (
          <Card key={`${p.state_code}-${p.effective_from}`}>
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                {p.state_code} · effective {p.effective_from}
                {p.isCurrent && <Badge tone="success">current</Badge>}
                {!p.isCurrent && p.effective_to && <Badge tone="neutral">ended {p.effective_to}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardBody>
              <PeriodEditor
                stateCode={p.state_code}
                effectiveFrom={p.effective_from}
                effectiveTo={p.effective_to}
                initial={p.slabs.map((s) => ({
                  half_year_gross_min: Number(s.half_year_gross_min),
                  half_year_gross_max: s.half_year_gross_max == null ? null : Number(s.half_year_gross_max),
                  half_year_pt_amount: Number(s.half_year_pt_amount),
                }))}
              />
            </CardBody>
          </Card>
        ))
      )}

      {/* Roll a new period */}
      {currentPeriod && (
        <Card>
          <CardHeader><CardTitle>Start a new period</CardTitle></CardHeader>
          <CardBody>
            <p className="mb-3 text-xs text-slate-600 dark:text-slate-400">
              When the state revises PT rates, start a new period. The current period is closed
              (<code>effective_to</code> set to the day before the new start) and the slabs are
              cloned into the new period. Edit the cloned slabs afterwards.
            </p>
            <form action={rollNewPtPeriodAction} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="state_code" value={currentPeriod.state_code} />
              <div>
                <label className="text-[11px] font-medium uppercase tracking-wide text-slate-500">New effective from</label>
                <input
                  name="new_effective_from"
                  type="date"
                  defaultValue={nextFromDefault}
                  required
                  className="mt-1 block h-9 w-[180px] rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <button className="h-9 rounded-md bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700">
                Roll period
              </button>
            </form>
          </CardBody>
        </Card>
      )}
    </div>
  )
}

function nextHalf(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCMonth(d.getUTCMonth() + 6)
  return d.toISOString().slice(0, 10)
}
