'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  verifySession,
  getCurrentEmployee,
  getUserWithRoles,
} from '@/lib/auth/dal'
import {
  STORAGE_BUCKET,
  MAX_FILE_BYTES,
  DOC_TYPES,
  type DocType,
  type EmployeeDocumentRow,
  type SelfProfileErrors,
  type SelfProfileState,
} from '@/lib/employees/self-service-constants'

const PDF_MIME = 'application/pdf'
const PHOTO_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp'])

// -----------------------------------------------------------------------------
// Schemas
// -----------------------------------------------------------------------------
const EMPTY = (v: unknown) =>
  typeof v === 'string' && v.trim() === '' ? undefined : v
const opt = () => z.preprocess(EMPTY, z.string().trim().optional())
const optDate = () =>
  z.preprocess(
    EMPTY,
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').optional(),
  )

/**
 * What an employee is allowed to update on their own row. Excludes:
 *  - employee_code, work_email, user_id            (system identity)
 *  - employment_*, date_of_*, department/etc       (HR controls)
 *  - tax_regime_code                               (per product rule)
 *  - lunch_applicable, shift_*                     (compensation, HR controls)
 */
const SelfProfileSchema = z
  .object({
    first_name:  z.string().trim().min(1, 'First name is required.'),
    middle_name: opt(),
    last_name:   z.string().trim().min(1, 'Last name is required.'),
    date_of_birth: optDate(),
    gender: z.preprocess(EMPTY, z.enum(['M', 'F', 'O']).optional()),
    marital_status: z.preprocess(
      EMPTY,
      z.enum(['single', 'married', 'divorced', 'widowed']).optional(),
    ),
    blood_group: opt(),
    personal_email: z.preprocess(
      EMPTY,
      z.string().email('Invalid email').optional(),
    ),
    personal_phone: opt(),
    emergency_contact_name: opt(),
    emergency_contact_relation: opt(),
    emergency_contact_phone: opt(),

    current_address_line1:   opt(),
    current_address_line2:   opt(),
    current_address_city:    opt(),
    current_address_state:   opt(),
    current_address_pincode: opt(),
    current_address_country: opt(),

    permanent_same_as_current: z.preprocess(
      (v) => v === 'on' || v === 'true' || v === true,
      z.boolean(),
    ),
    permanent_address_line1:   opt(),
    permanent_address_line2:   opt(),
    permanent_address_city:    opt(),
    permanent_address_state:   opt(),
    permanent_address_pincode: opt(),
    permanent_address_country: opt(),

    pan_number: z.preprocess(
      EMPTY,
      z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'PAN must look like ABCDE1234F').optional(),
    ),
    aadhaar_number: z.preprocess(
      EMPTY,
      z.string().regex(/^\d{12}$/, 'Aadhaar must be 12 digits').optional(),
    ),
    uan_number:      opt(),
    esi_number:      opt(),
    passport_number: opt(),

    bank_name:                opt(),
    bank_account_number:      opt(),
    bank_ifsc: z.preprocess(
      EMPTY,
      z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'IFSC must look like HDFC0ABCDEF').optional(),
    ),
    bank_account_type: z.preprocess(EMPTY, z.enum(['savings', 'current']).optional()),
    bank_account_holder_name: opt(),
  })


// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
function parseFormData(formData: FormData): Record<string, unknown> {
  const raw: Record<string, unknown> = {}
  for (const [key, value] of formData.entries()) raw[key] = value
  return raw
}

async function requireSelfEditEnabled(employeeId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('employees')
    .select('profile_edit_enabled')
    .eq('id', employeeId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('Employee not found.')
  if (!data.profile_edit_enabled) {
    throw new Error('Profile editing is currently locked. Ask HR to enable it.')
  }
}

async function requireHrOrAdmin() {
  const me = await getUserWithRoles()
  const ok = me.roles.some((r) => r === 'admin' || r === 'hr')
  if (!ok) throw new Error('Only HR or Admin can do this.')
  return me
}

function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'file'
}

