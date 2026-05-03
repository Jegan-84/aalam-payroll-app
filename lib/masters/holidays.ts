'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/dal'
import {
  fetchExternalHolidays,
  type ImportedHoliday,
  type Provider,
} from '@/lib/holidays/external'

const HolidaySchema = z.object({
  id: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.coerce.number().int().positive().optional(),
  ),
  financial_year: z.string().regex(/^\d{4}-\d{2}$/, 'Format: 2026-27'),
  holiday_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
  name: z.string().trim().min(1, 'Name required'),
  type: z.enum(['public', 'restricted', 'optional']),
  location_id: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.coerce.number().int().positive().optional(),
  ),
  project_id: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.coerce.number().int().positive().optional(),
  ),
})

export type HolidayState = { ok?: boolean; error?: string } | undefined

export async function saveHolidayAction(
  _prev: HolidayState,
  formData: FormData,
): Promise<HolidayState> {
  const session = await requireRole('admin', 'hr')
  const parsed = HolidaySchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join('; ') }
  }
  const input = parsed.data
  const admin = createAdminClient()
  const row = {
    financial_year: input.financial_year,
    holiday_date:   input.holiday_date,
    name:           input.name,
    type:           input.type,
    location_id:    input.location_id ?? null,
    project_id:     input.project_id ?? null,
  }

  if (input.id) {
    const { error } = await admin.from('holidays').update(row).eq('id', input.id)
    if (error) return { error: error.message }
  } else {
    const { error } = await admin.from('holidays').insert(row)
    if (error) return { error: error.message }
  }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: input.id ? 'holiday.update' : 'holiday.create',
    entity_type: 'holiday',
    entity_id: String(input.id ?? `${row.holiday_date}/${row.project_id ?? 'all'}`),
    summary: `${input.id ? 'Updated' : 'Added'} ${row.name} on ${row.holiday_date}`,
  })

  revalidatePath('/settings/holidays')
  return { ok: true }
}

export async function deleteHolidayAction(
  formData: FormData,
): Promise<{ ok?: true; error?: string }> {
  const session = await requireRole('admin', 'hr')
  const id = Number(formData.get('id') ?? 0)
  if (!id) return { error: 'Missing id' }
  const admin = createAdminClient()
  const { error } = await admin.from('holidays').delete().eq('id', id)
  if (error) return { error: error.message }
  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'holiday.delete',
    entity_type: 'holiday',
    entity_id: String(id),
    summary: `Deleted holiday #${id}`,
  })
  revalidatePath('/settings/holidays')
  return { ok: true }
}

// -----------------------------------------------------------------------------
// Weekend sweeper — mark all Saturdays and/or Sundays between two dates as
// holidays for the given scope. Idempotent: existing holidays on the same
// (date, location, project) scope are skipped.
// -----------------------------------------------------------------------------
const WeekendSchema = z.object({
  financial_year: z.string().regex(/^[\w-]+$/, 'FY label required'),
  from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  include_saturday: z.preprocess((v) => v === 'on' || v === 'true' || v === true, z.boolean()),
  include_sunday:   z.preprocess((v) => v === 'on' || v === 'true' || v === true, z.boolean()),
  name: z.string().trim().min(1).default('Weekly off'),
  type: z.enum(['public', 'restricted', 'optional']).default('restricted'),
  location_id: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.coerce.number().int().positive().optional(),
  ),
  project_id: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.coerce.number().int().positive().optional(),
  ),
})

