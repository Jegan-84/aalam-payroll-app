import 'server-only'
import { createClient } from '@/lib/supabase/server'

// -----------------------------------------------------------------------------
// Upcoming holidays
// -----------------------------------------------------------------------------
export type UpcomingHoliday = {
  holiday_date: string
  name: string
  type: 'public' | 'restricted' | 'optional'
  scope: string  // human-readable: "All", "project: ACME", "loc: CHE", etc.
  daysAway: number
}

export async function getUpcomingHolidays(opts: {
  employeeId?: string  // when set, project + location filter; otherwise org-wide
  windowDays?: number
  limit?: number
} = {}): Promise<UpcomingHoliday[]> {
  const windowDays = opts.windowDays ?? 90
  const limit = opts.limit ?? 5
  const supabase = await createClient()

  const today = new Date()
  const todayIso = today.toISOString().slice(0, 10)
  const horizon = new Date(today.getTime() + windowDays * 86_400_000).toISOString().slice(0, 10)

  let primaryProjectId: number | null = null
  let locationId: number | null = null
  if (opts.employeeId) {
    const { data: emp } = await supabase
      .from('employees')
      .select('primary_project_id, location_id')
      .eq('id', opts.employeeId)
      .maybeSingle()
    primaryProjectId = (emp?.primary_project_id as number | null | undefined) ?? null
    locationId = (emp?.location_id as number | null | undefined) ?? null
  }

  let q = supabase
    .from('holidays')
    .select('holiday_date, name, type, project_id, location_id, projects:project_id(code), locations:location_id(code)')
    .gte('holiday_date', todayIso)
    .lte('holiday_date', horizon)
    .order('holiday_date')
    .limit(limit * 4)  // pull extra in case multiple rows share a date

  if (opts.employeeId) {
    // Project axis: null OR matches primary project.
    q = primaryProjectId == null
      ? q.is('project_id', null)
      : q.or(`project_id.is.null,project_id.eq.${primaryProjectId}`)
    // Location axis: null OR matches employee location.
    q = locationId == null
      ? q.is('location_id', null)
      : q.or(`location_id.is.null,location_id.eq.${locationId}`)
  }

  const { data } = await q
  const rows = (data ?? []) as unknown as Array<{
    holiday_date: string; name: string; type: 'public' | 'restricted' | 'optional'
    project_id: number | null; location_id: number | null
    projects: { code: string } | null
    locations: { code: string } | null
  }>

  // Dedupe by date (in case org-wide view returns multiple project/location rows for same date).
  const seen = new Set<string>()
  const out: UpcomingHoliday[] = []
  for (const r of rows) {
    if (seen.has(r.holiday_date)) continue
    seen.add(r.holiday_date)
    const bits: string[] = []
    if (r.projects?.code) bits.push(`project: ${r.projects.code}`)
    if (r.locations?.code) bits.push(`loc: ${r.locations.code}`)
    const scope = bits.length === 0 ? 'All' : bits.join(' · ')
    const daysAway = Math.round((new Date(r.holiday_date + 'T00:00:00Z').getTime() - new Date(todayIso + 'T00:00:00Z').getTime()) / 86_400_000)
    out.push({ holiday_date: r.holiday_date, name: r.name, type: r.type, scope, daysAway })
    if (out.length >= limit) break
  }
  return out
}

// -----------------------------------------------------------------------------
// Upcoming birthdays — DOB ignoring year. Wraps across year boundary.
// -----------------------------------------------------------------------------
export type UpcomingBirthday = {
  employee_id: string
  employee_code: string
  full_name_snapshot: string
  date_of_birth: string  // YYYY-MM-DD (original)
  birthdayThisYear: string  // resolved YYYY-MM-DD for the next occurrence
  daysAway: number
}

export async function getUpcomingBirthdays(opts: {
  windowDays?: number
  limit?: number
} = {}): Promise<UpcomingBirthday[]> {
  const windowDays = opts.windowDays ?? 30
  const limit = opts.limit ?? 5
  const supabase = await createClient()

  const { data } = await supabase
    .from('employees')
    .select('id, employee_code, full_name_snapshot, date_of_birth')
    .eq('employment_status', 'active')
    .not('date_of_birth', 'is', null)

  const rows = (data ?? []) as unknown as Array<{
    id: string; employee_code: string; full_name_snapshot: string; date_of_birth: string
  }>

  const today = new Date()
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  const out: UpcomingBirthday[] = []

  for (const r of rows) {
    const dob = new Date(r.date_of_birth + 'T00:00:00Z')
    let next = new Date(Date.UTC(todayUtc.getUTCFullYear(), dob.getUTCMonth(), dob.getUTCDate()))
    if (next.getTime() < todayUtc.getTime()) {
      next = new Date(Date.UTC(todayUtc.getUTCFullYear() + 1, dob.getUTCMonth(), dob.getUTCDate()))
    }
    const daysAway = Math.round((next.getTime() - todayUtc.getTime()) / 86_400_000)
    if (daysAway <= windowDays) {
      out.push({
        employee_id: r.id,
        employee_code: r.employee_code,
        full_name_snapshot: r.full_name_snapshot,
        date_of_birth: r.date_of_birth,
        birthdayThisYear: next.toISOString().slice(0, 10),
        daysAway,
      })
    }
  }

  out.sort((a, b) => a.daysAway - b.daysAway)
  return out.slice(0, limit)
}

// -----------------------------------------------------------------------------
// Expiring comp-off — active grants within N days of expiry for one employee.
// -----------------------------------------------------------------------------
export type ExpiringCompOff = {
  id: string
  work_date: string
  granted_days: number
  expires_on: string
  daysLeft: number
}

export async function getExpiringCompOff(
  employeeId: string,
  withinDays = 14,
): Promise<ExpiringCompOff[]> {
  const supabase = await createClient()
  const today = new Date()
  const todayIso = today.toISOString().slice(0, 10)
  const horizon = new Date(today.getTime() + withinDays * 86_400_000).toISOString().slice(0, 10)

  const { data } = await supabase
    .from('comp_off_grants')
    .select('id, work_date, granted_days, expires_on')
    .eq('employee_id', employeeId)
    .eq('status', 'active')
    .gte('expires_on', todayIso)
    .lte('expires_on', horizon)
    .order('expires_on')

  const rows = (data ?? []) as unknown as Array<{
    id: string; work_date: string; granted_days: number; expires_on: string
  }>

  return rows.map((r) => {
    const daysLeft = Math.round(
      (new Date(r.expires_on + 'T00:00:00Z').getTime() - new Date(todayIso + 'T00:00:00Z').getTime()) / 86_400_000,
    )
    return { id: r.id, work_date: r.work_date, granted_days: Number(r.granted_days), expires_on: r.expires_on, daysLeft }
  })
}