// -----------------------------------------------------------------------------
// updateMyProfileAction — employee edits their own row
// -----------------------------------------------------------------------------
export async function updateMyProfileAction(
  _prev: SelfProfileState,
  formData: FormData,
): Promise<SelfProfileState> {
  const { employeeId, userId } = await getCurrentEmployee()
  try {
    await requireSelfEditEnabled(employeeId)
  } catch (err) {
    return { errors: { _form: [(err as Error).message] } }
  }

  const parsed = SelfProfileSchema.safeParse(parseFormData(formData))
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as SelfProfileErrors }
  }

  const input = parsed.data
  const row: Record<string, unknown> = { ...input, updated_by: userId }
  if (input.permanent_same_as_current) {
    row.permanent_address_line1   = input.current_address_line1   ?? null
    row.permanent_address_line2   = input.current_address_line2   ?? null
    row.permanent_address_city    = input.current_address_city    ?? null
    row.permanent_address_state   = input.current_address_state   ?? null
    row.permanent_address_pincode = input.current_address_pincode ?? null
    row.permanent_address_country = input.current_address_country ?? null
  }

  const admin = createAdminClient()
  const { error } = await admin.from('employees').update(row).eq('id', employeeId)
  if (error) return { errors: { _form: [error.message] } }

  revalidatePath('/me/profile')
  return { ok: true }
}

// -----------------------------------------------------------------------------
// Photo upload — image only, replaces previous
// -----------------------------------------------------------------------------
async function uploadPhotoForEmployee(
  employeeId: string,
  uploadedBy: string,
  file: File,
): Promise<{ ok: true } | { error: string }> {
  if (!file || file.size === 0) return { error: 'Pick a photo first.' }
  if (file.size > MAX_FILE_BYTES) return { error: 'Photo too large (max 5 MB).' }
  if (!PHOTO_MIMES.has(file.type)) {
    return { error: 'Photo must be JPG, PNG, or WebP.' }
  }

  const admin = createAdminClient()

  const { data: prev } = await admin
    .from('employees')
    .select('photo_storage_path')
    .eq('id', employeeId)
    .maybeSingle()

  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase().slice(0, 5)
  const key = `${employeeId}/photo-${Date.now()}.${ext}`
  const buf = Buffer.from(await file.arrayBuffer())

  const { error: upErr } = await admin
    .storage
    .from(STORAGE_BUCKET)
    .upload(key, buf, { contentType: file.type, upsert: true })
  if (upErr) return { error: upErr.message }

  const { error: dbErr } = await admin
    .from('employees')
    .update({
      photo_storage_path: key,
      photo_uploaded_at: new Date().toISOString(),
      updated_by: uploadedBy,
    })
    .eq('id', employeeId)
  if (dbErr) return { error: dbErr.message }

  if (prev?.photo_storage_path && prev.photo_storage_path !== key) {
    await admin.storage.from(STORAGE_BUCKET).remove([prev.photo_storage_path as string])
  }

  return { ok: true }
}

export async function uploadMyPhotoAction(
  formData: FormData,
): Promise<{ ok: true } | { error: string }> {
  const { employeeId, userId } = await getCurrentEmployee()
  try {
    await requireSelfEditEnabled(employeeId)
  } catch (err) {
    return { error: (err as Error).message }
  }
  const file = formData.get('file')
  if (!(file instanceof File)) return { error: 'Pick a photo first.' }
  const res = await uploadPhotoForEmployee(employeeId, userId, file)
  if ('ok' in res) {
    revalidatePath('/me/profile')
    revalidatePath('/me')
  }
  return res
}

export async function uploadEmployeePhotoAction(
  employeeId: string,
  formData: FormData,
): Promise<{ ok: true } | { error: string }> {
  try {
    await requireHrOrAdmin()
  } catch (err) {
    return { error: (err as Error).message }
  }
  const session = await verifySession()
  const file = formData.get('file')
  if (!(file instanceof File)) return { error: 'Pick a photo first.' }
  const res = await uploadPhotoForEmployee(employeeId, session.userId, file)
  if ('ok' in res) {
    revalidatePath(`/employees/${employeeId}`)
    revalidatePath('/me/profile')
  }
  return res
}

