import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/auth/dal'

export type EmployeeComponentRow = {
  id: string
  employee_id: string
  code: string
  name: string
  kind: 'earning' | 'deduction'
  monthly_amount: number
  prorate: boolean
  include_in_gross: boolean
  effective_from: string
  effective_to: string | null
  is_active: boolean
  notes: string | null
}

export async function listEmployeeComponents(employeeId: string): Promise<EmployeeComponentRow[]> {
  await verifySession()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('employee_pay_components')
    .select('*')
    .eq('employee_id', employeeId)
    .order('effective_from', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as EmployeeComponentRow[]
}

export const getEmployeeComponent = cache(async (id: string): Promise<EmployeeComponentRow | null> => {
  await verifySession()
  const supabase = await createClient()
  const { data } = await supabase.from('employee_pay_components').select('*').eq('id', id).maybeSingle()
  return (data as unknown as EmployeeComponentRow) ?? null
})

export type AdjustmentRow = {
  id: string
  cycle_id: string
  employee_id: string
  code: string
  name: string
  kind: 'earning' | 'deduction'
  amount: number
  action: 'add' | 'override' | 'skip'
  notes: string | null
}

export async function listAdjustments(cycleId: string, employeeId: string): Promise<AdjustmentRow[]> {
  await verifySession()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('payroll_item_adjustments')
    .select('*')
    .eq('cycle_id', cycleId)
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as AdjustmentRow[]
}
