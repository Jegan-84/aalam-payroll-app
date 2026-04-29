'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentEmployee } from '@/lib/auth/dal'

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
function mondayOf(dateIso: string): string {
  const d = new Date(dateIso + 'T00:00:00Z')
  const dow = d.getUTCDay()
  const offset = dow === 0 ? 6 : dow - 1
  return new Date(d.getTime() - offset * 86_400_000).toISOString().slice(0, 10)
}

function isWeekEditable(status: string): boolean {
  return status === 'draft' || status === 'rejected'
}

async function ensureWeekRow(
  admin: ReturnType<typeof createAdminClient>,
  employeeId: string,
  weekStart: string,
) {
  await admin
    .from('timesheet_weeks')
    .upsert(
      { employee_id: employeeId, week_start: weekStart, status: 'draft' },
      { onConflict: 'employee_id,week_start', ignoreDuplicates: true },
    )
}

async function recalcWeekTotal(
  admin: ReturnType<typeof createAdminClient>,
  employeeId: string,
  weekStart: string,
) {
  const weekEnd = new Date(new Date(weekStart + 'T00:00:00Z').getTime() + 6 * 86_400_000).toISOString().slice(0, 10)
  const { data } = await admin
    .from('timesheet_entries')
    .select('hours')
    .eq('employee_id', employeeId)
    .gte('entry_date', weekStart)
    .lte('entry_date', weekEnd)
  const total = (data ?? []).reduce((s, r) => s + Number(r.hours ?? 0), 0)
  await admin
    .from('timesheet_weeks')
    .update({ total_hours: Math.round(total * 100) / 100, updated_at: new Date().toISOString() })
    .eq('employee_id', employeeId)
    .eq('week_start', weekStart)
}

// Round to 0.25h
function quarterRound(hours: number): number {
  return Math.max(0, Math.min(24, Math.round(hours * 4) / 4))
}

// -----------------------------------------------------------------------------
// upsertEntryAction — inline cell save from the grid.
// (employee, entry_date, project_id, activity_type_id, task) is unique. Hours
// of 0 deletes the row.
// -----------------------------------------------------------------------------
const UpsertEntrySchema = z.object({
  project_id: z.coerce.number().int().positive(),
  activity_type_id: z.coerce.number().int().positive(),
  entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hours: z.coerce.number().min(0).max(24).optional(),
  task: z.preprocess((v) => (typeof v === 'string' ? v.trim() : v), z.string().optional()),
  description: z.preprocess((v) => (typeof v === 'string' ? v.trim() : v), z.string().optional()),
  work_mode: z.enum(['WFH', 'WFO']).default('WFO'),
  // HH:MM (no date) — combined with entry_date in IST.
  start_time: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM').optional(),
  ),
  end_time: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM').optional(),
  ),
})

// Combine entry_date (YYYY-MM-DD) + HH:MM into an IST timestamptz string.
function combineDateTime(date: string, hhmm: string): string {
  // Treat the time as IST (UTC+05:30).
  return `${date}T${hhmm}:00+05:30`
}

function deriveHours(startIso: string, endIso: string): number {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime()
  return quarterRound(ms / 3_600_000)
}

