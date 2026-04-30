import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

const STANDARD_DAY_HOURS = 8
const LEAVE_CODES_TO_PREFILL = ['PL', 'SL', 'EL', 'COMP_OFF', 'LOP'] as const

// -----------------------------------------------------------------------------
// prefillLeaveAndHolidays — for the given employee + week, inserts
// auto-generated entries for:
//   • approved leave applications that fall in the week
//   • holidays in the week (project + location scoped)
//
// Idempotent. Only runs when the week is editable (draft or rejected) and skips
// any (date, activity) combo that already has an entry — so the employee can
// later reduce a PL row from 8h → 4h, add a DEV row of 4h, and re-running the
// prefill won't undo their edit.
//
// Returns the number of rows inserted (purely for logging / debugging).
// -----------------------------------------------------------------------------
export async function prefillLeaveAndHolidays(
  employeeId: string,
  weekStart: string,   // YYYY-MM-DD (Mon)
): Promise<{ inserted: number }> {
  const admin = createAdminClient()

  // Hard guard: only auto-prefill draft / rejected weeks. Submitted / approved
  // weeks are owned by the approver flow.
  const { data: weekRow } = await admin
    .from('timesheet_weeks')
    .select('status')
    .eq('employee_id', employeeId)
    .eq('week_start', weekStart)
    .maybeSingle()
  const status = (weekRow?.status as string | undefined) ?? 'draft'
  if (status !== 'draft' && status !== 'rejected') return { inserted: 0 }

  const weekStartMs = new Date(weekStart + 'T00:00:00Z').getTime()
  const weekEnd = new Date(weekStartMs + 6 * 86_400_000).toISOString().slice(0, 10)

  // Need a project to attach the row to. Use primary_project_id; fall back to
  // the first secondary project; if neither exists we silently skip prefill
  // (employee has no projects assigned yet — they can manually add rows).
  const { data: emp } = await admin
    .from('employees')
    .select('primary_project_id, location_id')
    .eq('id', employeeId)
    .maybeSingle()
  let projectId: number | null = (emp?.primary_project_id as number | null | undefined) ?? null
  if (!projectId) {
    const { data: sec } = await admin
      .from('employee_secondary_projects')
      .select('project_id')
      .eq('employee_id', employeeId)
      .limit(1)
      .maybeSingle()
    projectId = (sec?.project_id as number | undefined) ?? null
  }
  if (!projectId) return { inserted: 0 }

  // Resolve activity_type ids for the leave codes + HOLIDAY.
  const { data: actTypes } = await admin
    .from('activity_types')
    .select('id, code')
    .in('code', [...LEAVE_CODES_TO_PREFILL, 'HOLIDAY'])
  const actByCode = new Map<string, number>()
  for (const a of (actTypes ?? []) as Array<{ id: number; code: string }>) {
    actByCode.set(a.code, a.id)
  }

  // Existing entries in the week — used to dedupe at any granularity (we only
  // skip when the same (date, activity) combination is already present, so
  // partial edits aren't undone).
  const { data: existingEntries } = await admin
    .from('timesheet_entries')
    .select('entry_date, activity_type_id')
    .eq('employee_id', employeeId)
    .gte('entry_date', weekStart)
    .lte('entry_date', weekEnd)
  const existingKeys = new Set(
    (existingEntries ?? []).map((e) => `${e.entry_date}:${e.activity_type_id}`),
  )

  const rowsToInsert: Array<Record<string, unknown>> = []

  // ---------- Leaves ----------
  const { data: leaveRows } = await admin
    .from('leave_applications')
    .select('from_date, to_date, status, leave_type:leave_types(code)')
    .eq('employee_id', employeeId)
    .eq('status', 'approved')
    .lte('from_date', weekEnd)
    .gte('to_date', weekStart)
  type LR = { from_date: string; to_date: string; status: string;
              leave_type: { code: string } | { code: string }[] | null }
  for (const lv of (leaveRows ?? []) as unknown as LR[]) {
    const code = (Array.isArray(lv.leave_type) ? lv.leave_type[0]?.code : lv.leave_type?.code) ?? ''
    if (!LEAVE_CODES_TO_PREFILL.includes(code as typeof LEAVE_CODES_TO_PREFILL[number])) continue
    const actId = actByCode.get(code)
    if (!actId) continue

    let cursor = new Date(lv.from_date + 'T00:00:00Z').getTime()
    const end = new Date(lv.to_date + 'T00:00:00Z').getTime()
    while (cursor <= end) {
      const iso = new Date(cursor).toISOString().slice(0, 10)
      if (iso >= weekStart && iso <= weekEnd && !existingKeys.has(`${iso}:${actId}`)) {
        rowsToInsert.push({
          employee_id: employeeId,
          project_id: projectId,
          activity_type_id: actId,
          entry_date: iso,
          hours: STANDARD_DAY_HOURS,
          task: null,
          description: `Auto-filled from approved leave (${code})`,
          work_mode: 'WFO',
          source: 'auto',
        })
        existingKeys.add(`${iso}:${actId}`)
      }
      cursor += 86_400_000
    }
  }

  // ---------- Holidays ----------
  const holidayActId = actByCode.get('HOLIDAY')
  if (holidayActId) {
    let q = admin
      .from('holidays')
      .select('holiday_date, name, project_id, location_id')
      .gte('holiday_date', weekStart)
      .lte('holiday_date', weekEnd)
    // Project axis
    q = projectId
      ? q.or(`project_id.is.null,project_id.eq.${projectId}`)
      : q.is('project_id', null)
    // Location axis
    const locId = (emp?.location_id as number | null | undefined) ?? null
    q = locId
      ? q.or(`location_id.is.null,location_id.eq.${locId}`)
      : q.is('location_id', null)

    const { data: hols } = await q
    const seenDates = new Set<string>()
    for (const h of (hols ?? []) as Array<{ holiday_date: string; name: string }>) {
      if (seenDates.has(h.holiday_date)) continue
      seenDates.add(h.holiday_date)
      const key = `${h.holiday_date}:${holidayActId}`
      if (existingKeys.has(key)) continue
      rowsToInsert.push({
        employee_id: employeeId,
        project_id: projectId,
        activity_type_id: holidayActId,
        entry_date: h.holiday_date,
        hours: STANDARD_DAY_HOURS,
        task: null,
        description: `Auto-filled holiday: ${h.name}`,
        is_billable: false,
        work_mode: 'WFO',
        source: 'auto',
      })
      existingKeys.add(key)
    }
  }

  if (rowsToInsert.length === 0) return { inserted: 0 }

  // Need the week row to exist before any entries can attach.
  await admin
    .from('timesheet_weeks')
    .upsert(
      { employee_id: employeeId, week_start: weekStart, status: 'draft' },
      { onConflict: 'employee_id,week_start', ignoreDuplicates: true },
    )

  // Plain insert — `existingKeys` already deduped in-memory above. We avoid
  // upsert-with-onConflict here because the unique index uses an expression
  // (coalesce(task, '')) that the JS client can't target via onConflict.
  const { error, count } = await admin
    .from('timesheet_entries')
    .insert(rowsToInsert, { count: 'exact' })
  if (error) {
    // Tolerate duplicate-key races (a parallel page-load could have inserted
    // the same auto rows). The next render's existingKeys check will skip
    // them; nothing else to do.
    if (error.code === '23505' || /duplicate key/i.test(error.message)) {
      return { inserted: 0 }
    }
    throw new Error(error.message)
  }

  return { inserted: count ?? rowsToInsert.length }
}
