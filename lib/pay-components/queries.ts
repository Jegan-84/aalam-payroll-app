import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/auth/dal'

export type CustomComponentRow = {
  id: number
  code: string
  name: string
  kind: 'earning' | 'deduction' | 'employer_retiral' | 'reimbursement' | 'variable'
  taxable: boolean
  include_in_gross: boolean
  calculation_type: 'fixed' | 'percent_of_basic' | 'percent_of_gross' | 'formula' | 'balancing'
  percent_value: number | null
  cap_amount: number | null
  formula: string | null
  display_order: number
  is_active: boolean
  prorate: boolean
  created_at: string
  updated_at: string
}

function rowToComponent(r: Record<string, unknown>): CustomComponentRow {
  return {
    id: Number(r.id),
    code: r.code as string,
    name: r.name as string,
    kind: r.kind as CustomComponentRow['kind'],
    taxable: Boolean(r.taxable),
    include_in_gross: Boolean(r.include_in_gross),
    calculation_type: r.calculation_type as CustomComponentRow['calculation_type'],
    percent_value: r.percent_value == null ? null : Number(r.percent_value),
    cap_amount: r.cap_amount == null ? null : Number(r.cap_amount),
    formula: (r.formula as string | null) ?? null,
    display_order: Number(r.display_order),
    is_active: Boolean(r.is_active),
    prorate: Boolean(r.prorate),
    created_at: r.created_at as string,
    updated_at: (r.updated_at as string | null) ?? (r.created_at as string),
  }
}

export async function listCustomComponents(activeOnly = false): Promise<CustomComponentRow[]> {
  await verifySession()
  const supabase = await createClient()
  let query = supabase
    .from('pay_components')
    .select('*')
    .eq('is_custom', true)
    .order('display_order')
    .order('code')
  if (activeOnly) query = query.eq('is_active', true)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => rowToComponent(r as Record<string, unknown>))
}

export async function getCustomComponent(id: number): Promise<CustomComponentRow | null> {
  await verifySession()
  const supabase = await createClient()
  const { data } = await supabase
    .from('pay_components')
    .select('*')
    .eq('id', id)
    .eq('is_custom', true)
    .maybeSingle()
  return data ? rowToComponent(data as Record<string, unknown>) : null
}