export async function markWeekendsAction(
  formData: FormData,
): Promise<{ ok?: true; error?: string; added?: number; skipped?: number }> {
  const session = await requireRole('admin', 'hr')
  const parsed = WeekendSchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join('; ') }
  const input = parsed.data

  if (!input.include_saturday && !input.include_sunday) {
    return { error: 'Pick at least one of Saturday / Sunday.' }
  }
  if (input.from_date > input.to_date) return { error: 'from_date is after to_date' }

  const fromMs = new Date(input.from_date + 'T00:00:00Z').getTime()
  const toMs = new Date(input.to_date + 'T00:00:00Z').getTime()
  const days: string[] = []
  for (let t = fromMs; t <= toMs; t += 86_400_000) {
    const d = new Date(t)
    const dow = d.getUTCDay() // 0 = Sun, 6 = Sat
    if ((dow === 6 && input.include_saturday) || (dow === 0 && input.include_sunday)) {
      days.push(d.toISOString().slice(0, 10))
    }
  }
  if (days.length === 0) return { ok: true, added: 0, skipped: 0 }

  const admin = createAdminClient()

  // Skip dates that already exist for the exact same (date, location, project) scope.
  const locationId = input.location_id ?? null
  const projectId = input.project_id ?? null
  let existing = admin
    .from('holidays')
    .select('holiday_date')
    .in('holiday_date', days)
  existing = locationId == null ? existing.is('location_id', null) : existing.eq('location_id', locationId)
  existing = projectId == null ? existing.is('project_id', null) : existing.eq('project_id', projectId)
  const { data: existRows } = await existing
  const existSet = new Set((existRows ?? []).map((r) => r.holiday_date as string))

  const rows = days
    .filter((d) => !existSet.has(d))
    .map((d) => ({
      financial_year: input.financial_year,
      holiday_date:   d,
      name:           input.name,
      type:           input.type,
      location_id:    locationId,
      project_id:     projectId,
    }))

  if (rows.length === 0) return { ok: true, added: 0, skipped: days.length }

  const { error } = await admin.from('holidays').insert(rows)
  if (error) return { error: error.message }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'holiday.bulk_weekends',
    entity_type: 'holidays',
    entity_id: input.financial_year,
    summary: `Marked ${rows.length} weekend day(s) in ${input.financial_year} as "${input.name}"`,
  })

  revalidatePath(`/settings/holidays/${encodeURIComponent(input.financial_year)}`)
  revalidatePath('/settings/holidays')
  return { ok: true, added: rows.length, skipped: existSet.size }
}

// -----------------------------------------------------------------------------
// Bulk CSV upload — rows are plain holiday records. project_code / location_code
// resolve to FKs; missing → null (applies globally on that axis).
// -----------------------------------------------------------------------------
export type HolidayBulkRow = {
  financial_year: string
  holiday_date: string
  name: string
  type?: string
  project_code?: string
  location_code?: string
}

export async function bulkUploadHolidaysAction(
  rows: HolidayBulkRow[],
): Promise<{ created: number; skipped: Array<{ row: number; reason: string }> }> {
  const session = await requireRole('admin', 'hr')
  const admin = createAdminClient()

  const [projectsRes, locationsRes] = await Promise.all([
    admin.from('projects').select('id, code'),
    admin.from('locations').select('id, code'),
  ])
  const projByCode = new Map((projectsRes.data ?? []).map((p) => [String(p.code).toUpperCase(), p.id as number]))
  const locByCode = new Map((locationsRes.data ?? []).map((l) => [String(l.code).toUpperCase(), l.id as number]))

  const skipped: Array<{ row: number; reason: string }> = []
  const toInsert: Array<Record<string, unknown>> = []

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const line = i + 1
    if (!r.financial_year || !r.holiday_date || !r.name) {
      skipped.push({ row: line, reason: 'Missing required field (financial_year/holiday_date/name)' })
      continue
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.holiday_date)) {
      skipped.push({ row: line, reason: 'holiday_date must be YYYY-MM-DD' })
      continue
    }
    const type = (r.type || 'public').toLowerCase()
    if (!['public', 'restricted', 'optional'].includes(type)) {
      skipped.push({ row: line, reason: `Unknown type "${r.type}"` })
      continue
    }
    let projectId: number | null = null
    if (r.project_code) {
      const id = projByCode.get(r.project_code.toUpperCase())
      if (!id) {
        skipped.push({ row: line, reason: `Unknown project_code "${r.project_code}"` })
        continue
      }
      projectId = id
    }
    let locationId: number | null = null
    if (r.location_code) {
      const id = locByCode.get(r.location_code.toUpperCase())
      if (!id) {
        skipped.push({ row: line, reason: `Unknown location_code "${r.location_code}"` })
        continue
      }
      locationId = id
    }
    toInsert.push({
      financial_year: r.financial_year.trim(),
      holiday_date:   r.holiday_date,
      name:           r.name.trim(),
      type,
      project_id:     projectId,
      location_id:    locationId,
    })
  }

  let created = 0
  if (toInsert.length > 0) {
    // Insert one row at a time so duplicates don't blow up the whole batch.
    for (let i = 0; i < toInsert.length; i++) {
      const { error } = await admin.from('holidays').insert(toInsert[i])
      if (error) {
        skipped.push({ row: i + 1, reason: error.message })
      } else {
        created++
      }
    }
  }

  if (created > 0) {
    await admin.from('audit_log').insert({
      actor_user_id: session.userId,
      actor_email: session.email,
      action: 'holiday.bulk_upload',
      entity_type: 'holidays',
      entity_id: String(created),
      summary: `Bulk-uploaded ${created} holiday(s); ${skipped.length} skipped`,
    })
  }

  revalidatePath('/settings/holidays')
  return { created, skipped }
}

