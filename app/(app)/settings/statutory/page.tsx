import { notFound } from 'next/navigation'
import { verifySession } from '@/lib/auth/dal'
import { listStatutoryPeriods } from '@/lib/statutory/queries'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatInr } from '@/lib/format'
import { StatutoryForm } from './_components/statutory-form'
import { RollPeriodForm } from './_components/roll-period-form'

export const metadata = { title: 'Statutory Configuration' }

export default async function StatutorySettingsPage() {
  await verifySession()
  const periods = await listStatutoryPeriods()
  if (periods.length === 0) notFound()

  const current = periods.find((p) => p.isCurrent) ?? periods[0]
  const today = new Date().toISOString().slice(0, 10)

  // Minimum allowed new-period start date: one day AFTER current period started.
  const minDate = (() => {
    const d = new Date(current.effective_from + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() + 1)
    return d.toISOString().slice(0, 10)
  })()

  return (
    <div className="max-w-4xl space-y-8">
      <PageHeader
        title="Statutory Configuration"
        back={{ href: '/settings', label: 'Settings' }}
        subtitle="CTC structure (BASIC / HRA / Conveyance), PF, ESI, and Gratuity rates. Government rates usually change yearly — use 'Roll new period' so historical payslips stay reconstructable against the rates in force at the time."
      />

      {/* History */}
      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">History</div>
          <span className="text-xs text-slate-500">{periods.length} period{periods.length === 1 ? '' : 's'} on record</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
              <tr>
                <Th>Effective from</Th>
                <Th>Effective to</Th>
                <Th>CTC split</Th>
                <Th>PF</Th>
                <Th>ESI</Th>
                <Th>Gratuity</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {periods.map((p) => (
                <tr key={p.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-950">
                  <Td className="tabular-nums">{p.effective_from}</Td>
                  <Td className="tabular-nums">{p.effective_to ?? <span className="text-slate-400">open</span>}</Td>
                  <Td className="text-xs text-slate-600 dark:text-slate-400">
                    {p.basic_percent_of_gross}% / {p.hra_percent_of_basic}% / {p.conv_percent_of_basic}% (cap ₹{p.conv_monthly_cap})
                  </Td>
                  <Td className="text-xs text-slate-600 dark:text-slate-400">
                    {p.epf_employee_percent}% + {p.epf_employer_percent}%, ceil {formatInr(p.epf_wage_ceiling)}
                  </Td>
                  <Td className="text-xs text-slate-600 dark:text-slate-400">
                    {p.esi_employee_percent}% + {p.esi_employer_percent}%, ≤ {formatInr(p.esi_wage_ceiling)}
                    <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      on {p.esi_basis}
                    </span>
                  </Td>
                  <Td className="text-xs text-slate-600 dark:text-slate-400">{p.gratuity_percent}%</Td>
                  <Td>
                    {p.isCurrent ? (
                      <Badge tone="success">current</Badge>
                    ) : p.effective_to ? (
                      <Badge tone="neutral">ended {p.effective_to}</Badge>
                    ) : (
                      <Badge tone="info">future</Badge>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Current period — editable for typo fixes */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Current period</h2>
          <span className="text-xs text-slate-500">effective from {current.effective_from}</span>
        </div>
        <StatutoryForm defaults={current} />
        <p className="mt-2 text-xs text-slate-500">
          This form edits the <strong>current row</strong> in place — use it only to fix typos. For annual rate changes, roll a new period below so history is preserved.
        </p>
      </div>

      {/* Roll new period */}
      <Card>
        <CardHeader><CardTitle>Roll a new period</CardTitle></CardHeader>
        <CardBody>
          <p className="mb-3 text-xs text-slate-600 dark:text-slate-400">
            Use this when the government revises rates (EPF ceiling, gratuity %) or your CTC policy changes. The current period
            will be closed (<code>effective_to</code> set to the day before the new effective date), and a new row is inserted
            with the values below. Historical payroll computes still use the rates that applied at the time.
          </p>
          <RollPeriodForm seed={current} minDate={minDate} />
          <p className="mt-2 text-[11px] text-slate-500">
            Tip: time a roll for <strong>1 April</strong> (start of FY) for yearly rate revisions, or the month of the actual
            government notification. Today is {today}.
          </p>
        </CardBody>
      </Card>
    </div>
  )
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 ${className}`}>{children}</th>
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-top text-slate-900 dark:text-slate-100 ${className}`}>{children}</td>
}
