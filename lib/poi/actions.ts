'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifySession, getUserWithRoles, getCurrentEmployee } from '@/lib/auth/dal'
import { createNotification } from '@/lib/notifications/service'

const BUCKET = 'poi-documents'
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
])

const VALID_SECTIONS = new Set([
  '80C', '80D', '80CCD1B', '80E', '80G', '80TTA', 'HRA', '24B', 'LTA', 'OTHER',
])

function safeName(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120)
}

// -----------------------------------------------------------------------------
// upload — employee uploads a single file for a given section
// -----------------------------------------------------------------------------
export async function uploadPoiAction(
  formData: FormData,
): Promise<{ ok?: true; error?: string; id?: string }> {
  const session = await verifySession()
  const { employeeId } = await getCurrentEmployee()

  const fyStart = String(formData.get('fy_start') ?? '')
  const section = String(formData.get('section') ?? '').toUpperCase()
  const subCategory = String(formData.get('sub_category') ?? '').trim() || null
  const claimedAmount = Number(formData.get('claimed_amount') ?? 0)
  const fileRaw = formData.get('file')

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fyStart)) return { error: 'Invalid FY start' }
  if (!VALID_SECTIONS.has(section)) return { error: 'Invalid section' }
  if (!(fileRaw instanceof File)) return { error: 'Attach a file.' }
  if (fileRaw.size === 0) return { error: 'Empty file.' }
  if (fileRaw.size > MAX_BYTES) return { error: 'File too large (max 10 MB).' }
  if (!ALLOWED_MIME.has(fileRaw.type)) return { error: 'Only PDF / JPG / PNG / WEBP are allowed.' }
  if (!(claimedAmount >= 0)) return { error: 'Invalid claimed amount' }

  const admin = createAdminClient()

  // Try to stitch to an existing declaration for the same (employee, fy) if one exists.
  const { data: decl } = await admin
    .from('employee_tax_declarations')
    .select('id')
    .eq('employee_id', employeeId)
    .eq('fy_start', fyStart)
    .maybeSingle()

  // Upload to Storage.
  const fileName = safeName(fileRaw.name)
  const storagePath = `${employeeId}/${fyStart}/${Date.now()}-${fileName}`
  const buffer = Buffer.from(await fileRaw.arrayBuffer())
  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: fileRaw.type,
      upsert: false,
    })
  if (upErr) return { error: `Upload failed: ${upErr.message}` }

  const { data, error } = await admin
    .from('poi_documents')
    .insert({
      declaration_id: decl?.id ?? null,
      employee_id: employeeId,
      fy_start: fyStart,
      section,
      sub_category: subCategory,
      claimed_amount: claimedAmount,
      file_path: storagePath,
      file_name: fileName,
      file_size_bytes: fileRaw.size,
      mime_type: fileRaw.type,
      status: 'pending',
      uploaded_by: session.userId,
    })
    .select('id')
    .single()
  if (error) {
    // Best-effort cleanup; we don't want orphan files.
    await admin.storage.from(BUCKET).remove([storagePath])
    return { error: error.message }
  }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'poi.upload',
    entity_type: 'poi_document',
    entity_id: data.id,
    summary: `Uploaded proof for ${section} (₹${claimedAmount})`,
  })

  revalidatePath('/me/declaration')
  revalidatePath('/declarations/poi')
  return { ok: true, id: data.id as string }
}

// -----------------------------------------------------------------------------
// delete — employee removes their own pending proof (HR can delete any)
// -----------------------------------------------------------------------------
export async function deletePoiAction(formData: FormData): Promise<{ ok?: true; error?: string }> {
  const session = await verifySession()
  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'Missing id' }

  const me = await getUserWithRoles()
  const isAdminish = me.roles.some((r) => r === 'admin' || r === 'hr' || r === 'payroll')

  const admin = createAdminClient()
  const { data: poi } = await admin.from('poi_documents').select('*').eq('id', id).maybeSingle()
  if (!poi) return { error: 'Not found' }

  // Gate: admin can delete any; employee only their own, and only while pending.
  if (!isAdminish) {
    const { employeeId } = await getCurrentEmployee()
    if (poi.employee_id !== employeeId) return { error: 'Not your document.' }
    if (poi.status !== 'pending') return { error: 'Only pending documents can be deleted.' }
  }

  await admin.storage.from(BUCKET).remove([poi.file_path as string])
  const { error } = await admin.from('poi_documents').delete().eq('id', id)
  if (error) return { error: error.message }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'poi.delete',
    entity_type: 'poi_document',
    entity_id: id,
    summary: `Deleted POI (${poi.section})`,
  })

  revalidatePath('/me/declaration')
  revalidatePath('/declarations/poi')
  return { ok: true }
}

// -----------------------------------------------------------------------------
// approve / reject — HR only
// -----------------------------------------------------------------------------
export async function approvePoiAction(formData: FormData): Promise<{ ok?: true; error?: string }> {
  return reviewPoi(formData, 'approved')
}

export async function rejectPoiAction(formData: FormData): Promise<{ ok?: true; error?: string }> {
  return reviewPoi(formData, 'rejected')
}

async function reviewPoi(
  formData: FormData,
  nextStatus: 'approved' | 'rejected',
): Promise<{ ok?: true; error?: string }> {
  const session = await verifySession()
  const me = await getUserWithRoles()
  if (!me.roles.some((r) => r === 'admin' || r === 'hr' || r === 'payroll')) {
    return { error: 'Not authorised.' }
  }

  const id = String(formData.get('id') ?? '')
  const notes = String(formData.get('notes') ?? '').trim() || null
  if (!id) return { error: 'Missing id' }

  const admin = createAdminClient()
  const { data: poi } = await admin.from('poi_documents').select('*').eq('id', id).maybeSingle()
  if (!poi) return { error: 'Not found' }

  const { error } = await admin
    .from('poi_documents')
    .update({
      status: nextStatus,
      review_notes: notes,
      reviewed_at: new Date().toISOString(),
      reviewed_by: session.userId,
    })
    .eq('id', id)
  if (error) return { error: error.message }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: `poi.${nextStatus}`,
    entity_type: 'poi_document',
    entity_id: id,
    summary: `${nextStatus === 'approved' ? 'Approved' : 'Rejected'} POI (${poi.section})${notes ? `: ${notes}` : ''}`,
  })

  await createNotification({
    employeeId: poi.employee_id as string,
    kind: nextStatus === 'approved' ? 'poi.approved' : 'poi.rejected',
    title: nextStatus === 'approved' ? `Proof approved — ${poi.section}` : `Proof rejected — ${poi.section}`,
    body: notes ?? undefined,
    href: '/me/declaration',
    severity: nextStatus === 'approved' ? 'success' : 'warn',
  })

  revalidatePath('/declarations/poi')
  revalidatePath('/me/declaration')
  return { ok: true }
}
