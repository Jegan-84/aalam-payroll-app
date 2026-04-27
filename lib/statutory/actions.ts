'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifySession, requireRole } from '@/lib/auth/dal'

type NumericField =
  | 'epf_employee_percent' | 'epf_employer_percent'
  | 'epf_wage_ceiling' | 'epf_max_monthly_contribution'
  | 'esi_employee_percent' | 'esi_employer_percent' | 'esi_wage_ceiling'
  | 'gratuity_percent'
  | 'basic_percent_of_gross' | 'hra_percent_of_basic'
  | 'conv_percent_of_basic' | 'conv_monthly_cap'

const FIELDS: Array<{ key: NumericField; min: number; max: number; label: string }> = [
  { key: 'epf_employee_percent',         min: 0, max: 100, label: 'EPF employee %' },
  { key: 'epf_employer_percent',         min: 0, max: 100, label: 'EPF employer %' },
  { key: 'epf_wage_ceiling',             min: 0, max: 10_000_000, label: 'EPF wage ceiling ₹' },
  { key: 'epf_max_monthly_contribution', min: 0, max: 1_000_000, label: 'EPF max monthly contribution ₹' },
  { key: 'esi_employee_percent',         min: 0, max: 100, label: 'ESI employee %' },
  { key: 'esi_employer_percent',         min: 0, max: 100, label: 'ESI employer %' },
  { key: 'esi_wage_ceiling',             min: 0, max: 10_000_000, label: 'ESI wage ceiling ₹' },
  { key: 'gratuity_percent',             min: 0, max: 100, label: 'Gratuity %' },
  { key: 'basic_percent_of_gross',       min: 1, max: 100, label: 'BASIC % of Gross' },
  { key: 'hra_percent_of_basic',         min: 0, max: 100, label: 'HRA % of BASIC' },
  { key: 'conv_percent_of_basic',        min: 0, max: 100, label: 'Conveyance % of BASIC' },
  { key: 'conv_monthly_cap',             min: 0, max: 10_000_000, label: 'Conveyance monthly cap ₹' },
]

export async function saveStatutoryConfigAction(
  formData: FormData,
): Promise<{ ok?: true; error?: string }> {
  const session = await verifySession()
  await requireRole('admin', 'hr', 'payroll')

  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'Missing id' }

  const patch: Record<string, number> = {}
  for (const f of FIELDS) {
    const v = Number(formData.get(f.key))
    if (!Number.isFinite(v) || v < f.min || v > f.max) {
      return { error: `${f.label}: must be between ${f.min} and ${f.max}` }
    }
    patch[f.key] = v
  }

  const admin = createAdminClient()
  const { error } = await admin.from('statutory_config').update(patch).eq('id', id)
  if (error) return { error: error.message }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'statutory.update',
    entity_type: 'statutory_config',
    entity_id: id,
    summary: 'Updated statutory configuration',
    after_state: patch,
  })

  revalidatePath('/settings/statutory')
  revalidatePath('/settings/components')
  return { ok: true }
}

// -----------------------------------------------------------------------------
// rollNewStatutoryPeriod — closes the current period and opens a new one with
// its own effective_from. Use this when the government revises rates (PF/ESI
// ceiling change, etc.) so historical payslips can still be reconstructed
// against the rates that were in force at the time.
// -----------------------------------------------------------------------------
export async function rollStatutoryPeriodAction(
  formData: FormData,
): Promise<{ ok?: true; error?: string; id?: string }> {
  const session = await verifySession()
  await requireRole('admin', 'hr', 'payroll')

  const effectiveFrom = String(formData.get('effective_from') ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) return { error: 'Invalid effective_from date' }

  // Collect + validate values for the NEW period.
  const patch: Record<string, number> = {}
  for (const f of FIELDS) {
    const v = Number(formData.get(f.key))
    if (!Number.isFinite(v) || v < f.min || v > f.max) {
      return { error: `${f.label}: must be between ${f.min} and ${f.max}` }
    }
    patch[f.key] = v
  }

  const admin = createAdminClient()

  // Find the currently-active period (the one whose range covers `effectiveFrom − 1`).
  const priorEnd = new Date(new Date(effectiveFrom + 'T00:00:00Z').getTime() - 86_400_000)
    .toISOString()
    .slice(0, 10)
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
      return { error: 'New effective date must be AFTER the current period started.' }
    }
    // Close the current period.
    const { error: closeErr } = await admin
      .from('statutory_config')
      .update({ effective_to: priorEnd })
      .eq('id', current.id)
    if (closeErr) return { error: closeErr.message }
  }

  // Insert the new period.
  const { data: inserted, error } = await admin
    .from('statutory_config')
    .insert({
      ...patch,
      effective_from: effectiveFrom,
      effective_to: null,
    })
    .select('id')
    .single()
  if (error) return { error: error.message }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'statutory.roll_period',
    entity_type: 'statutory_config',
    entity_id: inserted.id,
    summary: `Rolled new statutory period effective ${effectiveFrom}`,
    after_state: patch,
  })

  revalidatePath('/settings/statutory')
  revalidatePath('/settings/components')
  return { ok: true, id: inserted.id as string }
}
