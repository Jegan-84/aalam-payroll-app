import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireApiScope } from '@/lib/api/auth'
import { jsonOk, jsonError, errorResponse } from '@/lib/api/responses'
import { bulkCreateTimesheetEntries, type TimesheetBulkRow } from '@/lib/timesheet/bulk-create'

export const runtime = 'nodejs'

// =============================================================================
// /api/v1/timesheet/entries
// =============================================================================
//   POST                                       — bulk create (scope: timesheet:write)
//   GET    ?employee_code=&from=&to=&limit=&offset=
//                                              — list (scope: timesheet:read)
//
// Bulk POST body shape:
//   {
//     "employee_code": "AALAM0123",
//     "entries": [
//       { "entry_date": "2026-04-21", "project_code": "ACME", "activity_code": "DEV",
//         "task": "Frontend", "hours": 4, "work_mode": "WFO" },
//       …
//     ]
//   }
//
// Response includes per-row skip reasons so the caller can fix and retry.
// =============================================================================

const TIME_HHMM = /^\d{2}:\d{2}$/
const ISO_DATE  = /^\d{4}-\d{2}-\d{2}$/

const EntrySchema = z.object({
  entry_date:    z.string().regex(ISO_DATE, 'entry_date must be YYYY-MM-DD'),
  project_code:  z.string().trim().min(1),
  activity_code: z.string().trim().min(1),
  task:          z.string().trim().optional().nullable(),
  description:   z.string().trim().optional().nullable(),
  hours:         z.union([z.number(), z.string()]).optional().nullable(),
  start_time:    z.string().regex(TIME_HHMM, 'start_time must be HH:MM').optional().nullable(),
  end_time:      z.string().regex(TIME_HHMM, 'end_time must be HH:MM').optional().nullable(),
  work_mode:     z.enum(['WFH', 'WFO']).optional().nullable(),
})

// One employee's slice of a bulk request.
const PerEmployeeSchema = z.object({
  employee_code: z.string().trim().min(1),
  /**
   * Optional. When set, every week touched by this employee's entries is
   * moved to this status after the rows land — and the editable-week guard
   * is bypassed. Use 'approved' to mirror an already-approved timesheet
   * from the source system without going through the draft → submit →
   * approve flow.
   */
  week_status:   z.enum(['draft', 'submitted', 'approved', 'rejected']).optional(),
  entries:       z.array(EntrySchema).min(1, 'entries must contain at least 1 row'),
})

// Body accepts EITHER:
//   { employee_code, week_status?, entries: [...] }                       (single)
//   { employees: [{ employee_code, week_status?, entries: [...] }, ...] } (multi)
const SinglePostSchema = PerEmployeeSchema
const MultiPostSchema = z.object({
  employees: z.array(PerEmployeeSchema).min(1, 'employees must contain at least 1 record'),
})
const PostSchema = z.union([MultiPostSchema, SinglePostSchema])

// Per-call cap on total entries across every employee in the body.
const MAX_TOTAL_ENTRIES = 1000

// -----------------------------------------------------------------------------
// POST — bulk create (one or many employees)
// -----------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    await requireApiScope(request, 'timesheet:write')

    let body: unknown
    try { body = await request.json() } catch { return jsonError(400, 'invalid_json', 'Body must be JSON.') }

    const parsed = PostSchema.safeParse(body)
    if (!parsed.success) {
      return jsonError(400, 'validation_failed', parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '))
    }

    // Normalise to an array of per-employee slices.
    const slices = 'employees' in parsed.data ? parsed.data.employees : [parsed.data]

    // Per-call cap on total entries across all employees.
    const totalEntries = slices.reduce((s, x) => s + x.entries.length, 0)
    if (totalEntries > MAX_TOTAL_ENTRIES) {
      return jsonError(
        413,
        'too_many_entries',
        `Total entries across all employees must be ≤ ${MAX_TOTAL_ENTRIES} per call (got ${totalEntries}).`,
      )
    }

    // Resolve every employee_code → id in one round-trip.
    const codes = Array.from(new Set(slices.map((s) => s.employee_code)))
    const admin = createAdminClient()
    const { data: empRows, error: empErr } = await admin
      .from('employees')
      .select('id, employee_code, employment_status')
      .in('employee_code', codes)
    if (empErr) return jsonError(500, 'db_error', empErr.message)
    const empByCode = new Map(
      (empRows ?? []).map((e) => [e.employee_code as string, { id: e.id as string, status: e.employment_status as string }]),
    )

    type SliceResult = {
      employee_code: string
      employee_found: boolean
      week_status: string | null
      created: number
      skipped: Array<{ row: number; reason: string }>
      weeks_touched: string[]
      total_submitted: number
    }

    const results: SliceResult[] = []

    for (const slice of slices) {
      const emp = empByCode.get(slice.employee_code)
      if (!emp) {
        results.push({
          employee_code: slice.employee_code,
          employee_found: false,
          week_status: slice.week_status ?? null,
          created: 0,
          skipped: [{ row: 0, reason: `No employee with code "${slice.employee_code}"` }],
          weeks_touched: [],
          total_submitted: slice.entries.length,
        })
        continue
      }

      const rows: TimesheetBulkRow[] = slice.entries.map((e) => ({
        entry_date:    e.entry_date,
        project_code:  e.project_code,
        activity_code: e.activity_code,
        task:          e.task ?? undefined,
        description:   e.description ?? undefined,
        hours:         e.hours ?? undefined,
        start_time:    e.start_time ?? undefined,
        end_time:      e.end_time ?? undefined,
        work_mode:     e.work_mode ?? undefined,
      }))

      const result = await bulkCreateTimesheetEntries({
        employeeId: emp.id,
        rows,
        weekStatus: slice.week_status,
      })

      results.push({
        employee_code: slice.employee_code,
        employee_found: true,
        week_status: slice.week_status ?? null,
        created: result.created,
        skipped: result.skipped,
        weeks_touched: result.weeksTouched,
        total_submitted: rows.length,
      })
    }

    const totals = {
      created: results.reduce((s, r) => s + r.created, 0),
      skipped: results.reduce((s, r) => s + r.skipped.length, 0),
      submitted: results.reduce((s, r) => s + r.total_submitted, 0),
      employees_succeeded: results.filter((r) => r.created > 0).length,
      employees_failed: results.filter((r) => !r.employee_found || (r.created === 0 && r.skipped.length > 0)).length,
    }

    return jsonOk(
      { employees: results, totals },
      { status: totals.created > 0 ? 201 : 200 },
    )
  } catch (err) {
    return errorResponse(err)
  }
}

