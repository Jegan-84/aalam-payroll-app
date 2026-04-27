import Link from 'next/link'
import { listCycles } from '@/lib/payroll/queries'
import { buildVarianceReport } from '@/lib/reports/variance'
import { MONTH_NAMES } from '@/lib/attendance/engine'
import { formatInr } from '@/lib/format'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'

export const metadata = { title: 'Payroll Variance' }

type SP = Promise<{ current?: string; previous?: string }>

export default async function VarianceReportPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams
  const cycles = await listCycles()
  const eligible = cycles.filter((c) => c.status === 'approved' || c.status === 'locked' || c.status === 'paid')

  const currentId = sp.current ?? eligible[0]?.id ?? ''
  const previousId = sp.previous ?? eligible[1]?.id ?? ''

  const report = currentId && previousId ? await buildVarianceReport(currentId, previousId) : null

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll Variance"
        back={{ href: '/reports', label: 'Reports' }}
        subtitle="Month-over-month diff between two payroll cycles, grouped by component. Biggest deltas at the top."
        actions={
          <form className="flex items-center gap-2">
            <select name="current" defaultValue={currentId} className={selectCls}>
              {eligible.map((c) => <option key={c.id} value={c.id}>{MONTH_NAMES[c.month - 1]} {c.year} (current)</option>)}
            </select>
            <span className="text-xs text-slate-500">vs.</span>
            <select name="previous" defaultValue={previousId} className={selectCls}>
              {eligible.map((c) => <option key={c.id} value={c.id}>{MONTH_NAMES[c.month - 1]} {c.year}</option>)}
            </select>
            <button className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800">
              Compare
            </button>
          </form>
        }
      />

      {!report ? (
        <Card className="p-8 text-center text-sm text-slate-500">
          Need at least 2 approved payroll cycles to compare. Approve another one from <Link href="/payroll" className="underline">Payroll</Link>.
        </Card>
      ) : (
        <>
          <Card className="p-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Current total" value={formatInr(report.totals.currentTotal)} />
              <Stat label="Previous total" value={formatInr(report.totals.previousTotal)} />
              <Stat label="Δ amount" value={formatInr(report.totals.delta)} />
              <Stat
                label="Δ percent"
                value={report.totals.previousTotal === 0 ? '—' : `${((report.totals.delta / report.totals.previousTotal) * 100).toFixed(2)}%`}
              />
            </div>
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
                  <tr>
                    <Th>Code</Th>
                    <Th>Name</Th>
                    <Th>Kind</Th>
                    <Th className="text-right">Current</Th>
                    <Th className="text-right">Previous</Th>
                    <Th className="text-right">Δ amount</Th>
                    <Th className="text-right">Δ %</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
                  {report.rows.map((r) => (
                    <tr key={r.code} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-950">
                      <Td className="font-mono text-xs">{r.code}</Td>
                      <Td>{r.name}</Td>
                      <Td className="text-xs text-slate-500">{r.kind.replace('_', ' ')}</Td>
                      <Td className="text-right tabular-nums">{formatInr(r.currentTotal)}</Td>
                      <Td className="text-right tabular-nums">{formatInr(r.previousTotal)}</Td>
                      <Td className={`text-right font-semibold tabular-nums ${r.deltaAmount > 0 ? 'text-emerald-700 dark:text-emerald-400' : r.deltaAmount < 0 ? 'text-red-700 dark:text-red-400' : 'text-slate-500'}`}>
                        {r.deltaAmount > 0 ? '+' : ''}{formatInr(r.deltaAmount)}
                      </Td>
                      <Td className={`text-right tabular-nums ${(r.deltaPercent ?? 0) > 0 ? 'text-emerald-700 dark:text-emerald-400' : (r.deltaPercent ?? 0) < 0 ? 'text-red-700 dark:text-red-400' : 'text-slate-500'}`}>
                        {r.deltaPercent == null ? '—' : `${r.deltaPercent > 0 ? '+' : ''}${r.deltaPercent.toFixed(2)}%`}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 ${className}`}>{children}</th>
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-slate-900 dark:text-slate-100 ${className}`}>{children}</td>
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-50">{value}</div>
    </div>
  )
}

const selectCls = 'h-9 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950'
