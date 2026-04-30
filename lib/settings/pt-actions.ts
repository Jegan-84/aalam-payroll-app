'use server'

import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth/dal'
import { submitConfigChange } from '@/lib/config-approvals/actions'

// =============================================================================
// PT (professional tax) — two-level approval gate.
// =============================================================================
// Maker fills the slabs / rolls a new period; nothing is written to pt_slabs
// directly. Admin reviews and approves on /settings/approvals; the dispatcher
// (lib/config-approvals/appliers.ts) performs the actual mutation.
// =============================================================================

type SlabPayload = {
  id?: number
  half_year_gross_min: number
  half_year_gross_max: number | null
  half_year_pt_amount: number
}

export async function savePtPeriodAction(formData: FormData): Promise<{ ok?: true; error?: string }> {
  await requireRole('admin', 'hr')

  const stateCode = String(formData.get('state_code') ?? '').toUpperCase()
  const effectiveFrom = String(formData.get('effective_from') ?? '')
  const effectiveToRaw = String(formData.get('effective_to') ?? '').trim()
  const slabsJson = String(formData.get('slabs') ?? '')

  if (!stateCode) return { error: 'Missing state code' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) return { error: 'Invalid effective_from' }
  const effectiveTo = effectiveToRaw === '' ? null : (/^\d{4}-\d{2}-\d{2}$/.test(effectiveToRaw) ? effectiveToRaw : null)

  let parsed: SlabPayload[]
  try { parsed = JSON.parse(slabsJson) } catch { return { error: 'Malformed slabs payload' } }

  const slabs = parsed.filter((r) => Number.isFinite(r.half_year_gross_min) && Number.isFinite(r.half_year_pt_amount))

  const res = await submitConfigChange({
    target_table: 'pt_slabs',
    action: 'replace',
    target_id: `${stateCode}:${effectiveFrom}`,
    payload: { state_code: stateCode, effective_from: effectiveFrom, effective_to: effectiveTo, slabs },
    description: `PT slabs — ${stateCode} effective ${effectiveFrom} (${slabs.length} slab${slabs.length === 1 ? '' : 's'})`,
  })
  if (res.error) return { error: res.error }
  return { ok: true }
}

export async function rollNewPtPeriodAction(formData: FormData): Promise<void> {
  await requireRole('admin', 'hr')
  const stateCode = String(formData.get('state_code') ?? '').toUpperCase()
  const newFrom = String(formData.get('new_effective_from') ?? '')
  if (!stateCode) throw new Error('Missing state')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(newFrom)) throw new Error('Invalid new effective_from')

  const res = await submitConfigChange({
    target_table: 'pt_slabs',
    action: 'roll_period',
    target_id: stateCode,
    payload: { state_code: stateCode, new_effective_from: newFrom },
    description: `Roll PT period — ${stateCode} new period from ${newFrom}`,
  })
  if (res.error) throw new Error(res.error)
  redirect('/settings/approvals')
}
