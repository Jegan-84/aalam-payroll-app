import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { toCsv, type Cell } from './csv'
import { MONTH_NAMES } from '@/lib/attendance/engine'

/**
 * Payroll journal — a ledger-ready CSV Finance can import into Tally / SAP / Zoho Books.
 * Rows are aggregated by component code across the whole cycle (one row per
 * code, with total amount). Each row maps to a GL account — the mapping column
 * is filled by Finance after export; we emit conservative defaults.
 */

type CompRow = { code: string; name: string; kind: string; amount: number }

const GL_DEFAULTS: Record<string, string> = {
  BASIC:      '5100 · Salary — Basic',
  HRA:        '5101 · Salary — HRA',
  CONV:       '5102 · Salary — Conveyance',
  OTHERALLOW: '5103 · Salary — Other Allowance',
  INTERNET:   '5104 · Internet Reimbursement',
  INCENTIVE:  '5105 · Incentive',
  SHIFT:      '5106 · Shift Allowance',
  VP:         '5107 · Variable Pay',

  PF_EE:      '2300 · PF Payable (Employee)',
  ESI_EE:     '2301 · ESI Payable (Employee)',
  PT:         '2302 · PT Payable',
  TDS:        '2303 · TDS Payable',
  LUNCH:      '5108 · Lunch Recovery',

  PF_ER:      '5200 · Employer PF',
  ESI_ER:     '5201 · Employer ESI',
  GRATUITY:   '5202 · Gratuity Provision',
  MEDINS:     '5203 · Medical Insurance',
  TRAINING:   '5204 · Training Reimbursement',
}

export async function buildPayrollJournalCsv(
  cycleId: string,
): Promise<{ text: string; fileName: string } | null> {
  const admin = createAdminClient()
  const { data: cycle } = await admin
    .from('payroll_cycles')
    .select('year, month')
    .eq('id', cycleId)
    .maybeSingle()
  if (!cycle) return null

  const { data: comps } = await admin
    .from('payroll_item_components')
    .select('code, name, kind, amount, item:payroll_items!inner ( cycle_id )')
    .eq('item.cycle_id', cycleId)
  if (!comps || comps.length === 0) return null

  // Aggregate by (code, kind, name) — one row per component code.
  type Agg = { code: string; name: string; kind: string; amount: number; count: number }
  const byCode = new Map<string, Agg>()
  for (const c of comps as unknown as CompRow[]) {
    const key = c.code
    const cur = byCode.get(key) ?? { code: c.code, name: c.name, kind: c.kind, amount: 0, count: 0 }
    cur.amount += Number(c.amount)
    cur.count += 1
    byCode.set(key, cur)
  }

  const out = Array.from(byCode.values()).sort((a, b) =>
    a.kind.localeCompare(b.kind) || a.code.localeCompare(b.code),
  )

  const period = `${MONTH_NAMES[(cycle.month as number) - 1]} ${cycle.year}`
  const rows: Cell[][] = out.map((r) => [
    period,
    r.code,
    r.name,
    r.kind,
    r.count,
    Math.round(r.amount),
    r.kind === 'earning' || r.kind === 'employer_retiral' || r.kind === 'reimbursement' ? 'debit' : 'credit',
    GL_DEFAULTS[r.code.replace(/_[A-F0-9]+$/i, '').toUpperCase()] ?? '',
  ])

  const text = toCsv(rows, {
    headers: [
      'Period',
      'Component code',
      'Component name',
      'Kind',
      'Employees',
      'Amount ₹',
      'Debit/Credit',
      'GL account (suggested)',
    ],
  })

  const fileName = `Journal_${cycle.year}-${String(cycle.month).padStart(2, '0')}.csv`
  return { text, fileName }
}
