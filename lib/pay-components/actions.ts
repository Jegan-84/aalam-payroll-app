'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifySession, requireRole } from '@/lib/auth/dal'
import { validateFormulaSyntax } from '@/lib/payroll/formula'

const RESERVED_CODES = new Set([
  'BASIC', 'HRA', 'CONV', 'OTHERALLOW',
  'PF_EE', 'ESI_EE', 'PT', 'TDS',
  'PF_ER', 'ESI_ER', 'GRATUITY', 'MEDINS',
  'INTERNET', 'TRAINING', 'INCENTIVE',
  'VP', 'LUNCH', 'SHIFT',
])

type ValidKind = 'earning' | 'deduction' | 'employer_retiral' | 'reimbursement'
const VALID_KINDS = new Set<ValidKind>(['earning', 'deduction', 'employer_retiral', 'reimbursement'])
type CalcType = 'fixed' | 'percent_of_basic' | 'percent_of_gross' | 'formula'
const VALID_CALC_TYPES = new Set<CalcType>(['fixed', 'percent_of_basic', 'percent_of_gross', 'formula'])

function readInput(formData: FormData) {
  const code = String(formData.get('code') ?? '').toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 32)
  const name = String(formData.get('name') ?? '').trim().slice(0, 80)
  const kind = String(formData.get('kind') ?? '')
  const taxable = formData.get('taxable') === 'on' || formData.get('taxable') === 'true'
  const includeInGross = formData.get('include_in_gross') === 'on' || formData.get('include_in_gross') === 'true'
  const prorate = formData.get('prorate') === 'on' || formData.get('prorate') === 'true'
  const isActive = formData.get('is_active') === 'on' || formData.get('is_active') === 'true'
  const calculationType = String(formData.get('calculation_type') ?? '')
  const percentValue = formData.get('percent_value') ? Number(formData.get('percent_value')) : null
  const capAmount = formData.get('cap_amount') ? Number(formData.get('cap_amount')) : null
  const formula = String(formData.get('formula') ?? '').trim() || null
  const displayOrder = Number(formData.get('display_order') ?? 500)

  return {
    code, name, kind, taxable, includeInGross, prorate, isActive,
    calculationType, percentValue, capAmount, formula, displayOrder,
  }
}

function validate(i: ReturnType<typeof readInput>): string | null {
  if (!i.code || !/^[A-Z][A-Z0-9_]{1,31}$/.test(i.code)) return 'Code must be uppercase alphanumeric starting with a letter (e.g. NIGHT_SHIFT).'
  if (RESERVED_CODES.has(i.code)) return `Code "${i.code}" is reserved for system components. Pick a different code.`
  if (!i.name || i.name.length < 2) return 'Name is required.'
  if (!VALID_KINDS.has(i.kind as ValidKind)) return 'Kind must be earning, deduction, employer_retiral, or reimbursement.'
  if (!VALID_CALC_TYPES.has(i.calculationType as CalcType)) return 'Invalid calculation type.'
  if (i.calculationType === 'percent_of_basic' || i.calculationType === 'percent_of_gross') {
    if (i.percentValue == null || !Number.isFinite(i.percentValue) || i.percentValue < 0) return 'Percent value is required and must be ≥ 0.'
  }
  if (i.calculationType === 'formula') {
    if (!i.formula) return 'Formula is required when calculation type is "formula".'
    const err = validateFormulaSyntax(i.formula)
    if (err) return `Formula error: ${err}`
  }
  if (i.capAmount != null && (!Number.isFinite(i.capAmount) || i.capAmount < 0)) return 'Cap amount must be ≥ 0.'
  return null
}

export async function saveCustomComponentAction(
  formData: FormData,
): Promise<{ ok?: true; error?: string; id?: number }> {
  const session = await verifySession()
  await requireRole('admin', 'hr', 'payroll')

  const id = formData.get('id') ? Number(formData.get('id')) : null
  const input = readInput(formData)
  const err = validate(input)
  if (err) return { error: err }

  const admin = createAdminClient()

  // Check uniqueness when creating or changing code.
  const { data: existing } = await admin
    .from('pay_components')
    .select('id, is_custom')
    .eq('code', input.code)
    .maybeSingle()
  if (existing && existing.id !== id) {
    return { error: existing.is_custom ? 'Another custom component already uses that code.' : `"${input.code}" is a system component code.` }
  }

  const payload = {
    code: input.code,
    name: input.name,
    kind: input.kind,
    taxable: input.taxable,
    include_in_gross: input.includeInGross,
    prorate: input.prorate,
    is_active: input.isActive,
    calculation_type: input.calculationType,
    percent_value: input.percentValue,
    cap_amount: input.capAmount,
    formula: input.formula,
    display_order: input.displayOrder,
    is_custom: true,
    updated_by: session.userId,
  }

  if (id) {
    const { error } = await admin.from('pay_components').update(payload).eq('id', id).eq('is_custom', true)
    if (error) return { error: error.message }
  } else {
    const { data, error } = await admin
      .from('pay_components')
      .insert({ ...payload, created_by: session.userId })
      .select('id')
      .single()
    if (error) return { error: error.message }
    await admin.from('audit_log').insert({
      actor_user_id: session.userId,
      actor_email: session.email,
      action: 'pay_component.create',
      entity_type: 'pay_component',
      entity_id: String(data.id),
      summary: `Created custom component ${input.code}`,
    })
    revalidatePath('/settings/components')
    return { ok: true, id: data.id as number }
  }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'pay_component.update',
    entity_type: 'pay_component',
    entity_id: String(id),
    summary: `Updated custom component ${input.code}`,
  })
  revalidatePath('/settings/components')
  return { ok: true, id: id! }
}

export async function deleteCustomComponentAction(
  formData: FormData,
): Promise<{ ok?: true; error?: string }> {
  const session = await verifySession()
  await requireRole('admin', 'hr', 'payroll')
  const id = Number(formData.get('id') ?? 0)
  if (!id) return { error: 'Missing id' }

  const admin = createAdminClient()
  const { data: row } = await admin
    .from('pay_components')
    .select('code, is_custom')
    .eq('id', id)
    .maybeSingle()
  if (!row) return { error: 'Not found' }
  if (!row.is_custom) return { error: 'System components cannot be deleted.' }

  const { error } = await admin.from('pay_components').delete().eq('id', id).eq('is_custom', true)
  if (error) return { error: error.message }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'pay_component.delete',
    entity_type: 'pay_component',
    entity_id: String(id),
    summary: `Deleted custom component ${row.code}`,
  })
  revalidatePath('/settings/components')
  return { ok: true }
}

export async function toggleCustomComponentAction(
  formData: FormData,
): Promise<{ ok?: true; error?: string }> {
  const session = await verifySession()
  await requireRole('admin', 'hr', 'payroll')
  const id = Number(formData.get('id') ?? 0)
  if (!id) return { error: 'Missing id' }

  const admin = createAdminClient()
  const { data: row } = await admin
    .from('pay_components')
    .select('is_active, code, is_custom')
    .eq('id', id)
    .maybeSingle()
  if (!row) return { error: 'Not found' }
  if (!row.is_custom) return { error: 'System components cannot be toggled here.' }

  const next = !row.is_active
  await admin.from('pay_components').update({ is_active: next, updated_by: session.userId }).eq('id', id)
  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: next ? 'pay_component.activate' : 'pay_component.deactivate',
    entity_type: 'pay_component',
    entity_id: String(id),
    summary: `${next ? 'Activated' : 'Deactivated'} ${row.code}`,
  })
  revalidatePath('/settings/components')
  return { ok: true }
}
