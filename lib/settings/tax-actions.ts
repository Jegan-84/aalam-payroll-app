'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifySession } from '@/lib/auth/dal'

/**
 * Start a new FY by cloning all tax rows from a source FY. Will NOT overwrite
 * existing data for the new FY (safe to re-run; use the individual edit
 * actions to change rates).
 */
export async function cloneFyAction(formData: FormData): Promise<void> {
  const session = await verifySession()
  const sourceFyStart = String(formData.get('source_fy_start') ?? '')
  const newFyStart = String(formData.get('new_fy_start') ?? '')
  const newFyEnd = String(formData.get('new_fy_end') ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sourceFyStart)) throw new Error('Invalid source FY')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(newFyStart) || !/^\d{4}-\d{2}-\d{2}$/.test(newFyEnd)) throw new Error('Invalid new FY')

  const admin = createAdminClient()

  // Check if target FY already has data
  const { data: existing } = await admin.from('tax_slabs').select('id').eq('fy_start', newFyStart).limit(1)
  if (existing && existing.length > 0) throw new Error('The target FY already has tax data. Edit it directly.')

  // Fetch source rows for both regimes
  const { data: sourceSlabs } = await admin.from('tax_slabs').select('regime_id, taxable_income_min, taxable_income_max, rate_percent').eq('fy_start', sourceFyStart)
  const { data: sourceConfig } = await admin.from('tax_config').select('regime_id, standard_deduction, rebate_87a_income_limit, rebate_87a_max_amount, cess_percent, surcharge_enabled').eq('fy_start', sourceFyStart)
  const { data: sourceSurcharge } = await admin.from('tax_surcharge_slabs').select('regime_id, taxable_income_min, taxable_income_max, surcharge_percent').eq('fy_start', sourceFyStart)

  if (!sourceSlabs || sourceSlabs.length === 0) throw new Error('Source FY has no data to clone.')

  await admin.from('tax_slabs').insert(sourceSlabs.map((s) => ({ ...s, fy_start: newFyStart, fy_end: newFyEnd })))
  if (sourceConfig && sourceConfig.length > 0) {
    await admin.from('tax_config').insert(sourceConfig.map((c) => ({ ...c, fy_start: newFyStart, fy_end: newFyEnd })))
  }
  if (sourceSurcharge && sourceSurcharge.length > 0) {
    await admin.from('tax_surcharge_slabs').insert(sourceSurcharge.map((s) => ({ ...s, fy_start: newFyStart, fy_end: newFyEnd })))
  }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'tax.clone_fy',
    summary: `Cloned tax config from FY ${sourceFyStart} to FY ${newFyStart}`,
  })

  revalidatePath('/settings/tax')
  redirect(`/settings/tax/${newFyStart}`)
}

type SlabPayload = { id?: number; min: number; max: number | null; rate: number }

export async function saveSlabsAction(formData: FormData): Promise<{ ok?: true; error?: string }> {
  const session = await verifySession()
  const fyStart = String(formData.get('fy_start') ?? '')
  const fyEnd = String(formData.get('fy_end') ?? '')
  const regimeCode = String(formData.get('regime') ?? '') as 'NEW' | 'OLD'
  const slabsJson = String(formData.get('slabs') ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fyStart)) return { error: 'Invalid fy_start' }
  if (!['NEW', 'OLD'].includes(regimeCode)) return { error: 'Invalid regime' }

  let parsed: SlabPayload[]
  try {
    parsed = JSON.parse(slabsJson)
  } catch {
    return { error: 'Malformed slabs payload' }
  }

  const admin = createAdminClient()
  const { data: regime } = await admin.from('tax_regimes').select('id').eq('code', regimeCode).maybeSingle()
  if (!regime) return { error: 'Regime not found' }

  // Replace approach: delete existing rows for (regime, FY) and insert fresh.
  await admin.from('tax_slabs').delete().eq('regime_id', regime.id).eq('fy_start', fyStart)

  if (parsed.length > 0) {
    const { error } = await admin.from('tax_slabs').insert(
      parsed
        .filter((r) => Number.isFinite(r.min) && Number.isFinite(r.rate))
        .map((r) => ({
          regime_id: regime.id,
          fy_start: fyStart,
          fy_end: fyEnd,
          taxable_income_min: r.min,
          taxable_income_max: r.max,
          rate_percent: r.rate,
        })),
    )
    if (error) return { error: error.message }
  }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'tax.save_slabs',
    summary: `Saved ${parsed.length} slab(s) for ${regimeCode} FY ${fyStart}`,
  })

  revalidatePath('/settings/tax')
  revalidatePath(`/settings/tax/${fyStart}`)
  return { ok: true }
}