export async function upsertEntryAction(
  formData: FormData,
): Promise<{ ok?: true; error?: string }> {
  const { employeeId } = await getCurrentEmployee()
  const parsed = UpsertEntrySchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join('; ') }
  const input = parsed.data

  const admin = createAdminClient()
  const weekStart = mondayOf(input.entry_date)

  // Block edits to non-editable weeks.
  const { data: weekRow } = await admin
    .from('timesheet_weeks')
    .select('status')
    .eq('employee_id', employeeId)
    .eq('week_start', weekStart)
    .maybeSingle()
  if (weekRow && !isWeekEditable(String(weekRow.status))) {
    return { error: `This week is ${weekRow.status} — reopen it before editing.` }
  }

  // Derive hours from start/end if both are provided; else use the manual hours.
  let startIso: string | null = null
  let endIso: string | null = null
  let hours: number
  if (input.start_time && input.end_time) {
    startIso = combineDateTime(input.entry_date, input.start_time)
    endIso = combineDateTime(input.entry_date, input.end_time)
    hours = deriveHours(startIso, endIso)
    if (hours <= 0) {
      return { error: 'End time must be after start time.' }
    }
  } else {
    hours = quarterRound(input.hours ?? 0)
    if (input.start_time) startIso = combineDateTime(input.entry_date, input.start_time)
    if (input.end_time)   endIso   = combineDateTime(input.entry_date, input.end_time)
  }

  const task = input.task && input.task.length > 0 ? input.task : null

  if (hours === 0) {
    // Delete the entry if it exists; this is how the grid clears a cell.
    await admin
      .from('timesheet_entries')
      .delete()
      .eq('employee_id', employeeId)
      .eq('entry_date', input.entry_date)
      .eq('project_id', input.project_id)
      .eq('activity_type_id', input.activity_type_id)
      .eq('work_mode', input.work_mode)
      .filter('task', task === null ? 'is' : 'eq', task === null ? null : task)
    await ensureWeekRow(admin, employeeId, weekStart)
    await recalcWeekTotal(admin, employeeId, weekStart)
    revalidatePath('/me/timesheet', 'layout')
    return { ok: true }
  }

  await ensureWeekRow(admin, employeeId, weekStart)

  // Upsert via the unique grid index.
  const { error } = await admin
    .from('timesheet_entries')
    .upsert(
      {
        employee_id: employeeId,
        project_id: input.project_id,
        activity_type_id: input.activity_type_id,
        entry_date: input.entry_date,
        hours,
        task,
        description: input.description ?? null,
        work_mode: input.work_mode,
        start_at: startIso,
        end_at: endIso,
        source: 'manual',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'employee_id,entry_date,project_id,activity_type_id,task,work_mode' },
    )
  if (error) return { error: error.message }

  await recalcWeekTotal(admin, employeeId, weekStart)
  revalidatePath('/me/timesheet', 'layout')
  return { ok: true }
}

// -----------------------------------------------------------------------------
// addRowAction — add a (project, activity, task) row to the grid even before
// any hours are filled. Creates a zero-hour entry on Monday so the row appears.
// Does nothing if a matching row already exists.
// -----------------------------------------------------------------------------
const AddRowSchema = z.object({
  week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  project_id: z.coerce.number().int().positive(),
  activity_type_id: z.coerce.number().int().positive(),
  task: z.preprocess((v) => (typeof v === 'string' ? v.trim() : v), z.string().optional()),
  work_mode: z.enum(['WFH', 'WFO']).default('WFO'),
})

export async function addRowAction(formData: FormData): Promise<{ ok?: true; error?: string }> {
  const { employeeId } = await getCurrentEmployee()
  const parsed = AddRowSchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join('; ') }
  const input = parsed.data

  const admin = createAdminClient()
  await ensureWeekRow(admin, employeeId, input.week_start)

  const task = input.task && input.task.length > 0 ? input.task : null

  // If a non-zero entry already exists for this bucket on any day of the
  // week, no-op. Otherwise insert a 0h Monday placeholder.
  const weekEnd = new Date(new Date(input.week_start + 'T00:00:00Z').getTime() + 6 * 86_400_000)
    .toISOString().slice(0, 10)
  const existing = await admin
    .from('timesheet_entries')
    .select('id')
    .eq('employee_id', employeeId)
    .eq('project_id', input.project_id)
    .eq('activity_type_id', input.activity_type_id)
    .eq('work_mode', input.work_mode)
    .filter('task', task === null ? 'is' : 'eq', task === null ? null : task)
    .gte('entry_date', input.week_start)
    .lte('entry_date', weekEnd)
    .limit(1)
  if (existing.data && existing.data.length > 0) {
    revalidatePath('/me/timesheet', 'layout')
    return { ok: true }
  }

  const { error } = await admin
    .from('timesheet_entries')
    .insert({
      employee_id: employeeId,
      project_id: input.project_id,
      activity_type_id: input.activity_type_id,
      entry_date: input.week_start,
      hours: 0,
      task,
      work_mode: input.work_mode,
      source: 'manual',
    })
  if (error) return { error: error.message }

  revalidatePath('/me/timesheet', 'layout')
  return { ok: true }
}

