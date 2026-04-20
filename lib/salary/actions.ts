'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifySession } from '@/lib/auth/dal'
import { getOrgPtState, getPtSlabs, getStatutoryConfig } from '@/lib/salary/queries'
import { computeSalaryStructure } from '@/lib/payroll/engine'
import { SalaryStructureSchema, type SalaryFormErrors, type SalaryFormState } from '@/lib/salary/schemas'

type PayComponentRow = { id: number; code: string; name: string; kind: string; display_order: number }

export async function createSalaryStructureAction(
  _prev: SalaryFormState,
  formData: FormData,
): Promise<SalaryFormState> {
  const session = await verifySession()
  const parsed = SalaryStructureSchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as SalaryFormErrors }
  }

  const input = parsed.data
  const admin = createAdminClient()

  const [statutory, ptState, payComps] = await Promise.all([
    getStatutoryConfig(),
    getOrgPtState(),
    admin.from('pay_components').select('id, code, name, kind, display_order').eq('is_active', true),
  ])
  if (payComps.error) return { errors: { _form: [payComps.error.message] } }
  const ptSlabs = await getPtSlabs(ptState)

  const result = computeSalaryStructure({
    annualFixedCtc: input.annual_fixed_ctc,
    variablePayPercent: input.variable_pay_percent,
    medicalInsuranceMonthly: input.medical_insurance_monthly,
    internetAnnual: input.internet_annual,
    trainingAnnual: input.training_annual,
    epfMode: input.epf_mode,
    ptState,
    statutory,
    ptSlabs,
  })

  // 1. Supersede any existing active/current structure for this employee
  const { error: supersedeErr } = await admin
    .from('salary_structures')
    .update({ effective_to: isoPrevDay(input.effective_from), status: 'superseded' })
    .eq('employee_id', input.employee_id)
    .is('effective_to', null)
    .eq('status', 'active')
  if (supersedeErr) return { errors: { _form: [supersedeErr.message] } }

  // 2. Insert the new structure
  const { data: inserted, error: insertErr } = await admin
    .from('salary_structures')
    .insert({
      employee_id: input.employee_id,
      effective_from: input.effective_from,
      annual_fixed_ctc: input.annual_fixed_ctc,
      variable_pay_percent: input.variable_pay_percent,
      medical_insurance_monthly: input.medical_insurance_monthly,
      internet_annual: input.internet_annual,
      training_annual: input.training_annual,
      epf_mode: input.epf_mode,
      template_id: input.template_id ?? null,
      annual_gross: result.annualGross,
      annual_variable_pay: result.annualVariablePay,
      annual_total_ctc: result.annualTotalCtc,
      monthly_gross: result.monthlyGross,
      monthly_take_home: result.monthlyTakeHome,
      notes: input.notes ?? null,
      created_by: session.userId,
    })
    .select('id')
    .single()
  if (insertErr) return { errors: { _form: [insertErr.message] } }

  // 3. Insert component snapshot rows
  const compsByCode = new Map<string, PayComponentRow>()
  for (const c of payComps.data ?? []) compsByCode.set(c.code, c as PayComponentRow)

  const componentRows = result.components
    .map((c) => {
      const master = compsByCode.get(c.code)
      if (!master) return null
      return {
        structure_id: inserted.id,
        pay_component_id: master.id,
        component_code: c.code,
        component_name: c.name,
        kind: c.kind,
        monthly_amount: c.monthly,
        annual_amount: c.annual,
        display_order: c.displayOrder,
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)

  if (componentRows.length > 0) {
    const { error: compErr } = await admin.from('salary_structure_components').insert(componentRows)
    if (compErr) return { errors: { _form: [compErr.message] } }
  }

  // 3b. Update the employee's chosen tax regime — consumed by the payroll engine.
  if (input.tax_regime_code) {
    await admin
      .from('employees')
      .update({ tax_regime_code: input.tax_regime_code, updated_by: session.userId })
      .eq('id', input.employee_id)
  }

  // 4. Audit
  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'salary_structure.create',
    entity_type: 'salary_structure',
    entity_id: inserted.id,
    summary: `New salary structure (CTC ${input.annual_fixed_ctc.toFixed(0)}) from ${input.effective_from}`,
    after_state: { ...input, computed: result },
  })

  revalidatePath('/salary')
  revalidatePath(`/employees/${input.employee_id}/salary`)
  return { ok: true, id: inserted.id }
}

function isoPrevDay(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}
