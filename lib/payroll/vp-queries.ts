import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/auth/dal'

export type VpAllocationRow = {
  id: string
  cycle_id: string
  employee_id: string
  vp_pct: number
  vp_amount: number
  annual_fixed_ctc_snapshot: number
  updated_at: string
}

export async function listVpAllocations(cycleId: string): Promise<VpAllocationRow[]> {
  await verifySession()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('payroll_cycle_vp_allocations')
    .select('*')
    .eq('cycle_id', cycleId)
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => ({
    id: r.id as string,
    cycle_id: r.cycle_id as string,
    employee_id: r.employee_id as string,
    vp_pct: Number(r.vp_pct),
    vp_amount: Number(r.vp_amount),
    annual_fixed_ctc_snapshot: Number(r.annual_fixed_ctc_snapshot),
    updated_at: r.updated_at as string,
  }))
}

export const getEmployeeActiveCtc = cache(
  async (employeeId: string): Promise<{ annualFixedCtc: number; variablePayPercent: number } | null> => {
    await verifySession()
    const supabase = await createClient()
    const { data } = await supabase
      .from('salary_structures')
      .select('annual_fixed_ctc, variable_pay_percent')
      .eq('employee_id', employeeId)
      .is('effective_to', null)
      .eq('status', 'active')
      .maybeSingle()
    if (!data) return null
    return {
      annualFixedCtc: Number(data.annual_fixed_ctc),
      variablePayPercent: Number(data.variable_pay_percent),
    }
  },
)

export const getVpAllocation = cache(
  async (cycleId: string, employeeId: string): Promise<VpAllocationRow | null> => {
    await verifySession()
    const supabase = await createClient()
    const { data } = await supabase
      .from('payroll_cycle_vp_allocations')
      .select('*')
      .eq('cycle_id', cycleId)
      .eq('employee_id', employeeId)
      .maybeSingle()
    if (!data) return null
    return {
      id: data.id as string,
      cycle_id: data.cycle_id as string,
      employee_id: data.employee_id as string,
      vp_pct: Number(data.vp_pct),
      vp_amount: Number(data.vp_amount),
      annual_fixed_ctc_snapshot: Number(data.annual_fixed_ctc_snapshot),
      updated_at: data.updated_at as string,
    }
  },
)
