'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifySession } from '@/lib/auth/dal'
import { computeQuarterFromMonth } from './challan-queries'
import { resolveFy } from '@/lib/leave/engine'

const BSR_RE = /^\d{7}$/
const CHALLAN_SERIAL_RE = /^\d{3,7}$/

// -----------------------------------------------------------------------------
// create / upsert — record a TDS challan deposit
// -----------------------------------------------------------------------------
export async function saveTdsChallanAction(
  formData: FormData,
): Promise<{ ok?: true; error?: string; id?: string }> {
  const session = await verifySession()
  const id = (formData.get('id') ? String(formData.get('id')) : null) || null
  const year = Number(formData.get('year') ?? 0)
  const month = Number(formData.get('month') ?? 0)
  const bsrCode = String(formData.get('bsr_code') ?? '').trim()
  const challanSerial = String(formData.get('challan_serial_no') ?? '').trim()
  const depositDate = String(formData.get('deposit_date') ?? '')
  const tdsAmount = Number(formData.get('tds_amount') ?? 0)
  const surcharge = Number(formData.get('surcharge') ?? 0)
  const cess = Number(formData.get('cess') ?? 0)
  const interest = Number(formData.get('interest') ?? 0)
  const penalty = Number(formData.get('penalty') ?? 0)
  const notes = String(formData.get('notes') ?? '').trim() || null

  if (!year || !month || month < 1 || month > 12) return { error: 'Invalid year/month' }
  if (!BSR_RE.test(bsrCode)) return { error: 'BSR code must be exactly 7 digits' }
  if (!CHALLAN_SERIAL_RE.test(challanSerial)) return { error: 'Challan serial must be 3–7 digits' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(depositDate)) return { error: 'Invalid deposit date' }
  if (!(tdsAmount >= 0)) return { error: 'Invalid TDS amount' }

  const admin = createAdminClient()
  const quarter = computeQuarterFromMonth(month)
  const fy = resolveFy(new Date(Date.UTC(year, month - 1, 15)), 4)

  const payload = {
    year,
    month,
    fy_start: fy.fyStart,
    quarter,
    bsr_code: bsrCode,
    challan_serial_no: challanSerial,
    deposit_date: depositDate,
    tds_amount: tdsAmount,
    surcharge,
    cess,
    interest,
    penalty,
    section: '192',
    notes,
    updated_by: session.userId,
  }

  if (id) {
    const { error } = await admin.from('tds_challans').update(payload).eq('id', id)
    if (error) return { error: error.message }
  } else {
    const { data, error } = await admin
      .from('tds_challans')
      .insert({ ...payload, created_by: session.userId })
      .select('id')
      .single()
    if (error) return { error: error.message }
    await admin.from('audit_log').insert({
      actor_user_id: session.userId,
      actor_email: session.email,
      action: 'tds.challan.create',
      entity_type: 'tds_challan',
      entity_id: data.id,
      summary: `Recorded TDS challan ${bsrCode}/${challanSerial} for ${year}-${String(month).padStart(2, '0')} (₹${tdsAmount})`,
    })
    revalidatePath('/tds/challans')
    revalidatePath('/tds/24q')
    return { ok: true, id: data.id as string }
  }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'tds.challan.update',
    entity_type: 'tds_challan',
    entity_id: id,
    summary: `Updated TDS challan ${bsrCode}/${challanSerial}`,
  })
  revalidatePath('/tds/challans')
  revalidatePath('/tds/24q')
  return { ok: true, id }
}

// -----------------------------------------------------------------------------
// delete
// -----------------------------------------------------------------------------
export async function deleteTdsChallanAction(formData: FormData): Promise<{ ok?: true; error?: string }> {
  const session = await verifySession()
  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'Missing id' }

  const admin = createAdminClient()
  const { error } = await admin.from('tds_challans').delete().eq('id', id)
  if (error) return { error: error.message }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'tds.challan.delete',
    entity_type: 'tds_challan',
    entity_id: id,
    summary: 'Deleted TDS challan',
  })
  revalidatePath('/tds/challans')
  revalidatePath('/tds/24q')
  return { ok: true }
}
