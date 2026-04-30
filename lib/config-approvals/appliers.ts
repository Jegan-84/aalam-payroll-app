import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

// =============================================================================
// Appliers — actually mutate the live config tables.
// =============================================================================
// Called by approveConfigChangeAction once the change has been approved.
// Each function takes the raw `payload` JSON from config_pending_changes and
// writes to the target table. Failures bubble back to the caller so the
// pending-changes row stays in 'submitted' state and the admin can retry.
// =============================================================================

type Admin = ReturnType<typeof createAdminClient>

// -----------------------------------------------------------------------------
// statutory_config
// -----------------------------------------------------------------------------
export async function applyStatutoryUpdate(
  admin: Admin,
  payload: Record<string, unknown>,
): Promise<void> {
  const id = String(payload.id ?? '')
  if (!id) throw new Error('applyStatutoryUpdate: missing id')
  const patch = { ...payload }
  delete (patch as Record<string, unknown>).id
  const { error } = await admin.from('statutory_config').update(patch).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function applyStatutoryRollPeriod(
  admin: Admin,
  payload: Record<string, unknown>,
): Promise<{ id: string }> {
  const effectiveFrom = String(payload.effective_from ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) {
    throw new Error('applyStatutoryRollPeriod: invalid effective_from')
  }
  const patch = { ...payload }
  delete (patch as Record<string, unknown>).effective_from

  // Close the currently-open period (the one whose range covers the prior day).
  const priorEnd = new Date(new Date(effectiveFrom + 'T00:00:00Z').getTime() - 86_400_000)
    .toISOString().slice(0, 10)
  const { data: current } = await admin
    .from('statutory_config')
    .select('id, effective_from, effective_to')
    .lte('effective_from', priorEnd)
    .or(`effective_to.is.null,effective_to.gte.${priorEnd}`)
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (current) {
    if ((current.effective_from as string) >= effectiveFrom) {
      throw new Error('applyStatutoryRollPeriod: new effective date must be after current period started')
    }
    const { error: closeErr } = await admin
      .from('statutory_config')
      .update({ effective_to: priorEnd })
      .eq('id', current.id)
    if (closeErr) throw new Error(closeErr.message)
  }

  const { data, error } = await admin
    .from('statutory_config')
    .insert({ ...patch, effective_from: effectiveFrom, effective_to: null })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return { id: data.id as string }
}

// -----------------------------------------------------------------------------
// tax_slabs / tax_config / tax_surcharge_slabs
// -----------------------------------------------------------------------------
type SlabPayload = { fy_start: string; fy_end: string; regime: 'NEW' | 'OLD'; slabs: Array<{ min: number; max: number | null; rate: number }> }
type SurchargePayload = SlabPayload

export async function applyTaxSlabsReplace(
  admin: Admin,
  payload: SlabPayload,
): Promise<void> {
  const { data: regime } = await admin
    .from('tax_regimes').select('id').eq('code', payload.regime).maybeSingle()
  if (!regime) throw new Error('applyTaxSlabsReplace: regime not found')

  await admin.from('tax_slabs').delete().eq('regime_id', regime.id).eq('fy_start', payload.fy_start)

  if (payload.slabs.length > 0) {
    const { error } = await admin.from('tax_slabs').insert(
      payload.slabs
        .filter((r) => Number.isFinite(r.min) && Number.isFinite(r.rate))
        .map((r) => ({
          regime_id: regime.id,
          fy_start: payload.fy_start,
          fy_end: payload.fy_end,
          taxable_income_min: r.min,
          taxable_income_max: r.max,
          rate_percent: r.rate,
        })),
    )
    if (error) throw new Error(error.message)
  }
}

type TaxConfigPayload = {
  fy_start: string
  fy_end: string
  regime: 'NEW' | 'OLD'
  standard_deduction: number
  rebate_87a_income_limit: number
  rebate_87a_max_amount: number
  cess_percent: number
  surcharge_enabled: boolean
}

export async function applyTaxConfigUpsert(
  admin: Admin,
  payload: TaxConfigPayload,
): Promise<void> {
  const { data: regime } = await admin
    .from('tax_regimes').select('id').eq('code', payload.regime).maybeSingle()
  if (!regime) throw new Error('applyTaxConfigUpsert: regime not found')

  const values = {
    standard_deduction: payload.standard_deduction,
    rebate_87a_income_limit: payload.rebate_87a_income_limit,
    rebate_87a_max_amount: payload.rebate_87a_max_amount,
    cess_percent: payload.cess_percent,
    surcharge_enabled: payload.surcharge_enabled,
  }

  const { data: existing } = await admin
    .from('tax_config')
    .select('id')
    .eq('regime_id', regime.id)
    .eq('fy_start', payload.fy_start)
    .maybeSingle()

  if (existing) {
    const { error } = await admin.from('tax_config').update(values).eq('id', existing.id)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await admin
      .from('tax_config')
      .insert({ regime_id: regime.id, fy_start: payload.fy_start, fy_end: payload.fy_end, ...values })
    if (error) throw new Error(error.message)
  }
}

export async function applyTaxSurchargeReplace(
  admin: Admin,
  payload: SurchargePayload,
): Promise<void> {
  const { data: regime } = await admin
    .from('tax_regimes').select('id').eq('code', payload.regime).maybeSingle()
  if (!regime) throw new Error('applyTaxSurchargeReplace: regime not found')

  await admin.from('tax_surcharge_slabs').delete().eq('regime_id', regime.id).eq('fy_start', payload.fy_start)

  if (payload.slabs.length > 0) {
    const { error } = await admin.from('tax_surcharge_slabs').insert(
      payload.slabs.map((r) => ({
        regime_id: regime.id,
        fy_start: payload.fy_start,
        fy_end: payload.fy_end,
        taxable_income_min: r.min,
        taxable_income_max: r.max,
        surcharge_percent: r.rate,
      })),
    )
    if (error) throw new Error(error.message)
  }
}

type CloneFyPayload = { source_fy_start: string; new_fy_start: string; new_fy_end: string }

export async function applyTaxCloneFy(
  admin: Admin,
  payload: CloneFyPayload,
): Promise<void> {
  const { data: existing } = await admin
    .from('tax_slabs').select('id').eq('fy_start', payload.new_fy_start).limit(1)
  if (existing && existing.length > 0) {
    throw new Error('Target FY already has tax data — cannot clone over it.')
  }

  const [{ data: srcSlabs }, { data: srcConfig }, { data: srcSurcharge }] = await Promise.all([
    admin.from('tax_slabs').select('regime_id, taxable_income_min, taxable_income_max, rate_percent').eq('fy_start', payload.source_fy_start),
    admin.from('tax_config').select('regime_id, standard_deduction, rebate_87a_income_limit, rebate_87a_max_amount, cess_percent, surcharge_enabled').eq('fy_start', payload.source_fy_start),
    admin.from('tax_surcharge_slabs').select('regime_id, taxable_income_min, taxable_income_max, surcharge_percent').eq('fy_start', payload.source_fy_start),
  ])

  if (!srcSlabs || srcSlabs.length === 0) throw new Error('Source FY has no tax data to clone.')

  const { error: e1 } = await admin
    .from('tax_slabs')
    .insert(srcSlabs.map((s) => ({ ...s, fy_start: payload.new_fy_start, fy_end: payload.new_fy_end })))
  if (e1) throw new Error(e1.message)

  if (srcConfig && srcConfig.length > 0) {
    const { error } = await admin
      .from('tax_config')
      .insert(srcConfig.map((c) => ({ ...c, fy_start: payload.new_fy_start, fy_end: payload.new_fy_end })))
    if (error) throw new Error(error.message)
  }
  if (srcSurcharge && srcSurcharge.length > 0) {
    const { error } = await admin
      .from('tax_surcharge_slabs')
      .insert(srcSurcharge.map((s) => ({ ...s, fy_start: payload.new_fy_start, fy_end: payload.new_fy_end })))
    if (error) throw new Error(error.message)
  }
}

// -----------------------------------------------------------------------------
// pt_slabs
// -----------------------------------------------------------------------------
type PtSavePayload = {
  state_code: string
  effective_from: string
  effective_to: string | null
  slabs: Array<{ half_year_gross_min: number; half_year_gross_max: number | null; half_year_pt_amount: number }>
}

export async function applyPtSlabsReplace(
  admin: Admin,
  payload: PtSavePayload,
): Promise<void> {
  await admin
    .from('pt_slabs')
    .delete()
    .eq('state_code', payload.state_code)
    .eq('effective_from', payload.effective_from)

  if (payload.slabs.length > 0) {
    const rows = payload.slabs
      .filter((r) => Number.isFinite(r.half_year_gross_min) && Number.isFinite(r.half_year_pt_amount))
      .map((r) => ({
        state_code: payload.state_code,
        effective_from: payload.effective_from,
        effective_to: payload.effective_to,
        half_year_gross_min: r.half_year_gross_min,
        half_year_gross_max: r.half_year_gross_max,
        half_year_pt_amount: r.half_year_pt_amount,
      }))
    const { error } = await admin.from('pt_slabs').insert(rows)
    if (error) throw new Error(error.message)
  }
}

type PtRollPayload = { state_code: string; new_effective_from: string }

export async function applyPtRollPeriod(
  admin: Admin,
  payload: PtRollPayload,
): Promise<void> {
  const { data: current } = await admin
    .from('pt_slabs')
    .select('*')
    .eq('state_code', payload.state_code)
    .is('effective_to', null)
    .order('effective_from', { ascending: false })
    .limit(1)
  const currentFrom = current?.[0]?.effective_from as string | undefined

  if (currentFrom && payload.new_effective_from <= currentFrom) {
    throw new Error('applyPtRollPeriod: new effective_from must be after the current period')
  }

  const { data: src } = await admin
    .from('pt_slabs')
    .select('half_year_gross_min, half_year_gross_max, half_year_pt_amount')
    .eq('state_code', payload.state_code)
    .eq('effective_from', currentFrom ?? payload.new_effective_from)
  if (!src || src.length === 0) throw new Error('applyPtRollPeriod: no source slabs to clone')

  if (currentFrom) {
    const d = new Date(payload.new_effective_from + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() - 1)
    const closeTo = d.toISOString().slice(0, 10)
    const { error } = await admin
      .from('pt_slabs')
      .update({ effective_to: closeTo })
      .eq('state_code', payload.state_code)
      .eq('effective_from', currentFrom)
    if (error) throw new Error(error.message)
  }

  const rows = src.map((r) => ({
    state_code: payload.state_code,
    effective_from: payload.new_effective_from,
    effective_to: null,
    half_year_gross_min: r.half_year_gross_min,
    half_year_gross_max: r.half_year_gross_max,
    half_year_pt_amount: r.half_year_pt_amount,
  }))
  const { error } = await admin.from('pt_slabs').insert(rows)
  if (error) throw new Error(error.message)
}

// -----------------------------------------------------------------------------
// Dispatcher — chooses the right applier from (target_table, action).
// -----------------------------------------------------------------------------
export async function applyConfigChange(
  admin: Admin,
  target: string,
  action: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const key = `${target}:${action}`
  switch (key) {
    case 'statutory_config:update':
      await applyStatutoryUpdate(admin, payload); return
    case 'statutory_config:roll_period':
      await applyStatutoryRollPeriod(admin, payload); return
    case 'tax_slabs:replace':
      await applyTaxSlabsReplace(admin, payload as unknown as SlabPayload); return
    case 'tax_config:upsert':
      await applyTaxConfigUpsert(admin, payload as unknown as TaxConfigPayload); return
    case 'tax_surcharge_slabs:replace':
      await applyTaxSurchargeReplace(admin, payload as unknown as SurchargePayload); return
    case 'tax_clone_fy:clone':
      await applyTaxCloneFy(admin, payload as unknown as CloneFyPayload); return
    case 'pt_slabs:replace':
      await applyPtSlabsReplace(admin, payload as unknown as PtSavePayload); return
    case 'pt_slabs:roll_period':
      await applyPtRollPeriod(admin, payload as unknown as PtRollPayload); return
    default:
      throw new Error(`applyConfigChange: no applier for ${key}`)
  }
}

export const PATHS_TO_REVALIDATE: Record<string, string[]> = {
  'statutory_config:update': ['/settings/statutory', '/settings/components'],
  'statutory_config:roll_period': ['/settings/statutory', '/settings/components'],
  'tax_slabs:replace': ['/settings/tax'],
  'tax_config:upsert': ['/settings/tax'],
  'tax_surcharge_slabs:replace': ['/settings/tax'],
  'tax_clone_fy:clone': ['/settings/tax'],
  'pt_slabs:replace': ['/settings/pt'],
  'pt_slabs:roll_period': ['/settings/pt'],
}
