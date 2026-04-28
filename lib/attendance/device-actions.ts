'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/dal'
import {
  getConfiguredDevices,
  fetchDevicePunches,
  pingDevice,
  type DevicePunch,
} from '@/lib/attendance/devices'

export type SyncResult = {
  totalFetched: number
  inserted: number
  matched: number
  unknown: number
  perDevice: Array<{ id: string; ip: string; fetched: number; error?: string }>
}

// -----------------------------------------------------------------------------
// syncBiometricDevicesAction — pulls from every configured device, resolves
// biometric_user_id → employee_id via employees.biometric_id, and upserts
// into device_punches. Existing rows (same device + user + timestamp) are
// skipped silently.
// -----------------------------------------------------------------------------
export async function syncBiometricDevicesAction(): Promise<{ ok?: true; error?: string; result?: SyncResult }> {
  try {
    return await runSync()
  } catch (err) {
    return { error: (err as Error).message ?? 'Sync failed unexpectedly' }
  }
}

async function runSync(): Promise<{ ok?: true; error?: string; result?: SyncResult }> {
  const session = await requireRole('admin', 'hr', 'payroll')

  const devices = getConfiguredDevices()
  if (devices.length === 0) {
    return { error: 'No biometric devices configured. Set BIOMETRIC_DEVICES in .env.local.' }
  }

  const admin = createAdminClient()

  // Current calendar year window — anything outside it is dropped.
  const now = new Date()
  const yearStartMs = Date.UTC(now.getUTCFullYear(), 0, 1)
  const yearEndMs   = Date.UTC(now.getUTCFullYear() + 1, 0, 1) - 1

  // Build a map for biometric_user_id → employee_id once.
  const { data: empRows } = await admin
    .from('employees')
    .select('id, biometric_id')
    .not('biometric_id', 'is', null)
  const empByBio = new Map<string, string>()
  for (const e of empRows ?? []) {
    if (e.biometric_id) empByBio.set(String(e.biometric_id), e.id as string)
  }

  const result: SyncResult = {
    totalFetched: 0, inserted: 0, matched: 0, unknown: 0, perDevice: [],
  }

  const allPunches: Array<DevicePunch & { employee_id: string | null }> = []

  for (const dev of devices) {
    const perDev = { id: dev.id, ip: dev.ip, fetched: 0, error: undefined as string | undefined }
    try {
      const punches = await fetchDevicePunches(dev)
      perDev.fetched = punches.length
      result.totalFetched += punches.length
      for (const p of punches) {
        // Drop anything outside the current year.
        const ts = new Date(p.punch_time).getTime()
        if (Number.isNaN(ts) || ts < yearStartMs || ts > yearEndMs) continue
        // Keep both mapped and unmapped — the page surfaces unmapped IDs so
        // admin can fix them. employee_id is null when there's no mapping.
        const employeeId = empByBio.get(p.biometric_user_id) ?? null
        if (employeeId) result.matched++
        else result.unknown++
        allPunches.push({ ...p, employee_id: employeeId })
      }
    } catch (err) {
      perDev.error = (err as Error).message
    }
    result.perDevice.push(perDev)
  }

  // Wipe-and-reload: clear current-year rows so the table mirrors the latest
  // device state for active employees only. Older years (if any sneaked in
  // earlier) are left untouched in case someone wants the history.
  {
    const { error: delErr } = await admin
      .from('device_punches')
      .delete()
      .gte('punch_time', new Date(yearStartMs).toISOString())
      .lte('punch_time', new Date(yearEndMs).toISOString())
    if (delErr) return { error: `Could not clear existing punches: ${delErr.message}` }
  }

  if (allPunches.length > 0) {
    // Plain insert (table is empty for the year now). Conflict-on-duplicate
    // would be redundant since we just wiped, but keep ignoreDuplicates as a
    // belt-and-braces against same-timestamp duplicates within the pull.
    const CHUNK = 500
    for (let i = 0; i < allPunches.length; i += CHUNK) {
      const chunk = allPunches.slice(i, i + CHUNK)
      const { error, count } = await admin
        .from('device_punches')
        .upsert(chunk, {
          onConflict: 'device_id,biometric_user_id,punch_time',
          ignoreDuplicates: true,
          count: 'exact',
        })
      if (error) return { error: error.message }
      result.inserted += count ?? 0
    }
  }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'attendance.device_sync',
    entity_type: 'device_punches',
    entity_id: String(result.inserted),
    summary:
      `Synced ${devices.length} device(s): fetched ${result.totalFetched}, inserted ${result.inserted}`
      + ` (${result.matched} matched, ${result.unknown} unknown).`
      + (result.perDevice.some((d) => d.error)
        ? ` Errors: ${result.perDevice.filter((d) => d.error).map((d) => `${d.id}:${d.error}`).join('; ')}`
        : ''),
  })

  revalidatePath('/attendance/punches')
  return { ok: true, result }
}

// -----------------------------------------------------------------------------
// pingBiometricDevicesAction — quick reachability test for the configured list.
// -----------------------------------------------------------------------------
export async function pingBiometricDevicesAction(): Promise<{
  results: Array<{ id: string; ip: string; ok: boolean; serial?: string; error?: string }>
}> {
  await requireRole('admin', 'hr', 'payroll')
  const devices = getConfiguredDevices()
  const results = await Promise.all(
    devices.map(async (d) => ({ id: d.id, ip: d.ip, ...(await pingDevice(d)) })),
  )
  return { results }
}