// -----------------------------------------------------------------------------
// submitWeekAction / reopenWeekAction
// -----------------------------------------------------------------------------
export async function submitWeekAction(formData: FormData): Promise<{ ok?: true; error?: string }> {
  const { employeeId } = await getCurrentEmployee()
  const weekStart = String(formData.get('week_start') ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return { error: 'Invalid week_start' }

  const admin = createAdminClient()
  await ensureWeekRow(admin, employeeId, weekStart)
  await recalcWeekTotal(admin, employeeId, weekStart)

  const { error } = await admin
    .from('timesheet_weeks')
    .update({
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      decision_note: null,
      updated_at: new Date().toISOString(),
    })
    .eq('employee_id', employeeId)
    .eq('week_start', weekStart)
    .in('status', ['draft', 'rejected'])
  if (error) return { error: error.message }

  revalidatePath('/me/timesheet', 'layout')
  revalidatePath('/timesheet/approvals')
  return { ok: true }
}

export async function reopenWeekAction(formData: FormData): Promise<{ ok?: true; error?: string }> {
  const { employeeId } = await getCurrentEmployee()
  const weekStart = String(formData.get('week_start') ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return { error: 'Invalid week_start' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('timesheet_weeks')
    .update({
      status: 'draft',
      submitted_at: null,
      approved_at: null,
      decided_by: null,
      decision_note: null,
      updated_at: new Date().toISOString(),
    })
    .eq('employee_id', employeeId)
    .eq('week_start', weekStart)
    .in('status', ['submitted', 'rejected'])
  if (error) return { error: error.message }

  revalidatePath('/me/timesheet', 'layout')
  return { ok: true }
}

// -----------------------------------------------------------------------------
// Timer — startTimerAction / stopTimerAction
// -----------------------------------------------------------------------------
const StartTimerSchema = z.object({
  project_id: z.coerce.number().int().positive(),
  activity_type_id: z.coerce.number().int().positive(),
  task: z.preprocess((v) => (typeof v === 'string' ? v.trim() : v), z.string().optional()),
  description: z.preprocess((v) => (typeof v === 'string' ? v.trim() : v), z.string().optional()),
  work_mode: z.enum(['WFH', 'WFO']).default('WFO'),
})

export async function startTimerAction(formData: FormData): Promise<{ ok?: true; error?: string }> {
  const { employeeId } = await getCurrentEmployee()
  const parsed = StartTimerSchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join('; ') }
  const input = parsed.data

  const admin = createAdminClient()
  // Auto-stop any existing timer first (single-timer semantics).
  await stopTimerForEmployee(admin, employeeId).catch(() => {})

  const { error } = await admin
    .from('active_timers')
    .upsert({
      employee_id: employeeId,
      project_id: input.project_id,
      activity_type_id: input.activity_type_id,
      task: input.task && input.task.length > 0 ? input.task : null,
      description: input.description ?? null,
      work_mode: input.work_mode,
      started_at: new Date().toISOString(),
    })
  if (error) return { error: error.message }

  revalidatePath('/me/timesheet', 'layout')
  revalidatePath('/me')
  return { ok: true }
}

export async function stopTimerAction(): Promise<{ ok?: true; error?: string; loggedHours?: number }> {
  const { employeeId } = await getCurrentEmployee()
  const admin = createAdminClient()
  try {
    const loggedHours = await stopTimerForEmployee(admin, employeeId)
    revalidatePath('/me/timesheet', 'layout')
    revalidatePath('/me')
    return { ok: true, loggedHours }
  } catch (err) {
    return { error: (err as Error).message }
  }
}

async function stopTimerForEmployee(
  admin: ReturnType<typeof createAdminClient>,
  employeeId: string,
): Promise<number> {
  const { data: timer } = await admin
    .from('active_timers')
    .select('project_id, activity_type_id, task, description, work_mode, started_at')
    .eq('employee_id', employeeId)
    .maybeSingle()
  if (!timer) return 0

  const startMs = new Date(timer.started_at as string).getTime()
  const elapsedMs = Date.now() - startMs
  const elapsedHours = quarterRound(elapsedMs / 3_600_000)

  if (elapsedHours > 0) {
    const entryDate = new Date().toISOString().slice(0, 10)
    const weekStart = mondayOf(entryDate)
    await ensureWeekRow(admin, employeeId, weekStart)

    const task = (timer.task as string | null) ?? null
    const workMode = (timer.work_mode as 'WFH' | 'WFO' | null) ?? 'WFO'

    // Add to existing entry's hours (or create one). Match including
    // work_mode so a WFH timer doesn't merge into a WFO entry.
    const { data: existing } = await admin
      .from('timesheet_entries')
      .select('id, hours')
      .eq('employee_id', employeeId)
      .eq('entry_date', entryDate)
      .eq('project_id', timer.project_id as number)
      .eq('activity_type_id', timer.activity_type_id as number)
      .eq('work_mode', workMode)
      .filter('task', task === null ? 'is' : 'eq', task === null ? null : task)
      .maybeSingle()

    if (existing) {
      const newHours = quarterRound(Number(existing.hours ?? 0) + elapsedHours)
      await admin
        .from('timesheet_entries')
        .update({ hours: newHours, source: 'timer', updated_at: new Date().toISOString() })
        .eq('id', existing.id)
    } else {
      await admin
        .from('timesheet_entries')
        .insert({
          employee_id: employeeId,
          project_id: timer.project_id,
          activity_type_id: timer.activity_type_id,
          entry_date: entryDate,
          hours: elapsedHours,
          task,
          description: (timer.description as string | null) ?? null,
          work_mode: workMode,
          source: 'timer',
        })
    }
    await recalcWeekTotal(admin, employeeId, weekStart)
  }

  await admin.from('active_timers').delete().eq('employee_id', employeeId)
  return elapsedHours
}

// -----------------------------------------------------------------------------
// copyLastWeekAction — duplicate the (project, activity, task, work_mode) row
// scaffolding from the previous week into the current week as 0h placeholders.
// Skips buckets that already exist. Skips auto-prefilled leave/holiday rows.
// -----------------------------------------------------------------------------
export async function copyLastWeekAction(
  formData: FormData,
): Promise<{ ok?: true; error?: string; copied?: number }> {
  const { employeeId } = await getCurrentEmployee()
  const weekStart = String(formData.get('week_start') ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return { error: 'Invalid week_start' }

  const admin = createAdminClient()

  const { data: weekRow } = await admin
    .from('timesheet_weeks')
    .select('status')
    .eq('employee_id', employeeId)
    .eq('week_start', weekStart)
    .maybeSingle()
  if (weekRow && !isWeekEditable(String(weekRow.status))) {
    return { error: `This week is ${weekRow.status} — reopen it before copying.` }
  }

  const prevStart = new Date(new Date(weekStart + 'T00:00:00Z').getTime() - 7 * 86_400_000)
    .toISOString().slice(0, 10)
  const prevEnd = new Date(new Date(prevStart + 'T00:00:00Z').getTime() + 6 * 86_400_000)
    .toISOString().slice(0, 10)
  const curEnd = new Date(new Date(weekStart + 'T00:00:00Z').getTime() + 6 * 86_400_000)
    .toISOString().slice(0, 10)

  // Source rows from last week — skip 'auto' (leave/holiday) so we don't carry
  // those forward; this week's prefill will recreate them if applicable.
  const { data: prev } = await admin
    .from('timesheet_entries')
    .select('project_id, activity_type_id, task, work_mode, source')
    .eq('employee_id', employeeId)
    .gte('entry_date', prevStart)
    .lte('entry_date', prevEnd)
    .neq('source', 'auto')

  // Existing buckets in the current week — to dedupe.
  const { data: cur } = await admin
    .from('timesheet_entries')
    .select('project_id, activity_type_id, task, work_mode')
    .eq('employee_id', employeeId)
    .gte('entry_date', weekStart)
    .lte('entry_date', curEnd)
  const existing = new Set(
    (cur ?? []).map((r) => `${r.project_id}:${r.activity_type_id}:${r.task ?? ''}:${r.work_mode}`),
  )

  const buckets = new Map<string, { project_id: number; activity_type_id: number; task: string | null; work_mode: string }>()
  for (const r of (prev ?? []) as Array<{ project_id: number; activity_type_id: number; task: string | null; work_mode: string }>) {
    const key = `${r.project_id}:${r.activity_type_id}:${r.task ?? ''}:${r.work_mode}`
    if (existing.has(key) || buckets.has(key)) continue
    buckets.set(key, {
      project_id: r.project_id,
      activity_type_id: r.activity_type_id,
      task: r.task,
      work_mode: r.work_mode,
    })
  }
  if (buckets.size === 0) return { ok: true, copied: 0 }

  await ensureWeekRow(admin, employeeId, weekStart)

  const rows = Array.from(buckets.values()).map((b) => ({
    employee_id: employeeId,
    project_id: b.project_id,
    activity_type_id: b.activity_type_id,
    entry_date: weekStart,   // Monday placeholder
    hours: 0,
    task: b.task,
    work_mode: b.work_mode,
    source: 'manual' as const,
  }))
  const { error, count } = await admin
    .from('timesheet_entries')
    .upsert(rows, {
      onConflict: 'employee_id,entry_date,project_id,activity_type_id,task,work_mode',
      ignoreDuplicates: true,
      count: 'exact',
    })
  if (error) return { error: error.message }

  revalidatePath('/me/timesheet', 'layout')
  return { ok: true, copied: count ?? rows.length }
}

// -----------------------------------------------------------------------------
// importTimesheetEntriesAction — bulk-create entries for the logged-in
// employee. Each row is matched against active projects + activity types by
// code; unknown codes are skipped with a reason. Editable weeks only.
// -----------------------------------------------------------------------------
export type TimesheetImportRow = {
  entry_date: string
  project_code: string
  activity_code: string
  task?: string
  description?: string
  hours?: string | number
  start_time?: string   // HH:MM
  end_time?: string     // HH:MM
  work_mode?: string    // 'WFH' | 'WFO' | empty
}

export async function importTimesheetEntriesAction(
  rows: TimesheetImportRow[],
): Promise<{ created: number; skipped: Array<{ row: number; reason: string }> }> {
  const { employeeId } = await getCurrentEmployee()
  const admin = createAdminClient()

  const [projectsRes, activitiesRes] = await Promise.all([
    admin.from('projects').select('id, code').eq('is_active', true),
    admin.from('activity_types').select('id, code').eq('is_active', true),
  ])
  const projByCode = new Map((projectsRes.data ?? []).map((p) => [String(p.code).toUpperCase(), p.id as number]))
  const actByCode = new Map((activitiesRes.data ?? []).map((a) => [String(a.code).toUpperCase(), a.id as number]))

  // Pre-fetch week statuses to skip non-editable weeks fast.
  const weekStartsToCheck = new Set<string>()
  for (const r of rows) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(r.entry_date)) weekStartsToCheck.add(mondayOf(r.entry_date))
  }
  const { data: weekRows } = await admin
    .from('timesheet_weeks')
    .select('week_start, status')
    .eq('employee_id', employeeId)
    .in('week_start', Array.from(weekStartsToCheck))
  const weekStatus = new Map((weekRows ?? []).map((w) => [w.week_start as string, w.status as string]))

  const skipped: Array<{ row: number; reason: string }> = []

  // -----------------------------------------------------------------------
  // Pass 1 — validate every input row, aggregate by the unique-key tuple.
  // The schema's unique index is on
  //   (employee_id, entry_date, project_id, activity_type_id, coalesce(task,''), work_mode)
  // so two CSV rows that share that tuple must collapse into one entry —
  // we sum their hours. This also avoids the supabase upsert/onConflict
  // mismatch (the JS client can't express index expressions like
  // coalesce(task, '')); we use plain delete + insert instead.
  // -----------------------------------------------------------------------
  type Bucket = {
    employeeId: string
    entry_date: string
    project_id: number
    activity_type_id: number
    task: string | null
    work_mode: 'WFH' | 'WFO'
    hours: number
    description: string | null
    startIso: string | null
    endIso: string | null
    sourceLines: number[]
  }
  const buckets = new Map<string, Bucket>()
  const bucketKey = (date: string, p: number, a: number, task: string | null, mode: string) =>
    `${date}|${p}|${a}|${task ?? ''}|${mode}`

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const line = i + 1

    if (!r.entry_date || !/^\d{4}-\d{2}-\d{2}$/.test(r.entry_date)) {
      skipped.push({ row: line, reason: 'entry_date must be YYYY-MM-DD' })
      continue
    }
    if (!r.project_code || !r.activity_code) {
      skipped.push({ row: line, reason: 'project_code and activity_code are required' })
      continue
    }
    const projectId = projByCode.get(String(r.project_code).toUpperCase())
    if (!projectId) {
      skipped.push({ row: line, reason: `Unknown project_code "${r.project_code}"` })
      continue
    }
    const activityId = actByCode.get(String(r.activity_code).toUpperCase())
    if (!activityId) {
      skipped.push({ row: line, reason: `Unknown activity_code "${r.activity_code}"` })
      continue
    }

    const weekStart = mondayOf(r.entry_date)
    const wStatus = weekStatus.get(weekStart) ?? 'draft'
    if (!isWeekEditable(wStatus)) {
      skipped.push({ row: line, reason: `Week ${weekStart} is ${wStatus} — reopen first` })
      continue
    }

    let workMode: 'WFH' | 'WFO' = 'WFO'
    if (r.work_mode) {
      const m = String(r.work_mode).toUpperCase()
      if (m === 'WFH' || m === 'WFO') workMode = m
      else {
        skipped.push({ row: line, reason: `work_mode must be WFH or WFO (got "${r.work_mode}")` })
        continue
      }
    }

    let hours: number
    let startIso: string | null = null
    let endIso: string | null = null
    const start = r.start_time?.toString().trim() || ''
    const end = r.end_time?.toString().trim() || ''
    if (start && end) {
      if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) {
        skipped.push({ row: line, reason: 'start_time / end_time must be HH:MM' })
        continue
      }
      startIso = combineDateTime(r.entry_date, start)
      endIso = combineDateTime(r.entry_date, end)
      hours = deriveHours(startIso, endIso)
      if (hours <= 0) {
        skipped.push({ row: line, reason: 'end_time must be after start_time' })
        continue
      }
    } else {
      const raw = Number(r.hours ?? 0)
      if (!Number.isFinite(raw) || raw <= 0 || raw > 24) {
        skipped.push({ row: line, reason: `hours must be between 0 and 24 (got "${r.hours}")` })
        continue
      }
      hours = quarterRound(raw)
      if (start) startIso = combineDateTime(r.entry_date, start)
      if (end) endIso = combineDateTime(r.entry_date, end)
    }

    const task = r.task && r.task.trim() !== '' ? r.task.trim() : null
    const description = r.description?.trim() || null
    const key = bucketKey(r.entry_date, projectId, activityId, task, workMode)
    const existing = buckets.get(key)
    if (existing) {
      existing.hours = quarterRound(existing.hours + hours)
      // Last-row-wins for description / time range — these aren't summable.
      if (description) existing.description = description
      if (startIso) existing.startIso = startIso
      if (endIso) existing.endIso = endIso
      existing.sourceLines.push(line)
    } else {
      buckets.set(key, {
        employeeId,
        entry_date: r.entry_date,
        project_id: projectId,
        activity_type_id: activityId,
        task,
        work_mode: workMode,
        hours,
        description,
        startIso,
        endIso,
        sourceLines: [line],
      })
    }
  }

  // -----------------------------------------------------------------------
  // Pass 2 — for each bucket, delete any conflicting row then insert. We
  // can't rely on supabase upsert here because the unique index uses an
  // expression (coalesce(task, '')) which the JS client can't target via
  // onConflict. Delete + insert mirrors how saveWeekDraftAction writes a
  // whole week.
  // -----------------------------------------------------------------------
  let created = 0
  const touchedWeeks = new Set<string>()

  for (const b of buckets.values()) {
    const weekStart = mondayOf(b.entry_date)
    await ensureWeekRow(admin, employeeId, weekStart)
    touchedWeeks.add(weekStart)

    // Delete any existing row matching the unique tuple.
    let delQ = admin
      .from('timesheet_entries')
      .delete()
      .eq('employee_id', employeeId)
      .eq('entry_date', b.entry_date)
      .eq('project_id', b.project_id)
      .eq('activity_type_id', b.activity_type_id)
      .eq('work_mode', b.work_mode)
    delQ = b.task === null ? delQ.is('task', null) : delQ.eq('task', b.task)
    const { error: delErr } = await delQ
    if (delErr) {
      for (const ln of b.sourceLines) skipped.push({ row: ln, reason: delErr.message })
      continue
    }

    const { error: insErr } = await admin
      .from('timesheet_entries')
      .insert({
        employee_id: b.employeeId,
        project_id: b.project_id,
        activity_type_id: b.activity_type_id,
        entry_date: b.entry_date,
        hours: b.hours,
        task: b.task,
        description: b.description,
        work_mode: b.work_mode,
        start_at: b.startIso,
        end_at: b.endIso,
        source: 'manual',
      })
    if (insErr) {
      for (const ln of b.sourceLines) skipped.push({ row: ln, reason: insErr.message })
      continue
    }
    created += b.sourceLines.length   // count every CSV row that contributed
  }

  // Recalc touched weeks.
  for (const w of touchedWeeks) await recalcWeekTotal(admin, employeeId, w)

  revalidatePath('/me/timesheet', 'layout')
  return { created, skipped }
}

