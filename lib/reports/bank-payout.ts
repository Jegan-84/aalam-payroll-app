import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { toCsv, type Cell } from './csv'

// =============================================================================
// Bank payout files — emits the batch file Finance uploads to the corporate
// net-banking portal to execute salary payments.
//
// Supported formats:
//   generic — simple CSV (account, IFSC, name, amount, emp code, narration)
//   icici   — ICICI Corporate Internet Banking bulk payment format
//   hdfc    — HDFC NetBanking Enterprise / Corporate NEFT
//   sbi     — State Bank of India corporate bulk payment
//
// Rows are drawn from the cycle's payroll_items (status = approved / locked / paid)
// joined to employees for bank details. Employees with missing bank fields are
// returned in `exceptions` so Finance can hand-process them.
// =============================================================================

export type PayoutFormat = 'generic' | 'icici' | 'hdfc' | 'sbi'

export type PayoutException = {
  employee_code: string
  employee_name: string
  net_pay: number
  reason: string
}

export type PayoutResult = {
  text: string
  fileName: string
  mime: string
  included: number
  excluded: number
  exceptions: PayoutException[]
  totalAmount: number
}

type ItemRow = {
  employee_id: string
  employee_code_snapshot: string
  employee_name_snapshot: string
  net_pay: number
  bank_name_snapshot: string | null
  bank_account_snapshot: string | null
  bank_ifsc_snapshot: string | null
}

// -----------------------------------------------------------------------------
// Fetch + validate rows
// -----------------------------------------------------------------------------
async function fetchPayoutRows(cycleId: string) {
  const admin = createAdminClient()
  const { data: cycle } = await admin
    .from('payroll_cycles')
    .select('id, year, month, status')
    .eq('id', cycleId)
    .maybeSingle()
  if (!cycle) return { cycle: null as null, items: [] as ItemRow[], exceptions: [] as PayoutException[] }

  const { data, error } = await admin
    .from('payroll_items')
    .select(
      'employee_id, employee_code_snapshot, employee_name_snapshot, net_pay, bank_name_snapshot, bank_account_snapshot, bank_ifsc_snapshot',
    )
    .eq('cycle_id', cycleId)
    .in('status', ['approved', 'locked'])
    .order('employee_name_snapshot')
  if (error) throw new Error(error.message)

  const all = (data ?? []) as unknown as ItemRow[]
  const exceptions: PayoutException[] = []
  const included: ItemRow[] = []
  for (const r of all) {
    const net = Number(r.net_pay)
    if (!(net > 0)) {
      exceptions.push({
        employee_code: r.employee_code_snapshot,
        employee_name: r.employee_name_snapshot,
        net_pay: net,
        reason: 'Net pay is zero or negative',
      })
      continue
    }
    if (!r.bank_account_snapshot || !r.bank_ifsc_snapshot) {
      exceptions.push({
        employee_code: r.employee_code_snapshot,
        employee_name: r.employee_name_snapshot,
        net_pay: net,
        reason: 'Missing bank account number or IFSC',
      })
      continue
    }
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(r.bank_ifsc_snapshot)) {
      exceptions.push({
        employee_code: r.employee_code_snapshot,
        employee_name: r.employee_name_snapshot,
        net_pay: net,
        reason: `Invalid IFSC format: ${r.bank_ifsc_snapshot}`,
      })
      continue
    }
    included.push(r)
  }

  return { cycle, items: included, exceptions }
}

// -----------------------------------------------------------------------------
// Format builders
// -----------------------------------------------------------------------------
function fileLabel(cycle: { year: number; month: number }, format: PayoutFormat) {
  const y = cycle.year
  const m = String(cycle.month).padStart(2, '0')
  return `Payout_${format.toUpperCase()}_${y}-${m}`
}

function buildGeneric(items: ItemRow[], cycle: { year: number; month: number }) {
  const narration = `SAL ${String(cycle.month).padStart(2, '0')}/${cycle.year}`
  const rows: Cell[][] = items.map((r) => [
    r.bank_account_snapshot!,
    r.bank_ifsc_snapshot!,
    r.employee_name_snapshot,
    Math.round(Number(r.net_pay)),
    r.employee_code_snapshot,
    narration,
  ])
  return toCsv(rows, {
    headers: ['Account Number', 'IFSC', 'Beneficiary Name', 'Amount', 'Employee Code', 'Narration'],
  })
}

