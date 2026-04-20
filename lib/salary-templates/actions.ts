'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifySession } from '@/lib/auth/dal'
import {
  SalaryTemplateSchema,
  type TemplateFormErrors,
  type TemplateFormState,
} from '@/lib/salary-templates/schemas'

export async function createTemplateAction(
  _prev: TemplateFormState,
  formData: FormData,
): Promise<TemplateFormState> {
  const session = await verifySession()
  const parsed = SalaryTemplateSchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as TemplateFormErrors }
  }
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('salary_templates')
    .insert({ ...parsed.data, code: parsed.data.code.toUpperCase(), created_by: session.userId, updated_by: session.userId })
    .select('id')
    .single()
  if (error) return { errors: { _form: [error.message] } }

  revalidatePath('/salary/templates')
  return { ok: true, id: data.id }
}

export async function updateTemplateAction(
  id: string,
  _prev: TemplateFormState,
  formData: FormData,
): Promise<TemplateFormState> {
  const session = await verifySession()
  const parsed = SalaryTemplateSchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as TemplateFormErrors }
  }
  const admin = createAdminClient()
  const { error } = await admin
    .from('salary_templates')
    .update({ ...parsed.data, code: parsed.data.code.toUpperCase(), updated_by: session.userId })
    .eq('id', id)
  if (error) return { errors: { _form: [error.message] } }

  revalidatePath('/salary/templates')
  revalidatePath(`/salary/templates/${id}`)
  return { ok: true, id }
}

export async function deleteTemplateAction(formData: FormData): Promise<void> {
  await verifySession()
  const id = String(formData.get('id') ?? '')
  if (!id) return

  const admin = createAdminClient()
  // Soft delete = mark inactive. Hard delete would break lineage on existing salary_structures.
  await admin.from('salary_templates').update({ is_active: false }).eq('id', id)

  revalidatePath('/salary/templates')
  redirect('/salary/templates')
}