// -----------------------------------------------------------------------------
// Document upload — PDF only
// -----------------------------------------------------------------------------
async function uploadDocumentForEmployee(
  employeeId: string,
  uploadedBy: string,
  docType: string,
  title: string | null,
  file: File,
): Promise<{ ok: true; id: string } | { error: string }> {
  if (!DOC_TYPES.includes(docType as DocType)) return { error: 'Pick a document type.' }
  if (!file || file.size === 0) return { error: 'Pick a file first.' }
  if (file.size > MAX_FILE_BYTES) return { error: 'File too large (max 5 MB).' }
  if (file.type !== PDF_MIME) {
    return { error: 'Only PDF files are accepted for this document.' }
  }

  const admin = createAdminClient()
  const fileName = safeFileName(file.name)
  const key = `${employeeId}/${docType}-${Date.now()}-${fileName}`
  const buf = Buffer.from(await file.arrayBuffer())

  const { error: upErr } = await admin
    .storage
    .from(STORAGE_BUCKET)
    .upload(key, buf, { contentType: file.type, upsert: false })
  if (upErr) return { error: upErr.message }

  const { data, error: dbErr } = await admin
    .from('employee_documents')
    .insert({
      employee_id:  employeeId,
      doc_type:     docType,
      title:        title || null,
      storage_path: key,
      file_name:    fileName,
      mime_type:    file.type,
      size_bytes:   file.size,
      uploaded_by:  uploadedBy,
    })
    .select('id')
    .single()
  if (dbErr) {
    await admin.storage.from(STORAGE_BUCKET).remove([key])
    return { error: dbErr.message }
  }

  return { ok: true, id: data.id as string }
}

export async function uploadMyDocumentAction(
  formData: FormData,
): Promise<{ ok: true; id: string } | { error: string }> {
  const { employeeId, userId } = await getCurrentEmployee()
  try {
    await requireSelfEditEnabled(employeeId)
  } catch (err) {
    return { error: (err as Error).message }
  }
  const docType = String(formData.get('doc_type') ?? '')
  const title = String(formData.get('title') ?? '').trim() || null
  const file = formData.get('file')
  if (!(file instanceof File)) return { error: 'Pick a file first.' }
  const res = await uploadDocumentForEmployee(employeeId, userId, docType, title, file)
  if ('ok' in res) revalidatePath('/me/profile/documents')
  return res
}

export async function uploadEmployeeDocumentAction(
  employeeId: string,
  formData: FormData,
): Promise<{ ok: true; id: string } | { error: string }> {
  try {
    await requireHrOrAdmin()
  } catch (err) {
    return { error: (err as Error).message }
  }
  const session = await verifySession()
  const docType = String(formData.get('doc_type') ?? '')
  const title = String(formData.get('title') ?? '').trim() || null
  const file = formData.get('file')
  if (!(file instanceof File)) return { error: 'Pick a file first.' }
  const res = await uploadDocumentForEmployee(employeeId, session.userId, docType, title, file)
  if ('ok' in res) revalidatePath(`/employees/${employeeId}`)
  return res
}

// -----------------------------------------------------------------------------
// Delete document
// -----------------------------------------------------------------------------
export async function deleteMyDocumentAction(
  formData: FormData,
): Promise<{ ok: true } | { error: string }> {
  const { employeeId } = await getCurrentEmployee()
  try {
    await requireSelfEditEnabled(employeeId)
  } catch (err) {
    return { error: (err as Error).message }
  }

  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'Missing document id.' }

  const admin = createAdminClient()
  const { data: doc } = await admin
    .from('employee_documents')
    .select('id, employee_id, storage_path, verified_at')
    .eq('id', id)
    .maybeSingle()
  if (!doc || doc.employee_id !== employeeId) return { error: 'Document not found.' }
  if (doc.verified_at) {
    return { error: 'This document was verified by HR — only HR can delete it.' }
  }

  await admin.storage.from(STORAGE_BUCKET).remove([doc.storage_path as string])
  const { error } = await admin.from('employee_documents').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/me/profile/documents')
  return { ok: true }
}

