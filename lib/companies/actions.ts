'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/dal'
import { CompanySchema, type CompanyFormErrors, type CompanyFormState } from '@/lib/companies/schemas'

export async function saveCompanyAction(
  _prev: CompanyFormState,
  formData: FormData,
): Promise<CompanyFormState> {
  const session = await requireRole('admin', 'hr')
  const parsed = CompanySchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as CompanyFormErrors }
  }
  const input = parsed.data
  const admin = createAdminClient()
  const row = {
    code: input.code.toUpperCase(),
    legal_name: input.legal_name,
    display_name: input.display_name,
    pan: input.pan ?? null,
    tan: input.tan ?? null,
    gstin: input.gstin ?? null,
    cin: input.cin ?? null,
    epf_establishment_id: input.epf_establishment_id ?? null,
    esi_establishment_id: input.esi_establishment_id ?? null,
    pt_registration_no: input.pt_registration_no ?? null,
    address_line1: input.address_line1 ?? null,
    address_line2: input.address_line2 ?? null,
    city: input.city ?? null,
    state: input.state ?? null,
    pincode: input.pincode ?? null,
    country: input.country ?? 'India',
    logo_url: input.logo_url ?? null,
    is_active: input.is_active,
    display_order: input.display_order,
    updated_by: session.userId,
  }

  let id = input.id
  if (id) {
    const { error } = await admin.from('companies').update(row).eq('id', id)
    if (error) return { errors: { _form: [error.message] } }
  } else {
    const { data, error } = await admin
      .from('companies')
      .insert({ ...row, created_by: session.userId })
      .select('id')
      .single()
    if (error) return { errors: { _form: [error.message] } }
    id = data.id
  }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: input.id ? 'company.update' : 'company.create',
    entity_type: 'company',
    entity_id: id,
    summary: `${input.id ? 'Updated' : 'Created'} company ${row.code} — ${row.legal_name}`,
  })

  revalidatePath('/settings/companies')
  if (id) revalidatePath(`/settings/companies/${id}`)
  return { ok: true, id }
}