// -----------------------------------------------------------------------------
// GET — list timesheet entries
// -----------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    await requireApiScope(request, 'timesheet:read')

    const url = new URL(request.url)
    const employee_code = url.searchParams.get('employee_code')?.trim()
    const from = url.searchParams.get('from')?.trim()
    const to = url.searchParams.get('to')?.trim()
    const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit') ?? 100)))
    const offset = Math.max(0, Number(url.searchParams.get('offset') ?? 0))

    if (!employee_code) return jsonError(400, 'missing_employee_code', 'employee_code is required.')
    if (from && !ISO_DATE.test(from)) return jsonError(400, 'invalid_from', 'from must be YYYY-MM-DD.')
    if (to && !ISO_DATE.test(to)) return jsonError(400, 'invalid_to', 'to must be YYYY-MM-DD.')

    const admin = createAdminClient()
    const { data: emp, error: empErr } = await admin
      .from('employees')
      .select('id, employee_code, full_name_snapshot')
      .eq('employee_code', employee_code)
      .maybeSingle()
    if (empErr) return jsonError(500, 'db_error', empErr.message)
    if (!emp) return jsonError(404, 'employee_not_found', `No employee with code "${employee_code}".`)

    let q = admin
      .from('timesheet_entries')
      .select(`
        id, entry_date, hours, task, description, work_mode, source, start_at, end_at, created_at,
        project:projects!inner(code, name),
        activity:activity_types!inner(code, name)
      `, { count: 'exact' })
      .eq('employee_id', emp.id as string)
      .order('entry_date', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + limit - 1)
    if (from) q = q.gte('entry_date', from)
    if (to)   q = q.lte('entry_date', to)

    const { data, count, error } = await q
    if (error) return jsonError(500, 'db_error', error.message)

    type Embed<T> = T | T[] | null
    type Row = {
      id: string; entry_date: string; hours: number; task: string | null
      description: string | null; work_mode: 'WFH' | 'WFO'; source: string
      start_at: string | null; end_at: string | null; created_at: string
      project: Embed<{ code: string; name: string }>
      activity: Embed<{ code: string; name: string }>
    }
    const unwrap = <T,>(v: Embed<T>): T | null => Array.isArray(v) ? v[0] ?? null : v

    return jsonOk(
      ((data ?? []) as unknown as Row[]).map((r) => {
        const proj = unwrap(r.project)
        const act = unwrap(r.activity)
        return {
          id: r.id,
          employee_code: emp.employee_code,
          entry_date: r.entry_date,
          project_code: proj?.code ?? null,
          project_name: proj?.name ?? null,
          activity_code: act?.code ?? null,
          activity_name: act?.name ?? null,
          task: r.task,
          description: r.description,
          hours: Number(r.hours),
          start_at: r.start_at,
          end_at: r.end_at,
          work_mode: r.work_mode,
          source: r.source,
          created_at: r.created_at,
        }
      }),
      { meta: { total: count ?? 0, limit, offset, employee_code: emp.employee_code } },
    )
  } catch (err) {
    return errorResponse(err)
  }
}
