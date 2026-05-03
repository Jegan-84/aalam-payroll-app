'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentEmployee } from '@/lib/auth/dal'

const KINDS = ['WFH', 'FIRST_HALF_LEAVE', 'SECOND_HALF_LEAVE', 'FULL_DAY_LEAVE'] as const

const UpsertPlanSchema = z
  .object({
    plan_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    kind: z.enum(KINDS),
    leave_type_id: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.coerce.number().int().positive().optional(),
    ),
    notes: z.preprocess((v) => (typeof v === 'string' ? v.trim() : v), z.string().optional()),
  })
  .superRefine((d, ctx) => {
    if (d.kind !== 'WFH' && !d.leave_type_id) {
      ctx.addIssue({
        code: 'custom',
        path: ['leave_type_id'],
        message: 'Pick a leave type for leave plans.',
      })
    }
    if (d.kind === 'WFH' && d.leave_type_id) {
      ctx.addIssue({
        code: 'custom',
        path: ['leave_type_id'],
        message: 'Leave type only applies to leave kinds, not WFH.',
      })
    }
  })

export async function upsertPlanAction(
  formData: FormData,
): Promise<{ ok?: true; error?: string }> {
  const { employeeId } = await getCurrentEmployee()
  const parsed = UpsertPlanSchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join('; ') }
  }
  const input = parsed.data

  const admin = createAdminClient()
  const { error } = await admin
    .from('monthly_plans')
    .upsert(
      {
        employee_id: employeeId,
        plan_date: input.plan_date,
        kind: input.kind,
        leave_type_id: input.kind === 'WFH' ? null : (input.leave_type_id ?? null),
        notes: input.notes ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'employee_id,plan_date' },
    )
  if (error) return { error: error.message }

  revalidatePath('/me/plan')
  return { ok: true }
}

export async function deletePlanAction(
  formData: FormData,
): Promise<{ ok?: true; error?: string }> {
  const { employeeId } = await getCurrentEmployee()
  const planDate = String(formData.get('plan_date') ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(planDate)) return { error: 'Invalid plan_date' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('monthly_plans')
    .delete()
    .eq('employee_id', employeeId)
    .eq('plan_date', planDate)
  if (error) return { error: error.message }

  revalidatePath('/me/plan')
  return { ok: true }
}

// -----------------------------------------------------------------------------
// saveMonthPlanAction — bulk replace every plan entry for the (employee, month)
// with the payload. Implements the "fill the calendar then click Submit" flow
// the same way the timesheet grid works: edits live in client state, save sends
// the whole month at once.
// -----------------------------------------------------------------------------
type MonthPlanEntry = {
  date: string
  kind: 'WFH' | 'FIRST_HALF_LEAVE' | 'SECOND_HALF_LEAVE' | 'FULL_DAY_LEAVE'
  leave_type_id: number | null
  notes: string | null
}

const SaveMonthPlanSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
})

export async function saveMonthPlanAction(
  formData: FormData,
): Promise<{ ok?: true; error?: string; saved?: number; cleared?: number }> {
  const { employeeId } = await getCurrentEmployee()
  const meta = SaveMonthPlanSchema.safeParse({
    year: formData.get('year'),
    month: formData.get('month'),
  })
  if (!meta.success) return { error: meta.error.issues.map((i) => i.message).join('; ') }
  const { year, month } = meta.data

  let entries: MonthPlanEntry[]
  try {
    entries = JSON.parse(String(formData.get('entries') ?? '[]')) as MonthPlanEntry[]
  } catch {
    return { error: 'Invalid entries payload' }
  }
  if (!Array.isArray(entries)) return { error: 'entries must be an array' }

  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  // Validate + filter: keep only well-formed entries within the month window.
  const valid: Array<{ date: string; kind: MonthPlanEntry['kind']; leave_type_id: number | null; notes: string | null }> = []
  for (const e of entries) {
    if (!e || typeof e.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) continue
    if (e.date < monthStart || e.date > monthEnd) continue
    if (!['WFH', 'FIRST_HALF_LEAVE', 'SECOND_HALF_LEAVE', 'FULL_DAY_LEAVE'].includes(e.kind)) continue
    if (e.kind !== 'WFH' && (typeof e.leave_type_id !== 'number' || e.leave_type_id <= 0)) {
      return { error: `Pick a leave type for ${e.date}.` }
    }
    valid.push({
      date: e.date,
      kind: e.kind,
      leave_type_id: e.kind === 'WFH' ? null : e.leave_type_id,
      notes: e.notes && typeof e.notes === 'string' && e.notes.trim() !== '' ? e.notes.trim() : null,
    })
  }

  const admin = createAdminClient()

  // Replace semantics for the month: clear all existing rows, insert new set.
  const { error: delErr, count: deleted } = await admin
    .from('monthly_plans')
    .delete({ count: 'exact' })
    .eq('employee_id', employeeId)
    .gte('plan_date', monthStart)
    .lte('plan_date', monthEnd)
  if (delErr) return { error: delErr.message }

  let saved = 0
  if (valid.length > 0) {
    const rows = valid.map((v) => ({
      employee_id: employeeId,
      plan_date: v.date,
      kind: v.kind,
      leave_type_id: v.leave_type_id,
      notes: v.notes,
      updated_at: new Date().toISOString(),
    }))
    const { error: insErr } = await admin.from('monthly_plans').insert(rows)
    if (insErr) return { error: insErr.message }
    saved = rows.length
  }

  revalidatePath('/me/plan')
  return { ok: true, saved, cleared: deleted ?? 0 }
}