export async function saveConfigAction(formData: FormData): Promise<{ ok?: true; error?: string }> {
  const session = await verifySession()
  const fyStart = String(formData.get('fy_start') ?? '')
  const fyEnd = String(formData.get('fy_end') ?? '')
  const regimeCode = String(formData.get('regime') ?? '') as 'NEW' | 'OLD'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fyStart)) return { error: 'Invalid fy_start' }

  const payload = {
    standard_deduction: Number(formData.get('standard_deduction') ?? 0),
    rebate_87a_income_limit: Number(formData.get('rebate_87a_income_limit') ?? 0),
    rebate_87a_max_amount: Number(formData.get('rebate_87a_max_amount') ?? 0),
    cess_percent: Number(formData.get('cess_percent') ?? 0),
    surcharge_enabled: formData.get('surcharge_enabled') === 'on',
  }

  const admin = createAdminClient()
  const { data: regime } = await admin.from('tax_regimes').select('id').eq('code', regimeCode).maybeSingle()
  if (!regime) return { error: 'Regime not found' }

  // Upsert on (regime_id, fy_start)
  const { data: existing } = await admin.from('tax_config').select('id').eq('regime_id', regime.id).eq('fy_start', fyStart).maybeSingle()
  if (existing) {
    const { error } = await admin.from('tax_config').update(payload).eq('id', existing.id)
    if (error) return { error: error.message }
  } else {
    const { error } = await admin.from('tax_config').insert({ regime_id: regime.id, fy_start: fyStart, fy_end: fyEnd, ...payload })
    if (error) return { error: error.message }
  }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'tax.save_config',
    summary: `Saved tax config for ${regimeCode} FY ${fyStart}`,
  })

  revalidatePath('/settings/tax')
  revalidatePath(`/settings/tax/${fyStart}`)
  return { ok: true }
}

type SurchargePayload = { min: number; max: number | null; rate: number }

export async function saveSurchargeAction(formData: FormData): Promise<{ ok?: true; error?: string }> {
  const session = await verifySession()
  const fyStart = String(formData.get('fy_start') ?? '')
  const fyEnd = String(formData.get('fy_end') ?? '')
  const regimeCode = String(formData.get('regime') ?? '') as 'NEW' | 'OLD'
  const slabsJson = String(formData.get('slabs') ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fyStart)) return { error: 'Invalid fy_start' }

  let parsed: SurchargePayload[]
  try {
    parsed = JSON.parse(slabsJson)
  } catch {
    return { error: 'Malformed slabs payload' }
  }

  const admin = createAdminClient()
  const { data: regime } = await admin.from('tax_regimes').select('id').eq('code', regimeCode).maybeSingle()
  if (!regime) return { error: 'Regime not found' }

  await admin.from('tax_surcharge_slabs').delete().eq('regime_id', regime.id).eq('fy_start', fyStart)
  if (parsed.length > 0) {
    const { error } = await admin.from('tax_surcharge_slabs').insert(
      parsed.map((r) => ({
        regime_id: regime.id,
        fy_start: fyStart,
        fy_end: fyEnd,
        taxable_income_min: r.min,
        taxable_income_max: r.max,
        surcharge_percent: r.rate,
      })),
    )
    if (error) return { error: error.message }
  }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'tax.save_surcharge',
    summary: `Saved ${parsed.length} surcharge slab(s) for ${regimeCode} FY ${fyStart}`,
  })

  revalidatePath('/settings/tax')
  revalidatePath(`/settings/tax/${fyStart}`)
  return { ok: true }
}
