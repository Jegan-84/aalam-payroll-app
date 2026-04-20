import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/auth/dal'
import type { TaxConfig, TaxSlab, TaxSurchargeSlab } from './tax'

export type CycleRow = {
  id: string
  year: number
  month: number
  cycle_start: string
  cycle_end: string
  status: 'draft' | 'computed' | 'approved' | 'locked' | 'paid'
  include_vp: boolean
  employee_count: number
  total_gross: number
  total_deductions: number
  total_net_pay: number
  total_employer_cost: number
  opened_at: string
  computed_at: string | null
  approved_at: string | null
  locked_at: string | null
  paid_at: string | null
  notes: string | null
}

export async function listCycles(): Promise<CycleRow[]> {
  await verifySession()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('payroll_cycles')
    .select('*')
    .order('year', { ascending: false })
    .order('month', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as CycleRow[]
}

export async function listCyclesPaged(opts?: {
  page?: number
  pageSize?: number
}): Promise<{ rows: CycleRow[]; total: number; page: number; totalPages: number }> {
  await verifySession()
  const supabase = await createClient()

  const pageSize = Math.max(1, Math.min(100, opts?.pageSize ?? 24))
  const page = Math.max(1, opts?.page ?? 1)
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const { data, count, error } = await supabase
    .from('payroll_cycles')
    .select('*', { count: 'exact' })
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .range(from, to)
  if (error) throw new Error(error.message)
  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  return {
    rows: (data ?? []) as unknown as CycleRow[],
    total,
    page: Math.min(page, totalPages),
    totalPages,
  }
}

export const getCycle = cache(async (id: string): Promise<CycleRow | null> => {
  await verifySession()
  const supabase = await createClient()
  const { data } = await supabase.from('payroll_cycles').select('*').eq('id', id).maybeSingle()
  return (data as unknown as CycleRow) ?? null
})

export type CycleItemRow = {
  id: string
  cycle_id: string
  employee_id: string
  employee_code_snapshot: string
  employee_name_snapshot: string
  days_in_month: number
  paid_days: number
  lop_days: number
  leave_days: number
  proration_factor: number
  monthly_gross: number
  total_earnings: number
  total_deductions: number
  net_pay: number
  employer_retirals: number
  monthly_tds: number
  annual_tax_estimate: number
  status: 'draft' | 'approved' | 'locked'
}

export async function listCycleItems(cycleId: string): Promise<CycleItemRow[]> {
  await verifySession()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('payroll_items')
    .select('*')
    .eq('cycle_id', cycleId)
    .order('employee_name_snapshot')
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as CycleItemRow[]
}

export const getCycleItem = cache(async (cycleId: string, employeeId: string) => {
  await verifySession()
  const supabase = await createClient()
  const [{ data: item }, { data: components }] = await Promise.all([
    supabase
      .from('payroll_items')
      .select('*')
      .eq('cycle_id', cycleId)
      .eq('employee_id', employeeId)
      .maybeSingle(),
    supabase
      .from('payroll_item_components')
      .select('*, item:payroll_items!inner ( cycle_id, employee_id )')
      .eq('item.cycle_id', cycleId)
      .eq('item.employee_id', employeeId)
      .order('display_order'),
  ])
  return { item, components: components ?? [] }
})

// --- Tax master fetchers ---

export const getTaxSlabsForFy = cache(async (fyStart: string, regimeCode: 'NEW' | 'OLD') => {
  await verifySession()
  const supabase = await createClient()
  const { data: regime } = await supabase.from('tax_regimes').select('id').eq('code', regimeCode).maybeSingle()
  if (!regime) return { slabs: [] as TaxSlab[], config: null as TaxConfig | null, surchargeSlabs: [] as TaxSurchargeSlab[] }
  const [slabs, config, surcharge] = await Promise.all([
    supabase.from('tax_slabs').select('*').eq('regime_id', regime.id).eq('fy_start', fyStart),
    supabase.from('tax_config').select('*').eq('regime_id', regime.id).eq('fy_start', fyStart).maybeSingle(),
    supabase.from('tax_surcharge_slabs').select('*').eq('regime_id', regime.id).eq('fy_start', fyStart),
  ])
  return {
    slabs: (slabs.data ?? []).map((s) => ({
      taxable_income_min: Number(s.taxable_income_min),
      taxable_income_max: s.taxable_income_max == null ? null : Number(s.taxable_income_max),
      rate_percent: Number(s.rate_percent),
    })) as TaxSlab[],
    config: config.data
      ? ({
          standard_deduction: Number(config.data.standard_deduction),
          rebate_87a_income_limit: Number(config.data.rebate_87a_income_limit),
          rebate_87a_max_amount: Number(config.data.rebate_87a_max_amount),
          cess_percent: Number(config.data.cess_percent),
          surcharge_enabled: Boolean(config.data.surcharge_enabled),
        } as TaxConfig)
      : null,
    surchargeSlabs: (surcharge.data ?? []).map((s) => ({
      taxable_income_min: Number(s.taxable_income_min),
      taxable_income_max: s.taxable_income_max == null ? null : Number(s.taxable_income_max),
      surcharge_percent: Number(s.surcharge_percent),
    })) as TaxSurchargeSlab[],
  }
})
