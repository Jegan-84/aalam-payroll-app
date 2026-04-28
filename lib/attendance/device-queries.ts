import 'server-only'
import { createClient } from '@/lib/supabase/server'

export type PunchRow = {
  device_id: string
  biometric_user_id: string
  employee_id: string | null
  punch_time: string
}

// Per-employee, per-day summary derived from raw punches. First IN = earliest
// punch of the day, last OUT = latest punch. Hours = OUT - IN.
export type DaySummaryRow = {
  date: string  // YYYY-MM-DD (UTC)
  employeeId: string | null
  employeeCode: string
  employeeName: string
  biometricUserId: string
  firstIn: string | null   // ISO
  lastOut: string | null   // ISO
  punchCount: number
  hoursWorked: number | null  // 0..24
}

// Flat, chronological log of every punch for one calendar day.
export type DayPunchRow = {
  punchTime: string         // ISO
  deviceId: string
  biometricUserId: string
  employeeId: string | null
  employeeCode: string
  employeeName: string
}

export async function getDailyDeviceSummary(date: string): Promise<DaySummaryRow[]> {
  const supabase = await createClient()

  // Window: 00:00:00 UTC ... 23:59:59 UTC of the chosen calendar date.
  const startIso = `${date}T00:00:00.000Z`
  const endIso = `${date}T23:59:59.999Z`

  const { data, error } = await supabase
    .from('device_punches')
    .select('device_id, biometric_user_id, employee_id, punch_time, employee:employees(id, employee_code, full_name_snapshot)')
    .gte('punch_time', startIso)
    .lte('punch_time', endIso)
    .order('punch_time')
  if (error) throw new Error(error.message)

  type Row = {
    device_id: string
    biometric_user_id: string
    employee_id: string | null
    punch_time: string
    employee: { id: string; employee_code: string; full_name_snapshot: string } | { id: string; employee_code: string; full_name_snapshot: string }[] | null
  }
  const rows = (data ?? []) as unknown as Row[]

  // Bucket by employee or, for unknown punches, by biometric_user_id.
  const buckets = new Map<string, {
    employeeId: string | null
    employeeCode: string
    employeeName: string
    biometricUserId: string
    times: string[]
  }>()

  for (const r of rows) {
    const emp = Array.isArray(r.employee) ? r.employee[0] : r.employee
    const key = r.employee_id ?? `unknown:${r.biometric_user_id}`
    if (!buckets.has(key)) {
      buckets.set(key, {
        employeeId: r.employee_id,
        employeeCode: emp?.employee_code ?? '—',
        employeeName: emp?.full_name_snapshot ?? `(unknown · ${r.biometric_user_id})`,
        biometricUserId: r.biometric_user_id,
        times: [],
      })
    }
    buckets.get(key)!.times.push(r.punch_time)
  }

  const out: DaySummaryRow[] = []
  for (const b of buckets.values()) {
    const sorted = [...b.times].sort()
    const firstIn = sorted[0] ?? null
    const lastOut = sorted.length > 1 ? sorted[sorted.length - 1] : null
    const hoursWorked = firstIn && lastOut
      ? Math.round((new Date(lastOut).getTime() - new Date(firstIn).getTime()) / 3_600_000 * 100) / 100
      : null
    out.push({
      date,
      employeeId: b.employeeId,
      employeeCode: b.employeeCode,
      employeeName: b.employeeName,
      biometricUserId: b.biometricUserId,
      firstIn,
      lastOut,
      punchCount: b.times.length,
      hoursWorked,
    })
  }

  out.sort((a, b) => a.employeeName.localeCompare(b.employeeName))
  return out
}

// Distinct biometric_user_ids that appeared in the day's punches but have no
// matching employee. Admin can use this to fix mappings on the employee form.
export type UnmappedDeviceUser = {
  biometricUserId: string
  deviceId: string
  punchCount: number
  firstSeen: string  // ISO
}

export async function getUnmappedDeviceUsers(date: string): Promise<UnmappedDeviceUser[]> {
  const supabase = await createClient()
  const startIso = `${date}T00:00:00.000Z`
  const endIso   = `${date}T23:59:59.999Z`

  const { data, error } = await supabase
    .from('device_punches')
    .select('device_id, biometric_user_id, punch_time')
    .is('employee_id', null)
    .gte('punch_time', startIso)
    .lte('punch_time', endIso)
    .order('punch_time', { ascending: true })
  if (error) throw new Error(error.message)

  const rows = (data ?? []) as Array<{ device_id: string; biometric_user_id: string; punch_time: string }>
  const buckets = new Map<string, UnmappedDeviceUser>()
  for (const r of rows) {
    const key = `${r.device_id}:${r.biometric_user_id}`
    const existing = buckets.get(key)
    if (existing) {
      existing.punchCount++
    } else {
      buckets.set(key, {
        biometricUserId: r.biometric_user_id,
        deviceId: r.device_id,
        punchCount: 1,
        firstSeen: r.punch_time,
      })
    }
  }
  return Array.from(buckets.values()).sort((a, b) => b.punchCount - a.punchCount)
}

// Flat punch log for one calendar day — chronological. Used by the admin view
// to see exactly when each person came in / went out / re-punched.
export async function getDailyPunchLog(date: string): Promise<DayPunchRow[]> {
  const supabase = await createClient()
  const startIso = `${date}T00:00:00.000Z`
  const endIso   = `${date}T23:59:59.999Z`

  const { data, error } = await supabase
    .from('device_punches')
    .select('device_id, biometric_user_id, employee_id, punch_time, employee:employees(employee_code, full_name_snapshot)')
    .gte('punch_time', startIso)
    .lte('punch_time', endIso)
    .order('punch_time', { ascending: true })
  if (error) throw new Error(error.message)

  type Row = {
    device_id: string
    biometric_user_id: string
    employee_id: string | null
    punch_time: string
    employee: { employee_code: string; full_name_snapshot: string } | { employee_code: string; full_name_snapshot: string }[] | null
  }
  const rows = (data ?? []) as unknown as Row[]

  return rows.map((r) => {
    const emp = Array.isArray(r.employee) ? r.employee[0] : r.employee
    return {
      punchTime: r.punch_time,
      deviceId: r.device_id,
      biometricUserId: r.biometric_user_id,
      employeeId: r.employee_id,
      employeeCode: emp?.employee_code ?? '—',
      employeeName: emp?.full_name_snapshot ?? `(unmapped · ${r.biometric_user_id})`,
    }
  })
}
