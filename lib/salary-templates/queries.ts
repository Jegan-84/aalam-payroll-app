import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/auth/dal'

export type SalaryTemplateRow = {
  id: string
  code: string
  name: string
  description: string | null
  employment_type: string | null
  designation_id: number | null
  annual_fixed_ctc: number
  variable_pay_percent: number
  medical_insurance_monthly: number
  internet_annual: number
  training_annual: number
  epf_mode: 'ceiling' | 'fixed_max' | 'actual'
  notes: string | null
  is_active: boolean
  display_order: number
}

export async function listTemplates(opts: { activeOnly?: boolean } = {}): Promise<SalaryTemplateRow[]> {
  await verifySession()
  const supabase = await createClient()
  let query = supabase
    .from('salary_templates')
    .select('*')
    .order('display_order')
    .order('name')
  if (opts.activeOnly) query = query.eq('is_active', true)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as SalaryTemplateRow[]
}

export const getTemplate = cache(async (id: string): Promise<SalaryTemplateRow | null> => {
  await verifySession()
  const supabase = await createClient()
  const { data } = await supabase.from('salary_templates').select('*').eq('id', id).maybeSingle()
  return (data as unknown as SalaryTemplateRow) ?? null
})
