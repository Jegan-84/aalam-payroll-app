import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/auth/dal'

export type StatutoryPeriodRow = {
  id: string
  effective_from: string
  effective_to: string | null
  isCurrent: boolean
  basic_percent_of_gross: number
  hra_percent_of_basic: number
  conv_percent_of_basic: number
  conv_monthly_cap: number
  epf_employee_percent: number
  epf_employer_percent: number
  epf_wage_ceiling: number
  epf_max_monthly_contribution: number
  esi_employee_percent: number
  esi_employer_percent: number
  esi_wage_ceiling: number
  /** Locked once the period is created. 'gross' (default) or 'basic'. */
  esi_basis: 'gross' | 'basic'
  gratuity_percent: number
  created_at: string
}

/** All periods, newest first. Marks the row whose range covers today as current. */
export async function listStatutoryPeriods(): Promise<StatutoryPeriodRow[]> {
  await verifySession()
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('statutory_config')
    .select('*')
    .order('effective_from', { ascending: false })
  if (error) throw new Error(error.message)

  return (data ?? []).map((r) => {
    const from = r.effective_from as string
    const to = (r.effective_to as string | null) ?? null
    const isCurrent = from <= today && (to === null || to >= today)
    return {
      id: r.id as string,
      effective_from: from,
      effective_to: to,
      isCurrent,
      basic_percent_of_gross: Number(r.basic_percent_of_gross),
      hra_percent_of_basic: Number(r.hra_percent_of_basic),
      conv_percent_of_basic: Number(r.conv_percent_of_basic),
      conv_monthly_cap: Number(r.conv_monthly_cap),
      epf_employee_percent: Number(r.epf_employee_percent),
      epf_employer_percent: Number(r.epf_employer_percent),
      epf_wage_ceiling: Number(r.epf_wage_ceiling),
      epf_max_monthly_contribution: Number(r.epf_max_monthly_contribution),
      esi_employee_percent: Number(r.esi_employee_percent),
      esi_employer_percent: Number(r.esi_employer_percent),
      esi_wage_ceiling: Number(r.esi_wage_ceiling),
      esi_basis: ((r.esi_basis as string | null) === 'basic' ? 'basic' : 'gross'),
      gratuity_percent: Number(r.gratuity_percent),
      created_at: r.created_at as string,
    }
  })
}
