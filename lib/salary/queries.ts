import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/auth/dal'
import type { PtSlab, StatutoryConfig } from '@/lib/payroll/types'

export const getStatutoryConfig = cache(async (): Promise<StatutoryConfig> => {
  await verifySession()
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('statutory_config')
    .select('*')
    .lte('effective_from', today)
    .or(`effective_to.is.null,effective_to.gte.${today}`)
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No active statutory_config row found.')
  return data as unknown as StatutoryConfig
})

export const getPtSlabs = cache(async (stateCode: string): Promise<PtSlab[]> => {
  await verifySession()
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('pt_slabs')
    .select('*')
    .eq('state_code', stateCode)
    .lte('effective_from', today)
    .or(`effective_to.is.null,effective_to.gte.${today}`)
    .order('half_year_gross_min', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as PtSlab[]
})

export const getOrgPtState = cache(async (): Promise<string> => {
  await verifySession()
  const supabase = await createClient()
  const { data } = await supabase.from('organizations').select('pt_state_code').limit(1).maybeSingle()
  return data?.pt_state_code ?? 'TN'
})

export type SalaryRow = {
  id: string
  employee_id: string
  effective_from: string
  effective_to: string | null
  status: string
  annual_fixed_ctc: number
  annual_gross: number
  annual_variable_pay: number
  annual_total_ctc: number
  monthly_gross: number
  monthly_take_home: number
  epf_mode: string
  notes: string | null
  created_at: string
}

export async function listActiveSalaries(
  q?: string,
  opts?: { page?: number; pageSize?: number },
) {
  await verifySession()
  const supabase = await createClient()

  const pageSize = Math.max(1, Math.min(100, opts?.pageSize ?? 50))
  const page = Math.max(1, opts?.page ?? 1)
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('salary_structures')
    .select(
      `
      id, employee_id, effective_from, effective_to, status,
      annual_fixed_ctc, annual_gross, annual_variable_pay, annual_total_ctc,
      monthly_gross, monthly_take_home, epf_mode, notes, created_at,
      employee:employees!inner ( id, employee_code, full_name_snapshot, work_email, employment_status )
    `,
      { count: 'exact' },
    )
    .is('effective_to', null)
    .eq('status', 'active')
    .order('effective_from', { ascending: false })
    .range(from, to)

  if (q && q.trim()) {
    query = query.or(
      `employee_code.ilike.%${q}%,full_name_snapshot.ilike.%${q}%,work_email.ilike.%${q}%`,
      { foreignTable: 'employees' },
    )
  }

  const { data, count, error } = await query
  if (error) throw new Error(error.message)
  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  return { rows: data ?? [], total, page: Math.min(page, totalPages), totalPages }
}

export const getEmployeeSalaryHistory = cache(async (employeeId: string) => {
  await verifySession()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('salary_structures')
    .select('*')
    .eq('employee_id', employeeId)
    .order('effective_from', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as SalaryRow[]
})

export const getStructureWithComponents = cache(async (structureId: string) => {
  await verifySession()
  const supabase = await createClient()
  const [{ data: structure }, { data: components }] = await Promise.all([
    supabase.from('salary_structures').select('*').eq('id', structureId).maybeSingle(),
    supabase
      .from('salary_structure_components')
      .select('*')
      .eq('structure_id', structureId)
      .order('display_order'),
  ])
  return { structure, components: components ?? [] }
})
