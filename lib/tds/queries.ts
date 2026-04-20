import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/auth/dal'
import { resolveFy } from '@/lib/leave/engine'

export type TdsLedgerRow = {
  id: string
  employee_id: string
  cycle_id: string
  fy_start: string
  fy_end: string
  year: number
  month: number
  employee_code_snapshot: string
  employee_name_snapshot: string
  pan_snapshot: string | null
  tax_regime_snapshot: string
  gross_earnings: number
  basic_month: number
  hra_month: number
  conveyance_month: number
  other_allowance_month: number
  professional_tax_month: number
  pf_employee_month: number
  tds_deducted: number
  annual_tax_estimate: number
}

export const listAvailableFys = cache(async (): Promise<{ fyStart: string; fyEnd: string; label: string }[]> => {
  await verifySession()
  const supabase = await createClient()
  const { data } = await supabase.from('tds_ledger').select('fy_start, fy_end').order('fy_start', { ascending: false })
  const seen = new Set<string>()
  const out: { fyStart: string; fyEnd: string; label: string }[] = []
  for (const r of data ?? []) {
    const key = r.fy_start as string
    if (seen.has(key)) continue
    seen.add(key)
    const start = (r.fy_start as string).slice(0, 4)
    const end = (r.fy_end as string).slice(2, 4)
    out.push({ fyStart: r.fy_start as string, fyEnd: r.fy_end as string, label: `${start}-${end}` })
  }
  return out
})

export const getCurrentFy = cache(async () => {
  await verifySession()
  const supabase = await createClient()
  const { data } = await supabase.from('organizations').select('financial_year_start_month').limit(1).maybeSingle()
  const m = (data?.financial_year_start_month as number | undefined) ?? 4
  return resolveFy(new Date(), m)
})

export type FySummaryRow = {
  employee_id: string
  employee_code: string
  employee_name: string
  pan: string | null
  tax_regime: string
  months_paid: number
  gross_total: number
  tds_total: number
}

export async function summarizeFyForAll(fyStart: string): Promise<FySummaryRow[]> {
  await verifySession()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tds_ledger')
    .select('employee_id, employee_code_snapshot, employee_name_snapshot, pan_snapshot, tax_regime_snapshot, gross_earnings, tds_deducted')
    .eq('fy_start', fyStart)
  if (error) throw new Error(error.message)

  const byEmp = new Map<string, FySummaryRow>()
  for (const r of data ?? []) {
    const id = r.employee_id as string
    const cur = byEmp.get(id) ?? {
      employee_id: id,
      employee_code: r.employee_code_snapshot as string,
      employee_name: r.employee_name_snapshot as string,
      pan: (r.pan_snapshot as string | null) ?? null,
      tax_regime: (r.tax_regime_snapshot as string) ?? 'NEW',
      months_paid: 0,
      gross_total: 0,
      tds_total: 0,
    }
    cur.months_paid += 1
    cur.gross_total += Number(r.gross_earnings)
    cur.tds_total += Number(r.tds_deducted)
    byEmp.set(id, cur)
  }
  return Array.from(byEmp.values()).sort((a, b) => a.employee_name.localeCompare(b.employee_name))
}

export async function getEmployeeFyLedger(employeeId: string, fyStart: string): Promise<TdsLedgerRow[]> {
  await verifySession()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tds_ledger')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('fy_start', fyStart)
    .order('month')
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as TdsLedgerRow[]
}
