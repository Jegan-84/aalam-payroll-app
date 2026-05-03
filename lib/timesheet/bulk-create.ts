import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

// =============================================================================
// Bulk-create timesheet entries for a single employee.
// =============================================================================
// Used by:
//   • lib/timesheet/actions.ts::importTimesheetEntriesAction (CSV import UI)
//   • app/api/v1/timesheet/entries POST (machine-to-machine API)
//
// Input rows are validated, then aggregated by the unique-key tuple
// (date, project, activity, task, work_mode) — duplicate rows in the same
// payload have their hours summed. For each bucket we delete any existing
// row matching that tuple and insert fresh.
//
// We avoid Postgres `INSERT ... ON CONFLICT` here because the `timesheet_entries`
// unique index is on the expression `coalesce(task, '')` and the supabase JS
// client can't target expression-based indexes via `onConflict`.
// =============================================================================

export type TimesheetBulkRow = {
  entry_date: string
  project_code: string
  activity_code: string
  task?: string | null
  description?: string | null
  hours?: string | number | null
  start_time?: string | null   // HH:MM
  end_time?: string | null     // HH:MM
  work_mode?: string | null    // 'WFH' | 'WFO' | empty
}

export type WeekStatus = 'draft' | 'submitted' | 'approved' | 'rejected'

export type BulkCreateResult = {
  created: number
  skipped: Array<{ row: number; reason: string }>
  weeksTouched: string[]
}

const round025 = (h: number) => Math.max(0, Math.min(24, Math.round(h * 4) / 4))

function mondayOf(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z')
  const dow = d.getUTCDay()
  const offset = dow === 0 ? 6 : dow - 1
  return new Date(d.getTime() - offset * 86_400_000).toISOString().slice(0, 10)
}

function combineDateTime(date: string, hhmm: string): string {
  return `${date}T${hhmm}:00+05:30`
}

function deriveHours(startIso: string, endIso: string): number {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime()
  return round025(ms / 3_600_000)
}

const isWeekEditable = (status: string) => status === 'draft' || status === 'rejected'

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

