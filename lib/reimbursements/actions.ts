'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifySession, getUserWithRoles, getCurrentEmployee } from '@/lib/auth/dal'
import { createNotification, notifyByRoles } from '@/lib/notifications/service'

const BUCKET = 'reimbursement-receipts'
const MAX_BYTES = 10 * 1024 * 1024
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
])
const VALID_CATEGORIES = new Set([
  'fuel', 'medical', 'internet', 'telephone', 'travel', 'books', 'meals', 'other',
])

function safeName(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120)
}

// -----------------------------------------------------------------------------
// submit — employee uploads receipt + files claim
// -----------------------------------------------------------------------------
export async function submitReimbursementAction(
  formData: FormData,
): Promise<{ ok?: true; error?: string; id?: string }> {
  const session = await verifySession()
  const { employeeId } = await getCurrentEmployee()

  const category = String(formData.get('category') ?? '').toLowerCase()
  const subCategory = String(formData.get('sub_category') ?? '').trim() || null
  const claimDate = String(formData.get('claim_date') ?? '')
  const amount = Number(formData.get('amount') ?? 0)
  const fileRaw = formData.get('file')

  if (!VALID_CATEGORIES.has(category)) return { error: 'Invalid category' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(claimDate)) return { error: 'Invalid claim date' }
  if (!(amount > 0)) return { error: 'Amount must be greater than zero' }
  if (!(fileRaw instanceof File)) return { error: 'Attach a receipt.' }
  if (fileRaw.size === 0) return { error: 'Empty file.' }
  if (fileRaw.size > MAX_BYTES) return { error: 'Receipt too large (max 10 MB).' }
  if (!ALLOWED_MIME.has(fileRaw.type)) return { error: 'Only PDF / JPG / PNG / WEBP allowed.' }

  const admin = createAdminClient()

  const fileName = safeName(fileRaw.name)
  const storagePath = `${employeeId}/${claimDate.slice(0, 7)}/${Date.now()}-${fileName}`
  const buffer = Buffer.from(await fileRaw.arrayBuffer())
  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: fileRaw.type, upsert: false })
  if (upErr) return { error: `Upload failed: ${upErr.message}` }

  const { data, error } = await admin
    .from('reimbursement_claims')
    .insert({
      employee_id: employeeId,
      category,
      sub_category: subCategory,
      claim_date: claimDate,
      amount,
      file_path: storagePath,
      file_name: fileName,
      file_size_bytes: fileRaw.size,
      mime_type: fileRaw.type,
      status: 'pending',
      submitted_by: session.userId,
    })
    .select('id')
    .single()
  if (error) {
    await admin.storage.from(BUCKET).remove([storagePath])
    return { error: error.message }
  }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'reimbursement.submit',
    entity_type: 'reimbursement_claim',
    entity_id: data.id,
    summary: `Submitted ${category} reimbursement — ₹${amount}`,
  })

  await notifyByRoles(['admin', 'hr', 'payroll'], {
    kind: 'reimbursement.submitted',
    title: `Reimbursement — ${category} ₹${amount}`,
    body: `${subCategory ?? 'No description'}. Click to review.`,
    href: '/reimbursements',
    severity: 'info',
  })

  revalidatePath('/me/reimbursements')
  revalidatePath('/reimbursements')
  return { ok: true, id: data.id as string }
}

// -----------------------------------------------------------------------------
// delete — employee removes own pending; HR can delete any non-paid
// -----------------------------------------------------------------------------
export async function deleteReimbursementAction(formData: FormData): Promise<{ ok?: true; error?: string }> {
  const session = await verifySession()
  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'Missing id' }

  const me = await getUserWithRoles()
  const isAdminish = me.roles.some((r) => r === 'admin' || r === 'hr' || r === 'payroll')

  const admin = createAdminClient()
  const { data: claim } = await admin.from('reimbursement_claims').select('*').eq('id', id).maybeSingle()
  if (!claim) return { error: 'Not found' }
  if (claim.status === 'paid') return { error: 'Paid claims cannot be deleted.' }

  if (!isAdminish) {
    const { employeeId } = await getCurrentEmployee()
    if (claim.employee_id !== employeeId) return { error: 'Not your claim.' }
    if (claim.status !== 'pending') return { error: 'Only pending claims can be deleted.' }
  }

  await admin.storage.from(BUCKET).remove([claim.file_path as string])
  const { error } = await admin.from('reimbursement_claims').delete().eq('id', id)
  if (error) return { error: error.message }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'reimbursement.delete',
    entity_type: 'reimbursement_claim',
    entity_id: id,
    summary: `Deleted ${claim.category} reimbursement (${claim.status})`,
  })

  revalidatePath('/me/reimbursements')
  revalidatePath('/reimbursements')
  return { ok: true }
}

// -----------------------------------------------------------------------------
// approve / reject
// -----------------------------------------------------------------------------
export async function approveReimbursementAction(formData: FormData): Promise<{ ok?: true; error?: string }> {
  return reviewReimbursement(formData, 'approved')
}
export async function rejectReimbursementAction(formData: FormData): Promise<{ ok?: true; error?: string }> {
  return reviewReimbursement(formData, 'rejected')
}

async function reviewReimbursement(
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
  const { data: claim } = await admin.from('reimbursement_claims').select('*').eq('id', id).maybeSingle()
  if (!claim) return { error: 'Not found' }
  if (claim.status !== 'pending') return { error: `Claim is ${claim.status}; can only review 'pending'.` }

  const { error } = await admin
    .from('reimbursement_claims')
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
    action: `reimbursement.${nextStatus}`,
    entity_type: 'reimbursement_claim',
    entity_id: id,
    summary: `${nextStatus === 'approved' ? 'Approved' : 'Rejected'} ${claim.category} ₹${claim.amount}${notes ? `: ${notes}` : ''}`,
  })

  await createNotification({
    employeeId: claim.employee_id as string,
    kind: nextStatus === 'approved' ? 'reimbursement.approved' : 'reimbursement.rejected',
    title: nextStatus === 'approved'
      ? `Reimbursement approved — ₹${claim.amount}`
      : `Reimbursement rejected — ${claim.category}`,
    body: nextStatus === 'approved'
      ? 'It will be paid in your next payroll cycle.'
      : (notes ?? 'Your reimbursement request was rejected.'),
    href: '/me/reimbursements',
    severity: nextStatus === 'approved' ? 'success' : 'warn',
  })

  revalidatePath('/me/reimbursements')
  revalidatePath('/reimbursements')
  return { ok: true }
}
