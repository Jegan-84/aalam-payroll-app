import { getCurrentEmployee } from '@/lib/auth/dal'
import { listEmployeePayslips } from '@/lib/payroll/ess-queries'
import { getFyContext } from '@/lib/leave/queries'
import { MONTH_NAMES } from '@/lib/attendance/engine'
import { formatInr } from '@/lib/format'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const metadata = { title: 'My Payslips' }

export default async function MyPayslipsPage() {
  const { employeeId } = await getCurrentEmployee()
  const fy = await getFyContext()
  const all = await listEmployeePayslips(employeeId)

  // Group by FY: current FY on top, older FYs collapsed below.
  const fyStartMonth = 4
  const grouped = new Map<string, typeof all>()
  for (const p of all) {
    const fyYear = p.month >= fyStartMonth ? p.year : p.year - 1
    const label = `${fyYear}-${String(fyYear + 1).slice(2)}`
    const arr = grouped.get(label) ?? []
    arr.push(p)
    grouped.set(label, arr)
  }
  const fyLabels = Array.from(grouped.keys()).sort((a, b) => (a < b ? 1 : -1))

  const ytdNet = (grouped.get(fy.label) ?? []).reduce((s, p) => s + p.net_pay, 0)
  const ytdTds = (grouped.get(fy.label) ?? []).reduce((s, p) => s + p.monthly_tds, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payslips"
        subtitle={`${all.length} payslip${all.length === 1 ? '' : 's'} on record · FY ${fy.label} net ${formatInr(ytdNet)} · TDS ${formatInr(ytdTds)}`}
      />

      {fyLabels.length === 0 && (
        <Card className="p-8 text-center text-sm text-slate-500">
          No payslips yet. They appear here once your payroll cycle is approved.
        </Card>
      )}

      {fyLabels.map((label) => {
        const rows = grouped.get(label) ?? []
        return (
          <div key={label} className="space-y-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">FY {label}</h2>
              <Badge tone={label === fy.label ? 'brand' : 'neutral'}>
                {label === fy.label ? 'Current' : `${rows.length} payslip${rows.length === 1 ? '' : 's'}`}
              </Badge>
              <span className="ml-auto text-xs text-slate-500">
                Net {formatInr(rows.reduce((s, r) => s + r.net_pay, 0))} · TDS {formatInr(rows.reduce((s, r) => s + r.monthly_tds, 0))}
              </span>
            </div>
            <Card className="overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                  <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
                    <tr>
                      <Th>Month</Th>
                      <Th className="text-right">Paid days</Th>
                      <Th className="text-right">Gross</Th>
                      <Th className="text-right">Deductions</Th>
                      <Th className="text-right">TDS</Th>
                      <Th className="text-right">Net</Th>
                      <Th>Status</Th>
                      <Th>{' '}</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
                    {rows.map((p) => (
                      <tr key={p.cycle_id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-950">
                        <Td>{MONTH_NAMES[p.month - 1]} {p.year}</Td>
                        <Td className="text-right tabular-nums">{Number(p.paid_days).toFixed(1)}</Td>
                        <Td className="text-right tabular-nums">{formatInr(p.monthly_gross)}</Td>
                        <Td className="text-right tabular-nums">{formatInr(p.total_deductions)}</Td>
                        <Td className="text-right tabular-nums">{formatInr(p.monthly_tds)}</Td>
                        <Td className="text-right font-semibold tabular-nums">{formatInr(p.net_pay)}</Td>
                        <Td><Badge tone={p.item_status === 'locked' ? 'success' : 'warn'}>{p.item_status}</Badge></Td>
                        <Td>
                          <a
                            href={`/api/payslip/${p.cycle_id}/${employeeId}`}
                            target="_blank"
                            rel="noopener"
                            className="text-xs font-medium text-brand-700 hover:underline"
                          >
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
      })}
    </div>
  )
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 ${className}`}>{children}</th>
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-slate-900 dark:text-slate-100 ${className}`}>{children}</td>
}
