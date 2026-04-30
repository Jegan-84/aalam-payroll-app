'use server'

import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth/dal'
import { submitConfigChange } from '@/lib/config-approvals/actions'

// =============================================================================
// Tax configuration — two-level approval gate.
// =============================================================================
// Tax slabs / config / surcharge / FY-clone all go through the same pending-
// changes table. Maker writes a proposal; admin reviews and approves on
// /settings/approvals. The dispatcher in lib/config-approvals/appliers.ts
// performs the actual mutation on approval.
// =============================================================================

export async function cloneFyAction(formData: FormData): Promise<void> {
  await requireRole('admin', 'hr', 'payroll')

  const sourceFyStart = String(formData.get('source_fy_start') ?? '')
  const newFyStart = String(formData.get('new_fy_start') ?? '')
  const newFyEnd = String(formData.get('new_fy_end') ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sourceFyStart)) throw new Error('Invalid source FY')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(newFyStart) || !/^\d{4}-\d{2}-\d{2}$/.test(newFyEnd)) throw new Error('Invalid new FY')

  const res = await submitConfigChange({
    target_table: 'tax_clone_fy',
    action: 'clone',
    payload: { source_fy_start: sourceFyStart, new_fy_start: newFyStart, new_fy_end: newFyEnd },
    description: `Clone tax config FY ${sourceFyStart} → FY ${newFyStart}`,
  })
  if (res.error) throw new Error(res.error)
  redirect('/settings/approvals')
}

type SlabPayload = { id?: number; min: number; max: number | null; rate: number }

export async function saveSlabsAction(formData: FormData): Promise<{ ok?: true; error?: string }> {
  await requireRole('admin', 'hr', 'payroll')

  const fyStart = String(formData.get('fy_start') ?? '')
  const fyEnd = String(formData.get('fy_end') ?? '')
  const regimeCode = String(formData.get('regime') ?? '') as 'NEW' | 'OLD'
  const slabsJson = String(formData.get('slabs') ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fyStart)) return { error: 'Invalid fy_start' }
  if (!['NEW', 'OLD'].includes(regimeCode)) return { error: 'Invalid regime' }

  let parsed: SlabPayload[]
  try { parsed = JSON.parse(slabsJson) } catch { return { error: 'Malformed slabs payload' } }

  const slabs = parsed
    .filter((r) => Number.isFinite(r.min) && Number.isFinite(r.rate))
    .map((r) => ({ min: r.min, max: r.max, rate: r.rate }))

  const res = await submitConfigChange({
    target_table: 'tax_slabs',
    action: 'replace',
    target_id: `${regimeCode}:${fyStart}`,
    payload: { fy_start: fyStart, fy_end: fyEnd, regime: regimeCode, slabs },
    description: `Tax slabs — ${regimeCode} regime FY ${fyStart} (${slabs.length} slab${slabs.length === 1 ? '' : 's'})`,
  })
  if (res.error) return { error: res.error }
  return { ok: true }
}

export async function saveConfigAction(formData: FormData): Promise<{ ok?: true; error?: string }> {
  await requireRole('admin', 'hr', 'payroll')

  const fyStart = String(formData.get('fy_start') ?? '')
  const fyEnd = String(formData.get('fy_end') ?? '')
  const regimeCode = String(formData.get('regime') ?? '') as 'NEW' | 'OLD'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fyStart)) return { error: 'Invalid fy_start' }

  const payload = {
    fy_start: fyStart,
    fy_end: fyEnd,
    regime: regimeCode,
    standard_deduction: Number(formData.get('standard_deduction') ?? 0),
    rebate_87a_income_limit: Number(formData.get('rebate_87a_income_limit') ?? 0),
    rebate_87a_max_amount: Number(formData.get('rebate_87a_max_amount') ?? 0),
    cess_percent: Number(formData.get('cess_percent') ?? 0),
    surcharge_enabled: formData.get('surcharge_enabled') === 'on',
  }

  const res = await submitConfigChange({
    target_table: 'tax_config',
    action: 'upsert',
    target_id: `${regimeCode}:${fyStart}`,
    payload,
    description: `Tax config — ${regimeCode} regime FY ${fyStart}`,
  })
  if (res.error) return { error: res.error }
  return { ok: true }
}

type SurchargePayload = { min: number; max: number | null; rate: number }

export async function saveSurchargeAction(formData: FormData): Promise<{ ok?: true; error?: string }> {
  await requireRole('admin', 'hr', 'payroll')

  const fyStart = String(formData.get('fy_start') ?? '')
  const fyEnd = String(formData.get('fy_end') ?? '')
  const regimeCode = String(formData.get('regime') ?? '') as 'NEW' | 'OLD'
  const slabsJson = String(formData.get('slabs') ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fyStart)) return { error: 'Invalid fy_start' }

  let parsed: SurchargePayload[]
  try { parsed = JSON.parse(slabsJson) } catch { return { error: 'Malformed slabs payload' } }

  const res = await submitConfigChange({
    target_table: 'tax_surcharge_slabs',
    action: 'replace',
    target_id: `${regimeCode}:${fyStart}`,
    payload: { fy_start: fyStart, fy_end: fyEnd, regime: regimeCode, slabs: parsed },
    description: `Tax surcharge slabs — ${regimeCode} regime FY ${fyStart} (${parsed.length} slab${parsed.length === 1 ? '' : 's'})`,
  })
  if (res.error) return { error: res.error }
  return { ok: true }
}