// -----------------------------------------------------------------------------
// saveWeekDraftAction — bulk-replace every entry for the given week with the
// payload. Implements the "manual save" flow: client holds the whole grid in
// state, edits don't hit the server, and clicking Save (or Ctrl+S) sends the
// final picture in one shot.
// -----------------------------------------------------------------------------
type SaveRow = {
  project_id: number
  activity_type_id: number
  task: string | null
  description: string | null
  work_mode: 'WFH' | 'WFO'
  source: 'manual' | 'timer' | 'auto'
  hoursByDate: Record<string, number>
  startEndByDate?: Record<string, { start: string | null; end: string | null }>
}

export async function saveWeekDraftAction(
  formData: FormData,
): Promise<{ ok?: true; error?: string; saved?: number }> {
  const { employeeId } = await getCurrentEmployee()
  const weekStart = String(formData.get('week_start') ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return { error: 'Invalid week_start' }

  let rows: SaveRow[]
  try {
    rows = JSON.parse(String(formData.get('rows') ?? '[]')) as SaveRow[]
  } catch {
    return { error: 'Invalid rows payload' }
  }
  if (!Array.isArray(rows)) return { error: 'rows must be an array' }

  const admin = createAdminClient()

  const { data: weekRow } = await admin
    .from('timesheet_weeks')
    .select('status')
    .eq('employee_id', employeeId)
    .eq('week_start', weekStart)
    .maybeSingle()
  if (weekRow && !isWeekEditable(String(weekRow.status))) {
    return { error: `This week is ${weekRow.status} — reopen it before saving.` }
  }

  await ensureWeekRow(admin, employeeId, weekStart)

  const weekEnd = new Date(new Date(weekStart + 'T00:00:00Z').getTime() + 6 * 86_400_000)
    .toISOString().slice(0, 10)

  // Build the flat list of (date, row) entries to insert.
  const toInsert: Array<Record<string, unknown>> = []
  for (const r of rows) {
    if (typeof r.project_id !== 'number' || typeof r.activity_type_id !== 'number') continue
    const task = r.task && r.task.trim() !== '' ? r.task.trim() : null
    const workMode = r.work_mode === 'WFH' ? 'WFH' : 'WFO'
    const source = r.source === 'auto' ? 'auto' : r.source === 'timer' ? 'timer' : 'manual'
    const description = r.description ? r.description.toString().trim() || null : null

    for (const [date, rawHours] of Object.entries(r.hoursByDate ?? {})) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
      if (date < weekStart || date > weekEnd) continue
      const hours = quarterRound(Number(rawHours) || 0)
      if (hours <= 0) continue

      const se = r.startEndByDate?.[date]
      const startAt = se?.start ?? null
      const endAt = se?.end ?? null

      toInsert.push({
        employee_id: employeeId,
        project_id: r.project_id,
        activity_type_id: r.activity_type_id,
        entry_date: date,
        hours,
        task,
        description,
        work_mode: workMode,
        start_at: startAt,
        end_at: endAt,
        source,
        updated_at: new Date().toISOString(),
      })
    }
  }

  // Replace semantics: wipe the week, then insert. The prefill on the next
  // page render only fills holes, so untouched leave/holiday rows come back
  // automatically — and edited ones stay edited because they're sent here.
  const { error: delErr } = await admin
    .from('timesheet_entries')
    .delete()
    .eq('employee_id', employeeId)
    .gte('entry_date', weekStart)
    .lte('entry_date', weekEnd)
  if (delErr) return { error: delErr.message }

  if (toInsert.length > 0) {
    const { error: insErr } = await admin
      .from('timesheet_entries')
      .insert(toInsert)
    if (insErr) return { error: insErr.message }
  }

  await recalcWeekTotal(admin, employeeId, weekStart)
  revalidatePath('/me/timesheet', 'layout')
  return { ok: true, saved: toInsert.length }
}
