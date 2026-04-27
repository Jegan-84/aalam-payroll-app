import Link from 'next/link'
import { getCurrentFy, listAvailableFys } from '@/lib/tds/queries'
import { getQuarterDeducteeRows, listTdsChallans } from '@/lib/tds/challan-queries'
import { formatInr } from '@/lib/format'
import { MONTH_NAMES } from '@/lib/attendance/engine'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Stat } from '@/components/ui/stat'
import { Badge } from '@/components/ui/badge'
import { ButtonLink } from '@/components/ui/button'

export const metadata = { title: 'Form 24Q' }

type SP = Promise<{ fy?: string; quarter?: string }>

const QUARTER_CODE: Record<number, 'Q1' | 'Q2' | 'Q3' | 'Q4'> = { 1: 'Q1', 2: 'Q2', 3: 'Q3', 4: 'Q4' }
const QUARTER_MONTHS_LABEL: Record<number, string> = {
  1: 'Apr – Jun',
  2: 'Jul – Sep',
  3: 'Oct – Dec',
  4: 'Jan – Mar',
}
const QUARTER_DUE_DATE: Record<number, string> = {
  1: '31 July',
  2: '31 October',
  3: '31 January',
  4: '31 May',
}

export default async function Form24QPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams
  const currentFy = await getCurrentFy()
  const fyStart = sp.fy && /^\d{4}-\d{2}-\d{2}$/.test(sp.fy) ? sp.fy : currentFy.fyStart
  const quarter = sp.quarter && /^[1-4]$/.test(sp.quarter) ? Number(sp.quarter) : 1

  const [availableFys, deductees, challansPaged] = await Promise.all([
    listAvailableFys(),
    getQuarterDeducteeRows(fyStart, quarter),
    listTdsChallans({ fyStart, quarter, pageSize: 100 }),
  ])

  const allFys = (() => {
    const set = new Map<string, { fyStart: string; label: string }>()
    set.set(currentFy.fyStart, { fyStart: currentFy.fyStart, label: currentFy.label })
    for (const f of availableFys) set.set(f.fyStart, { fyStart: f.fyStart, label: f.label })
    return Array.from(set.values()).sort((a, b) => (a.fyStart < b.fyStart ? 1 : -1))
  })()
  const fyLabel = allFys.find((f) => f.fyStart === fyStart)?.label ?? currentFy.label

  const tdsDeducted = deductees.reduce((s, r) => s + r.tds_deducted, 0)
  const challans = challansPaged.rows
  const tdsPaid = challans.reduce((s, c) => s + c.tds_amount, 0)
  const diff = tdsDeducted - tdsPaid
  const reconciled = Math.abs(diff) < 1

  return (
    <div className="space-y-6">
      <PageHeader
        title="Form 24Q"
        back={{ href: '/tds', label: 'TDS & Form 16' }}
        subtitle={`Quarterly TDS return on salaries (Section 192). ${QUARTER_MONTHS_LABEL[quarter]} · Due ${QUARTER_DUE_DATE[quarter]}.`}
        actions={
          <>
            <form className="flex items-center gap-2">
              <select name="fy" defaultValue={fyStart} className={selectCls}>
                {allFys.map((f) => <option key={f.fyStart} value={f.fyStart}>FY {f.label}</option>)}
              </select>
              <select name="quarter" defaultValue={String(quarter)} className={selectCls}>
                <option value="1">Q1 · Apr–Jun</option>
                <option value="2">Q2 · Jul–Sep</option>
                <option value="3">Q3 · Oct–Dec</option>
                <option value="4">Q4 · Jan–Mar</option>
              </select>
              <button className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800">
                Show
              </button>
            </form>
            <ButtonLink href={`/api/reports/form24q/${fyStart}/${QUARTER_CODE[quarter]}`} variant="outline">
              Download CSV
            </ButtonLink>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Deductee rows" value={String(deductees.length)} />
        <Stat label="TDS deducted" value={formatInr(tdsDeducted)} />
        <Stat label="Challans filed" value={`${challans.length} · ${formatInr(tdsPaid)}`} />
        <Stat
          tone={reconciled ? 'brand' : undefined}
          label={reconciled ? 'Reconciled' : diff > 0 ? 'Unpaid TDS' : 'Excess paid'}
          value={reconciled ? '✓' : formatInr(Math.abs(diff))}
        />
      </div>

      <Card className="p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">Challans for {QUARTER_MONTHS_LABEL[quarter]} FY {fyLabel}</div>
            <p className="text-xs text-slate-500">Record each TDS deposit after ITNS-281 payment — BSR code + challan serial are needed on every Form 16 Part A.</p>
          </div>
          <ButtonLink href={`/tds/challans/new?year=${Number(fyStart.slice(0,4))}&month=${quarter === 4 ? 1 : quarter * 3 + 1}`} variant="primary" size="sm">
            + Record challan
          </ButtonLink>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
              <tr>
                <Th>Month</Th>
                <Th>BSR code</Th>
                <Th>Challan serial</Th>
                <Th>Deposited</Th>
                <Th className="text-right">TDS ₹</Th>
                <Th className="text-right">Total ₹</Th>
                <Th>{' '}</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {challans.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-sm text-slate-500">
                    No challans recorded. After depositing TDS for this quarter, click &quot;Record challan&quot; above.
                  </td>
                </tr>
              )}
              {challans.map((c) => (
                <tr key={c.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-950">
                  <Td>{MONTH_NAMES[c.month - 1]} {c.year}</Td>
                  <Td className="font-mono tabular-nums">{c.bsr_code}</Td>
                  <Td className="font-mono tabular-nums">{c.challan_serial_no}</Td>
                  <Td className="tabular-nums">{c.deposit_date}</Td>
                  <Td className="text-right tabular-nums">{formatInr(c.tds_amount)}</Td>
                  <Td className="text-right font-semibold tabular-nums">{formatInr(c.total_amount)}</Td>
                  <Td><Link href={`/tds/challans/${c.id}`} className="text-xs font-medium text-brand-700 hover:underline">Edit →</Link></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">Deductee rows (Annexure I)</div>
          <span className="text-xs text-slate-500">One row per employee per month with TDS &gt; 0</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
              <tr>
                <Th>Month</Th>
                <Th>Employee</Th>
                <Th>PAN</Th>
                <Th>Regime</Th>
                <Th className="text-right">Gross</Th>
                <Th className="text-right">TDS</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {deductees.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-slate-500">
                    No TDS rows for this quarter yet. Approve a payroll cycle in <Link href="/payroll" className="underline">Payroll</Link>.
                  </td>
                </tr>
              )}
              {deductees.map((r, i) => (
                <tr key={`${r.employee_id}-${r.year}-${r.month}-${i}`} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-950">
                  <Td>{MONTH_NAMES[r.month - 1]} {r.year}</Td>
                  <Td>
                    <span className="font-medium text-slate-900 dark:text-slate-100">{r.employee_name}</span>{' '}
                    <span className="text-slate-500">({r.employee_code})</span>
                  </Td>
                  <Td className="tabular-nums font-mono">{r.pan ?? <Badge tone="warn">Missing</Badge>}</Td>
                  <Td>{r.tax_regime}</Td>
                  <Td className="text-right tabular-nums">{formatInr(r.gross_earnings)}</Td>
                  <Td className="text-right font-semibold tabular-nums">{formatInr(r.tds_deducted)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-xs text-slate-500">
        The CSV export above is a simplified Annexure-I format you can feed into the NSDL Return Preparation Utility (RPU)
        to produce the encrypted <code>.fvu</code> file required by the TIN-FC for actual filing. PAN must be populated on every row.
      </p>
    </div>
  )
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 ${className}`}>{children}</th>
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-slate-900 dark:text-slate-100 ${className}`}>{children}</td>
}

const selectCls = 'h-9 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950'
