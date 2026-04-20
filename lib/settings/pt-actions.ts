'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/dal'

type SlabPayload = {
  id?: number
  half_year_gross_min: number
  half_year_gross_max: number | null
  half_year_pt_amount: number
}

/**
 * Replace ALL slabs for (state_code, effective_from) with the submitted set.
 * Optionally updates effective_to for the period.
 */
export async function savePtPeriodAction(formData: FormData): Promise<{ ok?: true; error?: string }> {
  const session = await requireRole('admin', 'hr')
  const stateCode = String(formData.get('state_code') ?? '').toUpperCase()
  const effectiveFrom = String(formData.get('effective_from') ?? '')
  const effectiveToRaw = String(formData.get('effective_to') ?? '').trim()
  const slabsJson = String(formData.get('slabs') ?? '')

  if (!stateCode) return { error: 'Missing state code' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) return { error: 'Invalid effective_from' }
  const effectiveTo = effectiveToRaw === '' ? null : (/^\d{4}-\d{2}-\d{2}$/.test(effectiveToRaw) ? effectiveToRaw : null)

  let parsed: SlabPayload[]
  try {
    parsed = JSON.parse(slabsJson)
  } catch {
    return { error: 'Malformed slabs payload' }
  }

  const admin = createAdminClient()

  // Wipe existing rows for this (state, effective_from) and re-insert.
  await admin.from('pt_slabs').delete().eq('state_code', stateCode).eq('effective_from', effectiveFrom)

  if (parsed.length > 0) {
    const rows = parsed
      .filter((r) => Number.isFinite(r.half_year_gross_min) && Number.isFinite(r.half_year_pt_amount))
      .map((r) => ({
        state_code: stateCode,
        effective_from: effectiveFrom,
        effective_to: effectiveTo,
        half_year_gross_min: r.half_year_gross_min,
        half_year_gross_max: r.half_year_gross_max,
        half_year_pt_amount: r.half_year_pt_amount,
      }))
    const { error } = await admin.from('pt_slabs').insert(rows)
    if (error) return { error: error.message }
  }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'pt.save_period',
    summary: `Saved ${parsed.length} PT slab(s) for ${stateCode} effective ${effectiveFrom}`,
  })

  revalidatePath('/settings/pt')
  return { ok: true }
}

/**
 * Close the current period (set effective_to) and clone its slabs into a new
 * period starting effective_from.
 */
export async function rollNewPtPeriodAction(formData: FormData): Promise<void> {
  const session = await requireRole('admin', 'hr')
  const stateCode = String(formData.get('state_code') ?? '').toUpperCase()
  const newFrom = String(formData.get('new_effective_from') ?? '')
  if (!stateCode) throw new Error('Missing state')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(newFrom)) throw new Error('Invalid new effective_from')

  const admin = createAdminClient()

  // Find the current period's effective_from (most recent with effective_to null, or latest)
  const { data: current } = await admin
    .from('pt_slabs')
    .select('*')
    .eq('state_code', stateCode)
    .is('effective_to', null)
    .order('effective_from', { ascending: false })
    .limit(1)
  const currentFrom = current?.[0]?.effective_from as string | undefined

  // Guard: target must be after current start
  if (currentFrom && newFrom <= currentFrom) {
    throw new Error('New effective_from must be after the current period.')
  }

  // Load the source slabs
  const sourceFrom = currentFrom
  const { data: sourceSlabs } = await admin
    .from('pt_slabs')
    .select('half_year_gross_min, half_year_gross_max, half_year_pt_amount')
    .eq('state_code', stateCode)
    .eq('effective_from', sourceFrom ?? newFrom)
  if (!sourceSlabs || sourceSlabs.length === 0) throw new Error('No source slabs to clone.')

  // Close the current period — set effective_to = newFrom - 1 day
  if (currentFrom) {
    const d = new Date(newFrom + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() - 1)
    const closeTo = d.toISOString().slice(0, 10)
    await admin
      .from('pt_slabs')
      .update({ effective_to: closeTo })
      .eq('state_code', stateCode)
      .eq('effective_from', currentFrom)
  }

  // Insert new period
  const rows = sourceSlabs.map((r) => ({
    state_code: stateCode,
    effective_from: newFrom,
    effective_to: null,
    half_year_gross_min: r.half_year_gross_min,
    half_year_gross_max: r.half_year_gross_max,
    half_year_pt_amount: r.half_year_pt_amount,
  }))
  await admin.from('pt_slabs').insert(rows)

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'pt.roll_period',
    summary: `Rolled ${stateCode} PT period. Closed ${currentFrom ?? '-'} and started ${newFrom}.`,
  })

  revalidatePath('/settings/pt')
  redirect('/settings/pt')
}
