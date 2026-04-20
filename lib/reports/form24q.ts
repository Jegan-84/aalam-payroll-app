import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { toCsv, type Cell } from './csv'

/**
 * Form 24Q — quarterly TDS statement on salaries.
 *
 *   Q1 = Apr–Jun   (due 31 Jul)
 *   Q2 = Jul–Sep   (due 31 Oct)
 *   Q3 = Oct–Dec   (due 31 Jan)
 *   Q4 = Jan–Mar   (due 31 May, includes Annexure II)
 *
 * We emit a simplified CSV fit for reconciliation and manual data-entry into
 * the NSDL RPU. The official filing uses the RPU to produce the encrypted
 * .fvu file; this CSV mirrors the Annexure-I columns (salary-specific rows
 * with PAN, name, date of payment, section 192 TDS, etc.).
 */
const QUARTER_MONTHS: Record<'Q1' | 'Q2' | 'Q3' | 'Q4', number[]> = {
  Q1: [4, 5, 6],
  Q2: [7, 8, 9],
  Q3: [10, 11, 12],
  Q4: [1, 2, 3],
}

function quarterDateRange(q: 'Q1' | 'Q2' | 'Q3' | 'Q4', fyStart: string): { from: string; to: string } {
  const fyStartYear = Number(fyStart.slice(0, 4))
  const months = QUARTER_MONTHS[q]
  const first = months[0]
  const last = months[months.length - 1]
  const firstYear = first >= 4 ? fyStartYear : fyStartYear + 1
  const lastYear = last >= 4 ? fyStartYear : fyStartYear + 1
  const lastDay = new Date(Date.UTC(lastYear, last, 0)).getUTCDate()
  return {
    from: `${firstYear}-${String(first).padStart(2, '0')}-01`,
    to: `${lastYear}-${String(last).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
  }
}

export async function buildForm24QCsv(
  fyStart: string,
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4',
): Promise<{ text: string; fileName: string } | null> {
  const admin = createAdminClient()
  void quarterDateRange // kept for future use when we need exact date bounds

  const { data: rows, error } = await admin
    .from('tds_ledger')
    .select(`
      employee_id, employee_code_snapshot, employee_name_snapshot, pan_snapshot, tax_regime_snapshot,
      year, month, gross_earnings, tds_deducted, basic_month, hra_month,
      cycle:payroll_cycles ( cycle_end, paid_at, approved_at, locked_at )
    `)
    .eq('fy_start', fyStart)
    .gte('month', Math.min(...QUARTER_MONTHS[quarter]))
    .lte('month', Math.max(...QUARTER_MONTHS[quarter]))
  if (error) throw new Error(error.message)
  if (!rows || rows.length === 0) return null

  // Filter by quarter months (the query's `month` range crosses Jan-Mar in Q4,
  // so we also check year via fyStart anchoring).
  const quarterMonths = new Set(QUARTER_MONTHS[quarter])
  const filtered = rows.filter((r) => quarterMonths.has(r.month as number))

  // Aggregate per (employee × month) — already primary key in tds_ledger, so one row each.
  type CycleEmbed = { cycle_end?: string; paid_at?: string | null; approved_at?: string | null; locked_at?: string | null } | null | Array<{ cycle_end?: string; paid_at?: string | null; approved_at?: string | null; locked_at?: string | null }>

  const csvRows: Cell[][] = filtered
    .sort((a, b) =>
      (a.employee_code_snapshot as string).localeCompare(b.employee_code_snapshot as string) ||
      Number(a.month) - Number(b.month),
    )
    .map((r) => {
      const cy = r.cycle as CycleEmbed
      const cyRow = Array.isArray(cy) ? cy[0] : cy
      const datePaid = cyRow?.paid_at?.slice(0, 10) || cyRow?.locked_at?.slice(0, 10) || cyRow?.approved_at?.slice(0, 10) || cyRow?.cycle_end || ''
      return [
        r.employee_code_snapshot,
        r.employee_name_snapshot,
        r.pan_snapshot ?? '',
        r.tax_regime_snapshot,
        `${r.year}-${String(r.month).padStart(2, '0')}`,
        datePaid,
        Math.round(Number(r.gross_earnings)),
        Math.round(Number(r.basic_month) + Number(r.hra_month)),       // taxable salary proxy
        Math.round(Number(r.tds_deducted)),
        '192',                                                          // section
        '194',                                                          // challan section code (placeholder)
      ]
    })

  const text = toCsv(csvRows, {
    headers: [
      'Employee Code',
      'Employee Name',
      'PAN',
      'Regime',
      'Month',
      'Date of Payment',
      'Gross Paid',
      'Taxable Salary (Basic+HRA)',
      'TDS Deducted (Sec 192)',
      'Section',
      'Challan Section Code',
    ],
  })

  const fileName = `Form24Q_${quarter}_FY${fyStart.slice(0, 4)}-${String(Number(fyStart.slice(0, 4)) + 1).slice(2)}.csv`
  return { text, fileName }
}