export async function deleteEmployeeDocumentAction(
  employeeId: string,
  formData: FormData,
): Promise<{ ok: true } | { error: string }> {
  try {
    await requireHrOrAdmin()
  } catch (err) {
    return { error: (err as Error).message }
  }

  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'Missing document id.' }

  const admin = createAdminClient()
  const { data: doc } = await admin
    .from('employee_documents')
    .select('id, employee_id, storage_path')
    .eq('id', id)
    .maybeSingle()
  if (!doc || doc.employee_id !== employeeId) return { error: 'Document not found.' }

  await admin.storage.from(STORAGE_BUCKET).remove([doc.storage_path as string])
  const { error } = await admin.from('employee_documents').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath(`/employees/${employeeId}`)
  return { ok: true }
}

// -----------------------------------------------------------------------------
// Verify / unverify (HR only)
// -----------------------------------------------------------------------------
export async function setDocumentVerifiedAction(
  employeeId: string,
  formData: FormData,
): Promise<{ ok: true } | { error: string }> {
  try {
    await requireHrOrAdmin()
  } catch (err) {
    return { error: (err as Error).message }
  }
  const session = await verifySession()
  const id = String(formData.get('id') ?? '')
  const verified = formData.get('verified') === 'true'
  if (!id) return { error: 'Missing document id.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('employee_documents')
    .update({
      verified_at: verified ? new Date().toISOString() : null,
      verified_by: verified ? session.userId : null,
    })
    .eq('id', id)
    .eq('employee_id', employeeId)
  if (error) return { error: error.message }

  revalidatePath(`/employees/${employeeId}`)
  return { ok: true }
}

// -----------------------------------------------------------------------------
// Toggle profile edit (HR only)
// -----------------------------------------------------------------------------
export async function setProfileEditEnabledAction(
  employeeId: string,
  formData: FormData,
): Promise<{ ok: true } | { error: string }> {
  try {
    await requireHrOrAdmin()
  } catch (err) {
    return { error: (err as Error).message }
  }
  const session = await verifySession()
  const enabled = formData.get('enabled') === 'true'

  const admin = createAdminClient()
  const { error } = await admin
    .from('employees')
    .update({ profile_edit_enabled: enabled, updated_by: session.userId })
    .eq('id', employeeId)
  if (error) return { error: error.message }

  revalidatePath(`/employees/${employeeId}`)
  return { ok: true }
}

/**
 * Bulk variant — flip profile_edit_enabled on N employees at once.
 * Used by the employees list page checkbox + action bar.
 */
export async function bulkSetProfileEditEnabledAction(
  formData: FormData,
): Promise<{ ok: true; updated: number } | { error: string }> {
  try {
    await requireHrOrAdmin()
  } catch (err) {
    return { error: (err as Error).message }
  }
  const session = await verifySession()
  const enabled = formData.get('enabled') === 'true'
  const idsRaw = String(formData.get('ids') ?? '')
  const ids = idsRaw.split(',').map((s) => s.trim()).filter(Boolean)
  if (ids.length === 0) return { error: 'Pick at least one employee.' }
  if (ids.length > 500) return { error: 'Too many employees in one batch — keep it under 500.' }

  const admin = createAdminClient()
  const { error, count } = await admin
    .from('employees')
    .update({ profile_edit_enabled: enabled, updated_by: session.userId }, { count: 'exact' })
    .in('id', ids)
  if (error) return { error: error.message }

  revalidatePath('/employees')
  return { ok: true, updated: count ?? ids.length }
}

// -----------------------------------------------------------------------------
// Queries — exported as server functions (callable from server components)
// -----------------------------------------------------------------------------
export async function listEmployeeDocuments(
  employeeId: string,
): Promise<EmployeeDocumentRow[]> {
  await verifySession()
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('employee_documents')
    .select('id, doc_type, title, storage_path, file_name, mime_type, size_bytes, uploaded_at, verified_at')
    .eq('employee_id', employeeId)
    .order('uploaded_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as EmployeeDocumentRow[]
}

/**
 * Sign a download URL for a stored doc (or photo). Returns null on failure.
 * Caller is responsible for authorising the request — this just signs the path.
 */
export async function signEmployeeFileUrl(
  storagePath: string,
  expiresInSeconds = 60,
): Promise<string | null> {
  await verifySession()
  const admin = createAdminClient()
  const { data, error } = await admin
    .storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds)
  if (error) return null
  return data?.signedUrl ?? null
}
