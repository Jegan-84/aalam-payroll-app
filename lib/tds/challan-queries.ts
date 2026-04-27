import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/auth/dal'

export type TdsChallanRow = {
  id: string
  year: number
  month: number
  fy_start: string
  quarter: number
  bsr_code: string
  challan_serial_no: string
  deposit_date: string
  tds_amount: number
  surcharge: number
  cess: number
  interest: number
  penalty: number
  total_amount: number
  section: string
  notes: string | null
  created_at: string
}

function rowToChallan(r: Record<string, unknown>): TdsChallanRow {
  return {
    id: r.id as string,
    year: Number(r.year),
    month: Number(r.month),
    fy_start: r.fy_start as string,
    quarter: Number(r.quarter),
    bsr_code: r.bsr_code as string,
    challan_serial_no: r.challan_serial_no as string,
    deposit_date: r.deposit_date as string,
    tds_amount: Number(r.tds_amount),
    surcharge: Number(r.surcharge),
    cess: Number(r.cess),
    interest: Number(r.interest),
    penalty: Number(r.penalty),
    total_amount: Number(r.total_amount),
    section: (r.section as string) ?? '192',
    notes: (r.notes as string | null) ?? null,
    created_at: r.created_at as string,
  }
}

export async function listTdsChallans(opts?: {
  fyStart?: string
  quarter?: number
  page?: number
  pageSize?: number
}): Promise<{ rows: TdsChallanRow[]; total: number; page: number; totalPages: number }> {
  await verifySession()
  const supabase = await createClient()

  const pageSize = Math.max(1, Math.min(100, opts?.pageSize ?? 50))
  const page = Math.max(1, opts?.page ?? 1)
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('tds_challans')
    .select('*', { count: 'exact' })
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .range(from, to)

  if (opts?.fyStart) query = query.eq('fy_start', opts.fyStart)
  if (opts?.quarter) query = query.eq('quarter', opts.quarter)

  const { data, count, error } = await query
  if (error) throw new Error(error.message)
  const rows = (data ?? []).map((r) => rowToChallan(r as Record<string, unknown>))
  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  return { rows, total, page: Math.min(page, totalPages), totalPages }
}

export async function getTdsChallan(id: string): Promise<TdsChallanRow | null> {
  await verifySession()
  const supabase = await createClient()
  const { data } = await supabase.from('tds_challans').select('*').eq('id', id).maybeSingle()
  return data ? rowToChallan(data as Record<string, unknown>) : null
}

// -----------------------------------------------------------------------------
// 24Q payload — deductee rows (one per employee × month in the quarter)
// -----------------------------------------------------------------------------
export type DeducteeMonthRow = {
  employee_id: string
  employee_code: string
  employee_name: string
  pan: string | null
  tax_regime: string
  year: number
  month: number
  gross_earnings: number
  tds_deducted: number
  annual_gross_estimate: number
  annual_tax_estimate: number
}

const FY_MONTH_SEQUENCE = [
  [4, 5, 6],    // Q1
  [7, 8, 9],    // Q2
  [10, 11, 12], // Q3
  [1, 2, 3],    // Q4
]

export async function getQuarterDeducteeRows(
  fyStart: string,
  quarter: number,
): Promise<DeducteeMonthRow[]> {
  await verifySession()
  const supabase = await createClient()

  const fyStartYear = Number(fyStart.slice(0, 4))
  const months = FY_MONTH_SEQUENCE[quarter - 1]
  if (!months) return []

  // Q4 months (Jan-Mar) fall in fyStartYear + 1
  const monthYearPairs = months.map((m) => ({
    month: m,
    year: m >= 4 ? fyStartYear : fyStartYear + 1,
  }))

  const { data, error } = await supabase
    .from('tds_ledger')
    .select(
      `
      employee_id, employee_code_snapshot, employee_name_snapshot, pan_snapshot,
      tax_regime_snapshot, year, month,
      gross_earnings, tds_deducted, annual_gross_estimate, annual_tax_estimate
    `,
    )
    .eq('fy_start', fyStart)
    .in('month', months)
    .gt('tds_deducted', 0)
    .order('employee_name_snapshot')
    .order('month')
  if (error) throw new Error(error.message)

  return (data ?? [])
    .filter((r) => {
      // Match (year, month) against the FY-quarter mapping
      const ym = monthYearPairs.find((p) => p.month === Number(r.month))
      return ym && Number(r.year) === ym.year
    })
    .map((r) => ({
      employee_id: r.employee_id as string,
      employee_code: r.employee_code_snapshot as string,
      employee_name: r.employee_name_snapshot as string,
      pan: (r.pan_snapshot as string | null) ?? null,
      tax_regime: (r.tax_regime_snapshot as string) ?? 'NEW',
      year: Number(r.year),
      month: Number(r.month),
      gross_earnings: Number(r.gross_earnings),
      tds_deducted: Number(r.tds_deducted),
      annual_gross_estimate: Number(r.annual_gross_estimate),
      annual_tax_estimate: Number(r.annual_tax_estimate),
    }))
}

export function computeQuarterFromMonth(month: number): number {
  if (month >= 4 && month <= 6) return 1
  if (month >= 7 && month <= 9) return 2
  if (month >= 10 && month <= 12) return 3
  return 4 // Jan, Feb, Mar
}
