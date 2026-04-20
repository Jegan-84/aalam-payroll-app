import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/dal'

export type PtSlabRow = {
  id: number
  state_code: string
  effective_from: string
  effective_to: string | null
  half_year_gross_min: number
  half_year_gross_max: number | null
  half_year_pt_amount: number
}

export type PtPeriod = {
  state_code: string
  effective_from: string
  effective_to: string | null
  slabs: PtSlabRow[]
  isCurrent: boolean
}

export const getOrgPtState = cache(async (): Promise<string> => {
  await requireRole('admin', 'hr')
  const supabase = await createClient()
  const { data } = await supabase.from('organizations').select('pt_state_code').limit(1).maybeSingle()
  return (data?.pt_state_code as string | null) ?? 'TN'
})

/** List slabs grouped by (state_code, effective_from). */
export async function listPtPeriods(stateCode?: string): Promise<PtPeriod[]> {
  await requireRole('admin', 'hr')
  const supabase = await createClient()
  let query = supabase.from('pt_slabs').select('*').order('state_code').order('effective_from', { ascending: false }).order('half_year_gross_min')
  if (stateCode) query = query.eq('state_code', stateCode)
  const { data, error } = await query
  if (error) throw new Error(error.message)

  const byKey = new Map<string, PtPeriod>()
  const today = new Date().toISOString().slice(0, 10)
  for (const r of (data ?? []) as unknown as PtSlabRow[]) {
    const key = `${r.state_code}|${r.effective_from}`
    const entry = byKey.get(key) ?? {
      state_code: r.state_code,
      effective_from: r.effective_from,
      effective_to: r.effective_to,
      slabs: [],
      isCurrent: r.effective_from <= today && (r.effective_to === null || r.effective_to >= today),
    }
    entry.slabs.push(r)
    byKey.set(key, entry)
  }
  return Array.from(byKey.values())
}
