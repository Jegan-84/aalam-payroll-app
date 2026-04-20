'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifySession } from '@/lib/auth/dal'
import { EmployeeSchema, type EmployeeFormErrors, type EmployeeFormState, type EmployeeInput } from '@/lib/employees/schemas'

function parseFormData(formData: FormData): Record<string, unknown> {
  const raw: Record<string, unknown> = {}
  for (const [key, value] of formData.entries()) {
    raw[key] = value
  }
  return raw
}

function inputToRow(input: EmployeeInput, session: { userId: string }, isCreate: boolean) {
  const row: Record<string, unknown> = {
    ...input,
    updated_by: session.userId,
  }
  if (isCreate) row.created_by = session.userId

  if (input.permanent_same_as_current) {
    row.permanent_address_line1   = input.current_address_line1
    row.permanent_address_line2   = input.current_address_line2
    row.permanent_address_city    = input.current_address_city
    row.permanent_address_state   = input.current_address_state
    row.permanent_address_pincode = input.current_address_pincode
    row.permanent_address_country = input.current_address_country
  }

  return row
}

async function writeEmploymentHistory(
  admin: ReturnType<typeof createAdminClient>,
  employeeId: string,
  input: EmployeeInput,
  userId: string,
  reason: string,
) {
  const { error } = await admin.from('employee_employment_history').insert({
    employee_id:     employeeId,
    effective_from:  input.date_of_joining,
    department_id:   input.department_id ?? null,
    designation_id:  input.designation_id ?? null,
    location_id:     input.location_id ?? null,
    reports_to:      input.reports_to ?? null,
    employment_type: input.employment_type,
    change_reason:   reason,
    created_by:      userId,
  })
  if (error) throw new Error(error.message)
}

async function writeAudit(
  admin: ReturnType<typeof createAdminClient>,
  session: { userId: string; email: string },
  payload: {
    action: string
    entity_id: string
    summary: string
    before?: unknown
    after?: unknown
  },
) {
  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email:   session.email,
    action:        payload.action,
    entity_type:   'employee',
    entity_id:     payload.entity_id,
    summary:       payload.summary,
    before_state:  payload.before ?? null,
    after_state:   payload.after ?? null,
  })
}

export async function createEmployeeAction(
  _prev: EmployeeFormState,
  formData: FormData,
): Promise<EmployeeFormState> {
  const session = await verifySession()
  const parsed = EmployeeSchema.safeParse(parseFormData(formData))
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as EmployeeFormErrors }
  }

  const admin = createAdminClient()
  const row = inputToRow(parsed.data, session, true)

  const { data, error } = await admin.from('employees').insert(row).select('id').single()
  if (error) {
    return { errors: { _form: [error.message] } }
  }

  try {
    await writeEmploymentHistory(admin, data.id, parsed.data, session.userId, 'new_hire')
    await writeAudit(admin, session, {
      action: 'employee.create',
      entity_id: data.id,
      summary: `Created employee ${parsed.data.employee_code} (${parsed.data.first_name} ${parsed.data.last_name})`,
      after: row,
    })
  } catch (err) {
    return { errors: { _form: [(err as Error).message] } }
  }

  revalidatePath('/employees')
  return { ok: true, redirectTo: `/employees/${data.id}` }
}

export async function updateEmployeeAction(
  id: string,
  _prev: EmployeeFormState,
  formData: FormData,
): Promise<EmployeeFormState> {
  const session = await verifySession()
  const parsed = EmployeeSchema.safeParse(parseFormData(formData))
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as EmployeeFormErrors }
  }

  const admin = createAdminClient()

  const { data: before } = await admin.from('employees').select('*').eq('id', id).maybeSingle()
  if (!before) return { errors: { _form: ['Employee not found.'] } }

  const row = inputToRow(parsed.data, session, false)
  const { error } = await admin.from('employees').update(row).eq('id', id)
  if (error) return { errors: { _form: [error.message] } }

  const employmentChanged =
    before.department_id   !== (parsed.data.department_id ?? null) ||
    before.designation_id  !== (parsed.data.designation_id ?? null) ||
    before.location_id     !== (parsed.data.location_id ?? null) ||
    before.reports_to      !== (parsed.data.reports_to ?? null) ||
    before.employment_type !== parsed.data.employment_type

  if (employmentChanged) {
    try {
      await writeEmploymentHistory(admin, id, parsed.data, session.userId, 'role_change')
    } catch (err) {
      return { errors: { _form: [(err as Error).message] } }
    }
  }

  await writeAudit(admin, session, {
    action: 'employee.update',
    entity_id: id,
    summary: `Updated employee ${parsed.data.employee_code}`,
    before,
    after: row,
  })

  revalidatePath('/employees')
  revalidatePath(`/employees/${id}`)
  return { ok: true }
}
