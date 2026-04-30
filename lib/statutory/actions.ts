'use server'

import { requireRole } from '@/lib/auth/dal'
import { submitConfigChange } from '@/lib/config-approvals/actions'

// =============================================================================
// Statutory configuration — two-level approval.
// =============================================================================
// HR / payroll fills out the form; nothing is written to `statutory_config`
// directly. We persist the proposed values in `config_pending_changes` and an
// admin reviews + approves on /settings/approvals. On approval, the dispatcher
// in lib/config-approvals/appliers.ts calls applyStatutoryUpdate /
// applyStatutoryRollPeriod which performs the actual mutation.
// =============================================================================

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

  const res = await submitConfigChange({
    target_table: 'statutory_config',
    action: 'update',
    target_id: id,
    payload: { id, ...patch },
    description: 'Update statutory configuration (PF / ESI / gratuity / CTC structure)',
  })
  if (res.error) return { error: res.error }
  return { ok: true }
}

// -----------------------------------------------------------------------------
// rollNewStatutoryPeriod — closes the current period and opens a new one with
// its own effective_from. Goes through the same approval gate.
//
// New periods can pick the ESI calculation basis ('gross' | 'basic'); this is
// locked once the period is created. Existing rows default to 'gross', which
// preserves the historical behaviour for any data filed before this feature.
// -----------------------------------------------------------------------------
export async function rollStatutoryPeriodAction(
  formData: FormData,
): Promise<{ ok?: true; error?: string; id?: string }> {
  await requireRole('admin', 'hr', 'payroll')

  const effectiveFrom = String(formData.get('effective_from') ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) return { error: 'Invalid effective_from date' }

  const patch: Record<string, number | string> = {}
  for (const f of FIELDS) {
    const v = Number(formData.get(f.key))
    if (!Number.isFinite(v) || v < f.min || v > f.max) {
      return { error: `${f.label}: must be between ${f.min} and ${f.max}` }
    }
    patch[f.key] = v
  }

  const esiBasisRaw = String(formData.get('esi_basis') ?? 'gross').toLowerCase()
  if (esiBasisRaw !== 'gross' && esiBasisRaw !== 'basic') {
    return { error: 'ESI basis must be gross or basic' }
  }
  patch.esi_basis = esiBasisRaw

  const res = await submitConfigChange({
    target_table: 'statutory_config',
    action: 'roll_period',
    target_id: null,
    payload: { effective_from: effectiveFrom, ...patch },
    description: `Roll new statutory period effective ${effectiveFrom} (ESI on ${esiBasisRaw})`,
  })
  if (res.error) return { error: res.error }
  return { ok: true, id: res.id }
}