export async function bulkCreateTimesheetEntries(
  args: {
    employeeId: string
    rows: TimesheetBulkRow[]
    /**
     * Optional. When provided, every week touched by the import is set to this
     * status after the entries land — and the "must be draft/rejected" guard
     * is bypassed. Use 'approved' when mirroring an already-approved timesheet
     * from an external system; use 'draft' to write into a normal week.
     */
    weekStatus?: WeekStatus
  },
): Promise<BulkCreateResult> {
  const admin = createAdminClient()

  const [projectsRes, activitiesRes] = await Promise.all([
    admin.from('projects').select('id, code').eq('is_active', true),
    admin.from('activity_types').select('id, code').eq('is_active', true),
  ])
  const projByCode = new Map(
    (projectsRes.data ?? []).map((p) => [String(p.code).toUpperCase(), p.id as number]),
  )
  const actByCode = new Map(
    (activitiesRes.data ?? []).map((a) => [String(a.code).toUpperCase(), a.id as number]),
  )

  // Pre-fetch week statuses to skip non-editable weeks fast.
  const weekStartsToCheck = new Set<string>()
  for (const r of args.rows) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(r.entry_date)) weekStartsToCheck.add(mondayOf(r.entry_date))
  }
  const { data: weekRows } = weekStartsToCheck.size === 0 ? { data: [] } : await admin
    .from('timesheet_weeks')
    .select('week_start, status')
    .eq('employee_id', args.employeeId)
    .in('week_start', Array.from(weekStartsToCheck))
  const weekStatusByDate = new Map((weekRows ?? []).map((w) => [w.week_start as string, w.status as string]))

  const skipped: BulkCreateResult['skipped'] = []

  // -----------------------------------------------------------------------
  // Pass 1 — validate + aggregate by unique-key tuple.
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

  for (let i = 0; i < args.rows.length; i++) {
    const r = args.rows[i]
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
    const wStatus = weekStatusByDate.get(weekStart) ?? 'draft'
    // The caller can pass `weekStatus` to bypass the editable guard — useful
    // when mirroring an already-approved timesheet from an external system.
    if (!args.weekStatus && !isWeekEditable(wStatus)) {
      skipped.push({ row: line, reason: `Week ${weekStart} is ${wStatus} — reopen first` })
      continue
    }

    let workMode: 'WFH' | 'WFO' = 'WFO'
    if (r.work_mode) {
      const m = String(r.work_mode).toUpperCase()
      if (m === 'WFH' || m === 'WFO') workMode = m
      else { skipped.push({ row: line, reason: `work_mode must be WFH or WFO (got "${r.work_mode}")` }); continue }
    }

    let hours: number
    let startIso: string | null = null
    let endIso: string | null = null
    const start = (r.start_time ?? '').toString().trim()
    const end = (r.end_time ?? '').toString().trim()
    if (start && end) {
      if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) {
        skipped.push({ row: line, reason: 'start_time / end_time must be HH:MM' })
        continue
      }
      startIso = combineDateTime(r.entry_date, start)
      endIso = combineDateTime(r.entry_date, end)
      hours = deriveHours(startIso, endIso)
      if (hours <= 0) { skipped.push({ row: line, reason: 'end_time must be after start_time' }); continue }
    } else {
      const raw = Number(r.hours ?? 0)
      if (!Number.isFinite(raw) || raw <= 0 || raw > 24) {
        skipped.push({ row: line, reason: `hours must be between 0 and 24 (got "${r.hours}")` })
        continue
      }
      hours = round025(raw)
      if (start) startIso = combineDateTime(r.entry_date, start)
      if (end) endIso = combineDateTime(r.entry_date, end)
    }

    const taskStr = r.task && r.task.toString().trim() !== '' ? r.task.toString().trim() : null
    const descStr = r.description?.toString().trim() || null
    const key = bucketKey(r.entry_date, projectId, activityId, taskStr, workMode)
    const existing = buckets.get(key)
    if (existing) {
      existing.hours = round025(existing.hours + hours)
      if (descStr) existing.description = descStr
      if (startIso) existing.startIso = startIso
      if (endIso) existing.endIso = endIso
      existing.sourceLines.push(line)
    } else {
      buckets.set(key, {
        employeeId: args.employeeId,
        entry_date: r.entry_date,
        project_id: projectId,
        activity_type_id: activityId,
        task: taskStr,
        work_mode: workMode,
        hours,
        description: descStr,
        startIso,
        endIso,
        sourceLines: [line],
      })
    }
  }

  // -----------------------------------------------------------------------
  // Pass 2 — for each bucket: delete the matching tuple, then insert fresh.
  // Recalc week totals for every touched week at the end.
  // -----------------------------------------------------------------------
  let created = 0
  const touchedWeeks = new Set<string>()
  for (const b of buckets.values()) {
    const weekStart = mondayOf(b.entry_date)
    await ensureWeekRow(admin, args.employeeId, weekStart)
    touchedWeeks.add(weekStart)

    let delQ = admin
      .from('timesheet_entries')
      .delete()
      .eq('employee_id', args.employeeId)
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
        employee_id: args.employeeId,
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
    created += b.sourceLines.length
  }

  for (const w of touchedWeeks) await recalcWeekTotal(admin, args.employeeId, w)

  // Apply caller-requested week status to every touched week.
  if (args.weekStatus && touchedWeeks.size > 0) {
    const now = new Date().toISOString()
    for (const w of touchedWeeks) {
      const update: Record<string, unknown> = {
        status: args.weekStatus,
        updated_at: now,
      }
      switch (args.weekStatus) {
        case 'draft':
          update.submitted_at = null
          update.approved_at = null
          update.decided_by = null
          update.decision_note = null
          break
        case 'submitted':
          update.submitted_at = now
          update.approved_at = null
          update.decided_by = null
          update.decision_note = null
          break
        case 'approved':
          update.submitted_at = now           // mark as submitted at the same time
          update.approved_at = now
          update.decision_note = 'Imported via API'
          break
        case 'rejected':
          update.approved_at = null
          update.decision_note = 'Imported via API as rejected'
          break
      }
      const { error } = await admin
        .from('timesheet_weeks')
        .update(update)
        .eq('employee_id', args.employeeId)
        .eq('week_start', w)
      if (error) {
        // Non-fatal: entries already wrote successfully. Surface as a skip
        // line so the caller can see the status didn't take.
        skipped.push({ row: 0, reason: `Failed to set ${args.weekStatus} on week ${w}: ${error.message}` })
      }
    }
  }

  return { created, skipped, weeksTouched: Array.from(touchedWeeks).sort() }
}