// -----------------------------------------------------------------------------
// External-API import
// -----------------------------------------------------------------------------
export async function fetchExternalHolidaysAction(
  formData: FormData,
): Promise<{ holidays?: ImportedHoliday[]; error?: string }> {
  await requireRole('admin', 'hr')

  const provider = String(formData.get('provider') ?? '') as Provider
  const country  = String(formData.get('country') ?? 'IN').trim().toUpperCase()
  const year     = Number(formData.get('year') ?? 0)
  const region   = String(formData.get('region') ?? '').trim() || undefined

  if (provider !== 'calendarific') return { error: 'Unknown provider' }
  if (!country || country.length !== 2) return { error: 'Country must be a 2-letter ISO code (e.g. IN)' }
  if (!year || year < 2000 || year > 2100) return { error: 'Invalid year' }

  try {
    const holidays = await fetchExternalHolidays({ provider, country, year, region })
    return { holidays }
  } catch (err) {
    return { error: (err as Error).message }
  }
}

const ImportRowSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().trim().min(1),
  type: z.enum(['public', 'restricted', 'optional']),
})

export async function importExternalHolidaysAction(
  formData: FormData,
): Promise<{ created?: number; skipped?: number; error?: string }> {
  const session = await requireRole('admin', 'hr')

  const fy = String(formData.get('financial_year') ?? '').trim()
  const projectId = (() => {
    const v = String(formData.get('project_id') ?? '').trim()
    return v === '' ? null : Number(v)
  })()
  const locationId = (() => {
    const v = String(formData.get('location_id') ?? '').trim()
    return v === '' ? null : Number(v)
  })()
  const rowsJson = String(formData.get('rows') ?? '[]')

  if (!fy) return { error: 'Missing financial_year' }
  let parsed: unknown
  try { parsed = JSON.parse(rowsJson) } catch { return { error: 'Invalid rows JSON' } }
  if (!Array.isArray(parsed) || parsed.length === 0) return { error: 'No rows selected' }

  const valid: Array<{ date: string; name: string; type: 'public' | 'restricted' | 'optional' }> = []
  for (const r of parsed) {
    const v = ImportRowSchema.safeParse(r)
    if (v.success) valid.push(v.data)
  }
  if (valid.length === 0) return { error: 'No valid rows in payload' }

  const admin = createAdminClient()
  let created = 0
  let skipped = 0
  for (const r of valid) {
    const { error } = await admin.from('holidays').insert({
      financial_year: fy,
      holiday_date:   r.date,
      name:           r.name,
      type:           r.type,
      project_id:     projectId,
      location_id:    locationId,
    })
    if (error) skipped++
    else created++
  }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'holiday.api_import',
    entity_type: 'holidays',
    entity_id: fy,
    summary: `Imported ${created} holiday(s) from external API into ${fy}; ${skipped} skipped (duplicates / errors)`,
  })

  revalidatePath(`/settings/holidays/${encodeURIComponent(fy)}`)
  revalidatePath('/settings/holidays')
  return { created, skipped }
}
