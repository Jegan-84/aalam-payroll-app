'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { verifySession, requireRole, getCurrentEmployee } from '@/lib/auth/dal'

// -----------------------------------------------------------------------------
// Types + queries
// -----------------------------------------------------------------------------
export type PriorEarnings = {
  id: string
  employee_id: string
  fy_start: string
  gross_salary: number
  basic: number | null
  hra: number | null
  conveyance: number | null
  perquisites: number | null
  pf_deducted: number
  professional_tax_deducted: number
  tds_deducted: number
  prev_employer_name: string | null
  prev_employer_pan: string | null
  prev_employer_tan: string | null
  prev_regime: 'OLD' | 'NEW' | null
  declared_at: string
  verified_at: string | null
  verified_by: string | null
  notes: string | null
}

export async function getPriorEarnings(
  employeeId: string,
  fyStart: string,
): Promise<PriorEarnings | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('employee_prior_earnings')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('fy_start', fyStart)
    .maybeSingle()
  return (data as unknown as PriorEarnings) ?? null
}

// -----------------------------------------------------------------------------
// Schema
// -----------------------------------------------------------------------------
const num = (max = 1_00_00_000) =>
  z.preprocess(
    (v) => (v === '' || v == null ? 0 : v),
    z.coerce.number().min(0).max(max),
  )

const optNum = () =>
  z.preprocess(
    (v) => (v === '' || v == null ? null : v),
    z.coerce.number().min(0).max(1_00_00_000).nullable(),
  )

const optStr = () =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
    z.string().trim().max(200).nullable(),
  )

const PriorEarningsSchema = z.object({
  fy_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  gross_salary: num(),
  basic: optNum(),
  hra: optNum(),
  conveyance: optNum(),
  perquisites: optNum(),
  pf_deducted: num(50_00_000),
  professional_tax_deducted: num(50_000),
  tds_deducted: num(50_00_000),
  prev_employer_name: optStr(),
  prev_employer_pan: optStr(),
  prev_employer_tan: optStr(),
  prev_regime: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
    z.enum(['OLD', 'NEW']).nullable(),
  ),
  notes: optStr(),
})

// -----------------------------------------------------------------------------
// savePriorEarningsAction — employee or HR can save / update.
// Once verified, locks unless HR un-verifies first.
// -----------------------------------------------------------------------------
export async function savePriorEarningsAction(
  formData: FormData,
): Promise<{ ok?: true; error?: string }> {
  const session = await verifySession()
  const isAdmin = await isAdminish()
  const parsed = PriorEarningsSchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ') }
  }
  const input = parsed.data

  // Resolve target employee — for ESS this must be self; for admin/HR can be anyone.
  let employeeId: string
  const explicitEmpId = String(formData.get('employee_id') ?? '').trim()
  if (isAdmin && explicitEmpId) {
    employeeId = explicitEmpId
  } else {
    const me = await getCurrentEmployee()
    employeeId = me.employeeId
  }

  const admin = createAdminClient()

  // Editing-after-verified guard for non-admin callers.
  const { data: existing } = await admin
    .from('employee_prior_earnings')
    .select('verified_at')
    .eq('employee_id', employeeId)
    .eq('fy_start', input.fy_start)
    .maybeSingle()
  if (existing?.verified_at && !isAdmin) {
    return { error: 'This 12B is already verified by HR. Ask HR to unlock before editing.' }
  }

  const row = {
    employee_id: employeeId,
    fy_start: input.fy_start,
    gross_salary: input.gross_salary,
    basic: input.basic,
    hra: input.hra,
    conveyance: input.conveyance,
    perquisites: input.perquisites,
    pf_deducted: input.pf_deducted,
    professional_tax_deducted: input.professional_tax_deducted,
    tds_deducted: input.tds_deducted,
    prev_employer_name: input.prev_employer_name,
    prev_employer_pan: input.prev_employer_pan,
    prev_employer_tan: input.prev_employer_tan,
    prev_regime: input.prev_regime,
    notes: input.notes,
    updated_at: new Date().toISOString(),
  }

  const { error } = await admin
    .from('employee_prior_earnings')
    .upsert(row, { onConflict: 'employee_id,fy_start' })
  if (error) return { error: error.message }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: existing ? 'prior_earnings.update' : 'prior_earnings.create',
    entity_type: 'employee_prior_earnings',
    entity_id: `${employeeId}:${input.fy_start}`,
    summary: `${existing ? 'Updated' : 'Saved'} 12B for ${employeeId}, FY ${input.fy_start}: gross ₹${input.gross_salary}, TDS ₹${input.tds_deducted}`,
  })

  revalidatePath(`/me/declaration`)
  revalidatePath(`/employees/${employeeId}/declaration`)
  return { ok: true }
}

// -----------------------------------------------------------------------------
// HR verify / unverify
// -----------------------------------------------------------------------------
export async function setVerificationAction(
  formData: FormData,
): Promise<{ ok?: true; error?: string }> {
  const session = await requireRole('admin', 'hr', 'payroll')
  const employeeId = String(formData.get('employee_id') ?? '')
  const fyStart = String(formData.get('fy_start') ?? '')
  const verified = formData.get('verified') === 'on' || formData.get('verified') === 'true'
  if (!employeeId || !/^\d{4}-\d{2}-\d{2}$/.test(fyStart)) {
    return { error: 'Missing employee_id or fy_start' }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('employee_prior_earnings')
    .update({
      verified_at: verified ? new Date().toISOString() : null,
      verified_by: verified ? session.userId : null,
      updated_at: new Date().toISOString(),
    })
    .eq('employee_id', employeeId)
    .eq('fy_start', fyStart)
  if (error) return { error: error.message }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: verified ? 'prior_earnings.verify' : 'prior_earnings.unverify',
    entity_type: 'employee_prior_earnings',
    entity_id: `${employeeId}:${fyStart}`,
    summary: `${verified ? 'Verified' : 'Unverified'} 12B for ${employeeId}, FY ${fyStart}`,
  })

  revalidatePath(`/me/declaration`)
  revalidatePath(`/employees/${employeeId}/declaration`)
  return { ok: true }
}

// -----------------------------------------------------------------------------
// HR clear (delete) — for "no prior employment this FY" cases that were entered by mistake
// -----------------------------------------------------------------------------
export async function clearPriorEarningsAction(
  formData: FormData,
): Promise<{ ok?: true; error?: string }> {
  const session = await requireRole('admin', 'hr', 'payroll')
  const employeeId = String(formData.get('employee_id') ?? '')
  const fyStart = String(formData.get('fy_start') ?? '')
  if (!employeeId || !/^\d{4}-\d{2}-\d{2}$/.test(fyStart)) {
    return { error: 'Missing employee_id or fy_start' }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('employee_prior_earnings')
    .delete()
    .eq('employee_id', employeeId)
    .eq('fy_start', fyStart)
  if (error) return { error: error.message }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'prior_earnings.clear',
    entity_type: 'employee_prior_earnings',
    entity_id: `${employeeId}:${fyStart}`,
    summary: `Cleared 12B for ${employeeId}, FY ${fyStart}`,
  })

  revalidatePath(`/me/declaration`)
  revalidatePath(`/employees/${employeeId}/declaration`)
  return { ok: true }
}

// -----------------------------------------------------------------------------
async function isAdminish(): Promise<boolean> {
  const { getUserWithRoles } = await import('@/lib/auth/dal')
  const me = await getUserWithRoles()
  return me.roles.some((r) => r === 'admin' || r === 'hr' || r === 'payroll')
}
