import Link from 'next/link'
import { listCycles } from '@/lib/payroll/queries'
import { buildMisReport, type MisRow } from '@/lib/reports/mis'
import { MONTH_NAMES } from '@/lib/attendance/engine'
import { formatInr } from '@/lib/format'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'

export const metadata = { title: 'Payroll MIS' }

type SP = Promise<{ cycle?: string }>

export default async function MisReportPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams
  const cycles = await listCycles()
  const eligible = cycles.filter((c) => c.status === 'approved' || c.status === 'locked' || c.status === 'paid')
  const cycleId = sp.cycle ?? eligible[0]?.id ?? ''

  const report = cycleId ? await buildMisReport(cycleId) : null

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll MIS"
        back={{ href: '/reports', label: 'Reports' }}
        subtitle="Employer cost rolled up by department, location, and company for a single cycle."
        actions={
          <form className="flex items-center gap-2">
            <select name="cycle" defaultValue={cycleId} className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950">
              {eligible.map((c) => <option key={c.id} value={c.id}>{MONTH_NAMES[c.month - 1]} {c.year}</option>)}
            </select>
            <button className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800">
              Show
            </button>
          </form>
        }
      />

      {!report || !report.cycle ? (
        <Card className="p-8 text-center text-sm text-slate-500">
          No approved cycles yet. Approve one from <Link href="/payroll" className="underline">Payroll</Link>.
        </Card>
      ) : (
        <>
          <Card className="p-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Stat label="Cycle" value={`${MONTH_NAMES[report.cycle.month - 1]} ${report.cycle.year}`} />
              <Stat label="Employees" value={String(report.totals.employees)} />
              <Stat label="Gross paid" value={formatInr(report.totals.gross)} />
              <Stat label="Net paid" value={formatInr(report.totals.net)} />
              <Stat tone="brand" label="Employer cost" value={formatInr(report.totals.employerCost)} />
            </div>
          </Card>

          <Section title="By department" rows={report.byDepartment} />
          <Section title="By location" rows={report.byLocation} />
          <Section title="By company" rows={report.byCompany} />
        </>
      )}
    </div>
  )
}

function Section({ title, rows }: { title: string; rows: MisRow[] }) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">{title}</h2>
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
              <tr>
                <Th>{title.replace('By ', '')}</Th>
                <Th className="text-right">Employees</Th>
                <Th className="text-right">Gross</Th>
                <Th className="text-right">Deductions</Th>
                <Th className="text-right">Net</Th>
                <Th className="text-right">Employer cost</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {rows.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-6 text-center text-xs text-slate-500">No data.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.dimension} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-950">
                  <Td>{r.dimension}</Td>
                  <Td className="text-right tabular-nums">{r.employeeCount}</Td>
                  <Td className="text-right tabular-nums">{formatInr(r.totalGross)}</Td>
                  <Td className="text-right tabular-nums">{formatInr(r.totalDeductions)}</Td>
                  <Td className="text-right tabular-nums">{formatInr(r.totalNet)}</Td>
                  <Td className="text-right font-semibold tabular-nums">{formatInr(r.totalEmployerCost)}</Td>
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
function Stat({ label, value, tone }: { label: string; value: string; tone?: 'brand' }) {
  return (
    <div className={`rounded-lg border p-3 ${tone === 'brand' ? 'border-brand-200 bg-brand-50 dark:border-brand-900 dark:bg-brand-950/40' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'}`}>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-50">{value}</div>
    </div>
  )
}
