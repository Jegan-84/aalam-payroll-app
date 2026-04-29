'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifySession } from '@/lib/auth/dal'
import {
  AdjustmentSchema,
  EmployeeComponentSchema,
  type ComponentFormErrors,
  type ComponentFormState,
} from '@/lib/components/schemas'

// -----------------------------------------------------------------------------
// Recurring employee components
// -----------------------------------------------------------------------------

export async function saveEmployeeComponentAction(
  id: string | null,
  _prev: ComponentFormState,
  formData: FormData,
): Promise<ComponentFormState> {
  const session = await verifySession()
  const parsed = EmployeeComponentSchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as ComponentFormErrors }
  }
  const admin = createAdminClient()
  const payload = {
    ...parsed.data,
    code: parsed.data.code.toUpperCase(),
    effective_to: parsed.data.effective_to ?? null,
    notes: parsed.data.notes ?? null,
    updated_by: session.userId,
  }

  if (id) {
    const { error } = await admin.from('employee_pay_components').update(payload).eq('id', id)
    if (error) return { errors: { _form: [error.message] } }
  } else {
    const { data, error } = await admin
      .from('employee_pay_components')
      .insert({ ...payload, created_by: session.userId })
      .select('id')
      .single()
    if (error) return { errors: { _form: [error.message] } }
    id = data.id
  }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: id ? 'employee_component.update' : 'employee_component.create',
    entity_type: 'employee_pay_component',
    entity_id: id,
    summary: `Saved ${payload.kind} ${payload.code} for employee`,
  })

  revalidatePath(`/employees/${parsed.data.employee_id}`)
  revalidatePath(`/employees/${parsed.data.employee_id}/components`)
  return { ok: true, id: id ?? undefined }
}

export async function deleteEmployeeComponentAction(formData: FormData): Promise<void> {
  const session = await verifySession()
  const id = String(formData.get('id') ?? '')
  const employeeId = String(formData.get('employee_id') ?? '')
  if (!id) return
  const admin = createAdminClient()
  await admin.from('employee_pay_components').update({ is_active: false }).eq('id', id)
  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'employee_component.deactivate',
    entity_type: 'employee_pay_component',
    entity_id: id,
    summary: 'Deactivated recurring pay component',
  })
  revalidatePath(`/employees/${employeeId}/components`)
  redirect(`/employees/${employeeId}/components`)
}

// -----------------------------------------------------------------------------
// Per-cycle adjustments
// -----------------------------------------------------------------------------

export async function saveAdjustmentAction(formData: FormData): Promise<{ ok?: true; error?: string }> {
  const session = await verifySession()
  const parsed = AdjustmentSchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }
  const input = parsed.data
  const admin = createAdminClient()

  // Block edits when the cycle is already approved/locked.
  const { data: cycle } = await admin.from('payroll_cycles').select('status').eq('id', input.cycle_id).maybeSingle()
  if (!cycle) return { error: 'Cycle not found' }
  if (['approved', 'locked', 'paid'].includes(cycle.status as string)) {
    return { error: `Cycle is ${cycle.status}; reopen before editing adjustments.` }
  }

  // Statutory + system-derived components are off-limits to manual edits:
  //   • BASIC/HRA/CONV/OTHERALLOW/MEDINS — derived from the salary structure
  //   • PF_EE — capped at ₹1,800 by statutory rule
  //   • LOAN_<id> — engine writes min(emi, outstanding) and posts a ledger row
  //     on approve. Override would desync the loan ledger.
  //   • PERQ_<id> — notional perquisite from concessional-rate spread; not paid
  //     out, only used for TDS. Edit makes no sense.
  // ESI_EE and GRATUITY remain editable.
  const codeUpper = input.code.toUpperCase()
  const STATUTORY_LOCKED = new Set(['BASIC', 'HRA', 'CONV', 'OTHERALLOW', 'MEDINS', 'PF_EE'])
  if (
    STATUTORY_LOCKED.has(codeUpper) ||
    codeUpper.startsWith('LOAN_') ||
    codeUpper.startsWith('PERQ_')
  ) {
    return {
      error: `${codeUpper} is a system-derived component and can't be overridden, skipped, or duplicated. ESI and Gratuity remain editable.`,
    }
  }

  const { error } = await admin
    .from('payroll_item_adjustments')
    .upsert(
      {
        ...input,
        code: input.code.toUpperCase(),
        notes: input.notes ?? null,
        created_by: session.userId,
      },
      { onConflict: 'cycle_id,employee_id,code,action' },
    )
  if (error) return { error: error.message }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'payroll.adjustment.save',
    entity_type: 'payroll_item_adjustment',
    entity_id: `${input.cycle_id}:${input.employee_id}:${input.code}`,
    summary: `${input.action} ${input.kind} ${input.code} ${input.amount > 0 ? '₹' + input.amount : ''}`,
  })

  revalidatePath(`/payroll/${input.cycle_id}`)
  revalidatePath(`/payroll/${input.cycle_id}/${input.employee_id}`)
  return { ok: true }
}

export async function deleteAdjustmentAction(formData: FormData): Promise<{ ok?: true; error?: string }> {
  const session = await verifySession()
  const id = String(formData.get('id') ?? '')
  const cycleId = String(formData.get('cycle_id') ?? '')
  const employeeId = String(formData.get('employee_id') ?? '')
  if (!id) return { error: 'Missing id' }

  const admin = createAdminClient()
  const { data: cycle } = await admin.from('payroll_cycles').select('status').eq('id', cycleId).maybeSingle()
  if (cycle && ['approved', 'locked', 'paid'].includes(cycle.status as string)) {
    return { error: `Cycle is ${cycle.status}; reopen before editing adjustments.` }
  }

  const { error } = await admin.from('payroll_item_adjustments').delete().eq('id', id)
  if (error) return { error: error.message }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'payroll.adjustment.delete',
    entity_id: id,
    summary: 'Deleted payroll adjustment',
  })

  revalidatePath(`/payroll/${cycleId}`)
  revalidatePath(`/payroll/${cycleId}/${employeeId}`)
  return { ok: true }
}
