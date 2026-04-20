import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/auth/dal'

export type FnfStatus = 'draft' | 'computed' | 'approved' | 'paid'

export type FnfSettlementRow = {
  id: string
  employee_id: string
  last_working_day: string
  notice_period_days: number
  notice_days_served: number

  employee_code_snapshot: string
  employee_name_snapshot: string
  pan_snapshot: string | null
  date_of_joining_snapshot: string
  department_snapshot: string | null
  designation_snapshot: string | null
  tax_regime_snapshot: string

  company_id: string | null
  company_display_name_snapshot: string | null
  company_logo_snapshot: string | null

  monthly_gross_snapshot: number
  annual_gross_snapshot: number
  last_basic_snapshot: number

  service_years: number
  service_days: number
  gratuity_eligible: boolean

  final_month_earnings: number
  leave_encashment_days: number
  leave_encashment_amount: number
  gratuity_amount: number
  notice_pay_payout: number
  notice_pay_recovery: number

  total_earnings: number
  total_deductions: number
  net_payout: number
  final_tds: number
  fy_start_snapshot: string | null
  fy_gross_before_fnf: number
  fy_tds_before_fnf: number

  status: FnfStatus
  notes: string | null

  initiated_at: string
  computed_at: string | null
  approved_at: string | null
  paid_at: string | null
}

export type FnfLineRow = {
  id: string
  settlement_id: string
  code: string
  name: string
  kind: 'earning' | 'deduction'
  amount: number
  source: 'auto' | 'manual'
  display_order: number
  notes: string | null
}

function rowToSettlement(r: Record<string, unknown>): FnfSettlementRow {
  return {
    id: r.id as string,
    employee_id: r.employee_id as string,
    last_working_day: r.last_working_day as string,
    notice_period_days: Number(r.notice_period_days),
    notice_days_served: Number(r.notice_days_served),
    employee_code_snapshot: r.employee_code_snapshot as string,
    employee_name_snapshot: r.employee_name_snapshot as string,
    pan_snapshot: (r.pan_snapshot as string | null) ?? null,
    date_of_joining_snapshot: r.date_of_joining_snapshot as string,
    department_snapshot: (r.department_snapshot as string | null) ?? null,
    designation_snapshot: (r.designation_snapshot as string | null) ?? null,
    tax_regime_snapshot: (r.tax_regime_snapshot as string) ?? 'NEW',
    company_id: (r.company_id as string | null) ?? null,
    company_display_name_snapshot: (r.company_display_name_snapshot as string | null) ?? null,
    company_logo_snapshot: (r.company_logo_snapshot as string | null) ?? null,
    monthly_gross_snapshot: Number(r.monthly_gross_snapshot),
    annual_gross_snapshot: Number(r.annual_gross_snapshot),
    last_basic_snapshot: Number(r.last_basic_snapshot),
    service_years: Number(r.service_years),
    service_days: Number(r.service_days),
    gratuity_eligible: Boolean(r.gratuity_eligible),
    final_month_earnings: Number(r.final_month_earnings),
    leave_encashment_days: Number(r.leave_encashment_days),
    leave_encashment_amount: Number(r.leave_encashment_amount),
    gratuity_amount: Number(r.gratuity_amount),
    notice_pay_payout: Number(r.notice_pay_payout),
    notice_pay_recovery: Number(r.notice_pay_recovery),
    total_earnings: Number(r.total_earnings),
    total_deductions: Number(r.total_deductions),
    net_payout: Number(r.net_payout),
    final_tds: Number(r.final_tds),
    fy_start_snapshot: (r.fy_start_snapshot as string | null) ?? null,
    fy_gross_before_fnf: Number(r.fy_gross_before_fnf),
    fy_tds_before_fnf: Number(r.fy_tds_before_fnf),
    status: (r.status as FnfStatus) ?? 'draft',
    notes: (r.notes as string | null) ?? null,
    initiated_at: r.initiated_at as string,
    computed_at: (r.computed_at as string | null) ?? null,
    approved_at: (r.approved_at as string | null) ?? null,
    paid_at: (r.paid_at as string | null) ?? null,
  }
}

function rowToLine(r: Record<string, unknown>): FnfLineRow {
  return {
    id: r.id as string,
    settlement_id: r.settlement_id as string,
    code: r.code as string,
    name: r.name as string,
    kind: r.kind as 'earning' | 'deduction',
    amount: Number(r.amount),
    source: r.source as 'auto' | 'manual',
    display_order: Number(r.display_order),
    notes: (r.notes as string | null) ?? null,
  }
}

export const getFnfForEmployee = cache(
  async (employeeId: string): Promise<FnfSettlementRow | null> => {
    await verifySession()
    const supabase = await createClient()
    const { data } = await supabase
      .from('fnf_settlements')
      .select('*')
      .eq('employee_id', employeeId)
      .maybeSingle()
    return data ? rowToSettlement(data as Record<string, unknown>) : null
  },
)

export const getFnf = cache(
  async (id: string): Promise<{ settlement: FnfSettlementRow | null; lines: FnfLineRow[] }> => {
    await verifySession()
    const supabase = await createClient()
    const [{ data: s }, { data: lines }] = await Promise.all([
      supabase.from('fnf_settlements').select('*').eq('id', id).maybeSingle(),
      supabase
        .from('fnf_line_items')
        .select('*')
        .eq('settlement_id', id)
        .order('display_order'),
    ])
    return {
      settlement: s ? rowToSettlement(s as Record<string, unknown>) : null,
      lines: (lines ?? []).map((r) => rowToLine(r as Record<string, unknown>)),
    }
  },
)

export async function listFnfSettlements(opts?: { page?: number; pageSize?: number }) {
  await verifySession()
  const supabase = await createClient()

  const pageSize = Math.max(1, Math.min(100, opts?.pageSize ?? 50))
  const page = Math.max(1, opts?.page ?? 1)
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const { data, count, error } = await supabase
    .from('fnf_settlements')
    .select('*', { count: 'exact' })
    .order('initiated_at', { ascending: false })
    .range(from, to)
  if (error) throw new Error(error.message)
  const rows = (data ?? []).map((r) => rowToSettlement(r as Record<string, unknown>))
  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  return { rows, total, page: Math.min(page, totalPages), totalPages }
}
