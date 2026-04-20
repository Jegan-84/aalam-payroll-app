import Link from 'next/link'
import { getCurrentFy, listAvailableFys, summarizeFyForAll } from '@/lib/tds/queries'
import { formatInr } from '@/lib/format'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Stat } from '@/components/ui/stat'
import { ButtonLink } from '@/components/ui/button'

export const metadata = { title: 'TDS & Form 16' }

type SP = Promise<{ fy?: string }>

export default async function TdsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams
  const currentFy = await getCurrentFy()
  const fyStart = sp.fy && /^\d{4}-\d{2}-\d{2}$/.test(sp.fy) ? sp.fy : currentFy.fyStart

  const [availableFys, rows] = await Promise.all([listAvailableFys(), summarizeFyForAll(fyStart)])

  const allFys = (() => {
    const set = new Map<string, { fyStart: string; label: string }>()
    set.set(currentFy.fyStart, { fyStart: currentFy.fyStart, label: currentFy.label })
    for (const f of availableFys) set.set(f.fyStart, { fyStart: f.fyStart, label: f.label })
    return Array.from(set.values()).sort((a, b) => (a.fyStart < b.fyStart ? 1 : -1))
  })()

  const fyLabel = allFys.find((f) => f.fyStart === fyStart)?.label ?? currentFy.label
  const totalGross = rows.reduce((s, r) => s + r.gross_total, 0)
  const totalTds = rows.reduce((s, r) => s + r.tds_total, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="TDS & Form 16"
        subtitle="Aggregates from the TDS ledger. Approve payroll cycles to populate rows."
        actions={
          <form className="flex items-center gap-2">
            <select name="fy" defaultValue={fyStart} className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950">
              {allFys.map((f) => <option key={f.fyStart} value={f.fyStart}>FY {f.label}</option>)}
            </select>
            <button className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800">
              Show
            </button>
          </form>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Employees with TDS" value={String(rows.length)} />
        <Stat label="Total gross" value={formatInr(totalGross)} />
        <Stat tone="brand" label="Total TDS" value={formatInr(totalTds)} />
        <Card className="flex flex-col justify-between p-4">
          <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Form 16 bulk</div>
          <ButtonLink href={`/api/reports/form16/${fyStart}/bulk`} variant="outline" size="sm" className="mt-2">
            Download all (ZIP)
          </ButtonLink>
        </Card>
      </div>

      <Card className="flex flex-wrap items-center gap-2 p-3">
        <span className="text-xs font-medium text-slate-500">Form 24Q:</span>
        {(['Q1','Q2','Q3','Q4'] as const).map((q) => (
          <a
            key={q}
            href={`/api/reports/form24q/${fyStart}/${q}`}
            className="inline-flex h-8 items-center rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            {q} — FY {fyLabel}
          </a>
        ))}
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
              <tr>
                <Th>Employee</Th>
                <Th>PAN</Th>
                <Th>Regime</Th>
                <Th className="text-right">Months paid</Th>
                <Th className="text-right">Gross (FY)</Th>
                <Th className="text-right">TDS (FY)</Th>
                <Th>Form 16</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {rows.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-500">
                  No TDS rows for FY {fyLabel} yet. Approve a payroll cycle from <Link href="/payroll" className="underline">Payroll</Link>.
                </td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.employee_id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-950">
                  <Td>
                    <span className="font-medium text-slate-900 dark:text-slate-100">{r.employee_name}</span>{' '}
                    <span className="text-slate-500">({r.employee_code})</span>
                  </Td>
                  <Td className="tabular-nums">{r.pan ?? '—'}</Td>
                  <Td>{r.tax_regime}</Td>
                  <Td className="text-right tabular-nums">{r.months_paid}</Td>
                  <Td className="text-right tabular-nums">{formatInr(r.gross_total)}</Td>
                  <Td className="text-right font-semibold tabular-nums">{formatInr(r.tds_total)}</Td>
                  <Td>
                    <a href={`/api/reports/form16/${fyStart}/${r.employee_id}`} target="_blank" rel="noopener" className="text-xs font-medium text-brand-700 hover:underline">
                      Download PDF
                    </a>
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
