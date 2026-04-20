import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/auth/dal'

export type TaxRegime = { id: number; code: 'NEW' | 'OLD'; name: string; description: string | null }

export const listRegimes = cache(async (): Promise<TaxRegime[]> => {
  await verifySession()
  const supabase = await createClient()
  const { data, error } = await supabase.from('tax_regimes').select('*').order('id')
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as TaxRegime[]
})

/** All distinct FY starts that have ANY tax config, slab, or surcharge row. */
export const listConfiguredFys = cache(async (): Promise<{ fyStart: string; fyEnd: string; label: string }[]> => {
  await verifySession()
  const supabase = await createClient()
  const { data } = await supabase.from('tax_slabs').select('fy_start, fy_end').order('fy_start', { ascending: false })
  const seen = new Set<string>()
  const out: { fyStart: string; fyEnd: string; label: string }[] = []
  for (const r of data ?? []) {
    if (seen.has(r.fy_start as string)) continue
    seen.add(r.fy_start as string)
    out.push({
      fyStart: r.fy_start as string,
      fyEnd: r.fy_end as string,
      label: `${(r.fy_start as string).slice(0, 4)}-${(r.fy_end as string).slice(2, 4)}`,
    })
  }
  return out
})

export type FySlab = { id: number; taxable_income_min: number; taxable_income_max: number | null; rate_percent: number }
export type FySurcharge = { id: number; taxable_income_min: number; taxable_income_max: number | null; surcharge_percent: number }
export type FyTaxConfig = {
  id: number
  standard_deduction: number
  rebate_87a_income_limit: number
  rebate_87a_max_amount: number
  cess_percent: number
  surcharge_enabled: boolean
}

export async function getFyRegimeBundle(fyStart: string, regimeCode: 'NEW' | 'OLD') {
  await verifySession()
  const supabase = await createClient()
  const { data: regime } = await supabase.from('tax_regimes').select('id, code, name').eq('code', regimeCode).maybeSingle()
  if (!regime) return null
  const [slabs, config, surcharge] = await Promise.all([
    supabase.from('tax_slabs').select('id, taxable_income_min, taxable_income_max, rate_percent').eq('regime_id', regime.id).eq('fy_start', fyStart).order('taxable_income_min'),
    supabase.from('tax_config').select('id, standard_deduction, rebate_87a_income_limit, rebate_87a_max_amount, cess_percent, surcharge_enabled').eq('regime_id', regime.id).eq('fy_start', fyStart).maybeSingle(),
    supabase.from('tax_surcharge_slabs').select('id, taxable_income_min, taxable_income_max, surcharge_percent').eq('regime_id', regime.id).eq('fy_start', fyStart).order('taxable_income_min'),
  ])
  return {
    regime,
    slabs: (slabs.data ?? []) as unknown as FySlab[],
    config: (config.data ?? null) as unknown as FyTaxConfig | null,
    surchargeSlabs: (surcharge.data ?? []) as unknown as FySurcharge[],
  }
}
