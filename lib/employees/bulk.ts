'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifySession } from '@/lib/auth/dal'

export type EmployeeBulkRow = {
  employee_code: string
  work_email?: string
  first_name: string
  middle_name?: string
  last_name: string
  gender?: string
  date_of_birth?: string
  personal_email?: string
  personal_phone?: string
  pan_number?: string
  aadhaar_number?: string
  uan_number?: string
  esi_number?: string
  department_code?: string
  designation_code?: string
  location_code?: string
  company_code?: string
  employment_type?: string
  date_of_joining: string
  employment_status?: string
  bank_name?: string
  bank_account_number?: string
  bank_ifsc?: string
  bank_account_type?: string
  tax_regime_code?: 'NEW' | 'OLD' | string
  lunch_applicable?: boolean | string
  shift_applicable?: boolean | string
  shift_allowance_monthly?: number | string
}

export type BulkResult = {
  created: number
  skipped: Array<{ row: number; code: string; reason: string }>
}

function emptyToNull<T>(v: T): T | null {
  if (v === undefined || v === null) return null
  if (typeof v === 'string' && v.trim() === '') return null
  return v
}

function parseBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase()
    return s === 'true' || s === 'yes' || s === 'y' || s === '1'
  }
  return false
}

export async function bulkCreateEmployeesAction(
  rows: EmployeeBulkRow[],
): Promise<BulkResult> {
  const session = await verifySession()
  const admin = createAdminClient()

  // Load master lookups
  const [depts, desigs, locs, companies] = await Promise.all([
    admin.from('departments').select('id, code'),
    admin.from('designations').select('id, code'),
    admin.from('locations').select('id, code'),
    admin.from('companies').select('id, code'),
  ])

  const deptByCode = new Map((depts.data ?? []).map((r) => [String(r.code).toUpperCase(), r.id as number]))
  const desigByCode = new Map((desigs.data ?? []).map((r) => [String(r.code).toUpperCase(), r.id as number]))
  const locByCode = new Map((locs.data ?? []).map((r) => [String(r.code).toUpperCase(), r.id as number]))
  const companyByCode = new Map((companies.data ?? []).map((r) => [String(r.code).toUpperCase(), r.id as string]))

  const result: BulkResult = { created: 0, skipped: [] }

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    if (!r.employee_code || !r.first_name || !r.last_name || !r.date_of_joining) {
      result.skipped.push({
        row: i + 1,
        code: r.employee_code || '(no code)',
        reason: 'Missing required field (code/first/last/DoJ).',
      })
      continue
    }

    const departmentId   = r.department_code  ? deptByCode.get(r.department_code.toUpperCase())   ?? null : null
    const designationId  = r.designation_code ? desigByCode.get(r.designation_code.toUpperCase()) ?? null : null
    const locationId     = r.location_code    ? locByCode.get(r.location_code.toUpperCase())      ?? null : null
    const companyId      = r.company_code     ? companyByCode.get(r.company_code.toUpperCase())   ?? null : null

    if (r.company_code && !companyId) {
      result.skipped.push({ row: i + 1, code: r.employee_code, reason: `Unknown company_code "${r.company_code}"` })
      continue
    }
    if (r.department_code && !departmentId) {
      result.skipped.push({ row: i + 1, code: r.employee_code, reason: `Unknown department_code "${r.department_code}"` })
      continue
    }
    if (r.designation_code && !designationId) {
      result.skipped.push({ row: i + 1, code: r.employee_code, reason: `Unknown designation_code "${r.designation_code}"` })
      continue
    }

    const payload: Record<string, unknown> = {
      employee_code: r.employee_code.trim(),
      work_email: r.work_email && r.work_email.trim() !== '' ? r.work_email.trim().toLowerCase() : null,
      first_name: r.first_name.trim(),
      middle_name: emptyToNull(r.middle_name),
      last_name: r.last_name.trim(),
      gender: emptyToNull(r.gender),
      date_of_birth: emptyToNull(r.date_of_birth),
      personal_email: emptyToNull(r.personal_email),
      personal_phone: emptyToNull(r.personal_phone),
      pan_number: emptyToNull(r.pan_number),
      aadhaar_number: emptyToNull(r.aadhaar_number),
      uan_number: emptyToNull(r.uan_number),
      esi_number: emptyToNull(r.esi_number),
      department_id: departmentId,
      designation_id: designationId,
      location_id: locationId,
      company_id: companyId,
      employment_type: r.employment_type ?? 'full_time',
      date_of_joining: r.date_of_joining,
      employment_status: r.employment_status ?? 'active',
      bank_name: emptyToNull(r.bank_name),
      bank_account_number: emptyToNull(r.bank_account_number),
      bank_ifsc: emptyToNull(r.bank_ifsc),
      bank_account_type: emptyToNull(r.bank_account_type),
      tax_regime_code: r.tax_regime_code === 'OLD' ? 'OLD' : 'NEW',
      lunch_applicable: parseBool(r.lunch_applicable),
      shift_applicable: parseBool(r.shift_applicable),
      shift_allowance_monthly: (() => {
        const v = r.shift_allowance_monthly
        if (v == null || v === '') return 5000
        const n = Number(v)
        return Number.isFinite(n) && n >= 0 ? n : 5000
      })(),
      created_by: session.userId,
      updated_by: session.userId,
    }

    const { error } = await admin.from('employees').insert(payload)
    if (error) {
      result.skipped.push({ row: i + 1, code: r.employee_code, reason: error.message })
      continue
    }
    result.created += 1
  }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'employee.bulk_create',
    entity_type: 'employee',
    summary: `Bulk created ${result.created} employee(s); ${result.skipped.length} skipped`,
    after_state: { skipped: result.skipped },
  })

  revalidatePath('/employees')
  return result
}