function buildIcici(items: ItemRow[], cycle: { year: number; month: number }) {
  // ICICI CIB bulk payment format (salary variant). Columns per ICICI template:
  //   PYMT_PROD_TYPE_CODE | PYMT_MODE | DEBIT_ACC_NO | BNF_NAME | BENE_ACC_NO |
  //   BNF_BANK_IFSC | AMOUNT | PYMT_DATE | PYMT_REF_NO | BNF_BANK_NAME |
  //   NARRATION1 | NARRATION2 | REMARKS
  // Debit account left blank for Finance to fill (set per org).
  const narration = `SAL ${String(cycle.month).padStart(2, '0')}/${cycle.year}`
  const rows: Cell[][] = items.map((r, i) => [
    'PAB_VENDOR',          // product type (salary payment)
    'IFT',                 // intra-bank = IFT; NEFT / RTGS auto-routed by bank
    '',                    // DEBIT_ACC_NO — Finance fills once per batch
    r.employee_name_snapshot,
    r.bank_account_snapshot,
    r.bank_ifsc_snapshot,
    Math.round(Number(r.net_pay)),
    '',                    // PYMT_DATE — leave blank, bank picks value-date
    `${r.employee_code_snapshot}-${cycle.year}${String(cycle.month).padStart(2, '0')}-${i + 1}`,
    r.bank_ifsc_snapshot?.slice(0, 4) ?? '',
    narration,
    r.employee_code_snapshot,
    'Salary',
  ])
  return toCsv(rows, {
    headers: [
      'PYMT_PROD_TYPE_CODE',
      'PYMT_MODE',
      'DEBIT_ACC_NO',
      'BNF_NAME',
      'BENE_ACC_NO',
      'BNF_BANK_IFSC',
      'AMOUNT',
      'PYMT_DATE',
      'PYMT_REF_NO',
      'BNF_BANK_NAME',
      'NARRATION1',
      'NARRATION2',
      'REMARKS',
    ],
  })
}

function buildHdfc(items: ItemRow[], cycle: { year: number; month: number }) {
  // HDFC NetBanking corporate NEFT bulk upload — CSV:
  //   Payment Type | Beneficiary Code | Beneficiary Account No | Beneficiary Name |
  //   IFSC Code | Amount | Payment Date | Customer Reference Number | Narration |
  //   Beneficiary Email | Debit Narration
  const narration = `SAL ${String(cycle.month).padStart(2, '0')}/${cycle.year}`
  const rows: Cell[][] = items.map((r, i) => [
    'NEFT',
    r.employee_code_snapshot,
    r.bank_account_snapshot,
    r.employee_name_snapshot,
    r.bank_ifsc_snapshot,
    Math.round(Number(r.net_pay)),
    '',                    // Payment Date — blank = value-date by bank
    `${r.employee_code_snapshot}-${cycle.year}${String(cycle.month).padStart(2, '0')}-${i + 1}`,
    narration,
    '',                    // beneficiary email — not tracked on payroll_items
    `Salary ${narration}`,
  ])
  return toCsv(rows, {
    headers: [
      'Payment Type',
      'Beneficiary Code',
      'Beneficiary Account No',
      'Beneficiary Name',
      'IFSC Code',
      'Amount',
      'Payment Date',
      'Customer Reference Number',
      'Narration',
      'Beneficiary Email',
      'Debit Narration',
    ],
  })
}

function buildSbi(items: ItemRow[], cycle: { year: number; month: number }) {
  // SBI Corporate INB bulk NEFT upload — pipe-delimited:
  //   Payment Mode|Beneficiary Account|IFSC|Name|Amount|Narration
  // (Simplified from the "salary package" format which requires pre-registered beneficiaries.)
  const narration = `SAL ${String(cycle.month).padStart(2, '0')}/${cycle.year}`
  const rows: Cell[][] = items.map((r) => [
    'NEFT',
    r.bank_account_snapshot,
    r.bank_ifsc_snapshot,
    r.employee_name_snapshot,
    Math.round(Number(r.net_pay)).toFixed(2),
    narration,
  ])
  return toCsv(rows, {
    headers: ['Payment Mode', 'Beneficiary Account', 'IFSC', 'Beneficiary Name', 'Amount', 'Narration'],
    delimiter: '|',
  })
}

const BUILDERS: Record<PayoutFormat, (items: ItemRow[], cycle: { year: number; month: number }) => string> = {
  generic: buildGeneric,
  icici: buildIcici,
  hdfc: buildHdfc,
  sbi: buildSbi,
}

// -----------------------------------------------------------------------------
// Public entry point
// -----------------------------------------------------------------------------
export async function buildBankPayoutFile(
  cycleId: string,
  format: PayoutFormat,
): Promise<PayoutResult | null> {
  const { cycle, items, exceptions } = await fetchPayoutRows(cycleId)
  if (!cycle) return null

  const builder = BUILDERS[format]
  const text = builder(items, cycle)
  const fileName = `${fileLabel(cycle, format)}.csv`
  const totalAmount = items.reduce((s, r) => s + Math.round(Number(r.net_pay)), 0)

  return {
    text,
    fileName,
    mime: 'text/csv; charset=utf-8',
    included: items.length,
    excluded: exceptions.length,
    exceptions,
    totalAmount,
  }
}

/** Build a CSV listing employees skipped from the payout batch. */
export function buildPayoutExceptionsCsv(exceptions: PayoutException[]): string {
  const rows: Cell[][] = exceptions.map((e) => [
    e.employee_code,
    e.employee_name,
    Math.round(e.net_pay),
    e.reason,
  ])
  return toCsv(rows, { headers: ['Employee Code', 'Employee Name', 'Net Pay', 'Reason Skipped'] })
}
