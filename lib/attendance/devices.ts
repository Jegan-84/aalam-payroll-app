import 'server-only'
import ZKLib from 'node-zklib'

// -----------------------------------------------------------------------------
// Biometric devices — ESSL / ZKTeco family. For now the device list lives in
// env. Move to a master table in /settings/devices when we need per-device
// edits without a deploy.
//
// Env shape (BIOMETRIC_DEVICES):
//   JSON array of { id, ip, port?, timeout?, inport?, comm_key? }.
//   Single device example:
//     BIOMETRIC_DEVICES=[{"id":"2nd floor","ip":"192.168.2.3"}]
// -----------------------------------------------------------------------------

export type BiometricDevice = {
  id: string
  ip: string
  port: number
  timeout: number   // ms
  inport: number    // local UDP port for return packets; rarely needs tweaking
  commKey: number
}

export type DevicePunch = {
  device_id: string
  biometric_user_id: string
  punch_time: string  // ISO 8601, UTC
  raw_status: number | null
  raw_punch: number | null
}

const DEFAULTS = {
  port: 4370,
  timeout: 8000,
  inport: 5200,
  commKey: 0,
}

export function getConfiguredDevices(): BiometricDevice[] {
  const raw = process.env.BIOMETRIC_DEVICES?.trim()
  if (!raw) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('BIOMETRIC_DEVICES is not valid JSON. Expected: [{"id":"...","ip":"..."}]')
  }
  if (!Array.isArray(parsed)) throw new Error('BIOMETRIC_DEVICES must be a JSON array')

  return parsed.map((d, idx) => {
    const dev = d as Partial<BiometricDevice> & { ip?: string }
    if (!dev.id) throw new Error(`BIOMETRIC_DEVICES[${idx}] missing id`)
    if (!dev.ip) throw new Error(`BIOMETRIC_DEVICES[${idx}] missing ip`)
    return {
      id: String(dev.id),
      ip: String(dev.ip),
      port: Number(dev.port ?? DEFAULTS.port),
      timeout: Number(dev.timeout ?? DEFAULTS.timeout),
      inport: Number(dev.inport ?? DEFAULTS.inport),
      commKey: Number(dev.commKey ?? DEFAULTS.commKey),
    }
  })
}

// -----------------------------------------------------------------------------
// fetchDevicePunches — pulls all attendance records the device is currently
// holding. Uses node-zklib (ZKTeco/ESSL UDP/TCP protocol on port 4370).
// -----------------------------------------------------------------------------
export async function fetchDevicePunches(device: BiometricDevice): Promise<DevicePunch[]> {
  const zk = new ZKLib(device.ip, device.port, device.timeout, device.inport)

  try {
    await zk.createSocket()
  } catch (err) {
    const e = err as Error
    throw new Error(`Could not connect to device "${device.id}" at ${device.ip}:${device.port} — ${e.message}`)
  }

  try {
    const result = await zk.getAttendances() as { data: Array<{
      userSn?: number; deviceUserId: string | number; recordTime: Date | string; ip?: string;
    }> } | undefined

    const rows = result?.data ?? []
    return rows.map((r) => ({
      device_id: device.id,
      biometric_user_id: String(r.deviceUserId),
      punch_time: new Date(r.recordTime).toISOString(),
      raw_status: null,
      raw_punch: null,
    }))
  } finally {
    try { await zk.disconnect() } catch { /* ignore */ }
  }
}

// -----------------------------------------------------------------------------
// pingDevice — lightweight reachability check used by /settings/devices/test.
// -----------------------------------------------------------------------------
export async function pingDevice(device: BiometricDevice): Promise<{ ok: boolean; serial?: string; error?: string }> {
  const zk = new ZKLib(device.ip, device.port, device.timeout, device.inport)
  try {
    await zk.createSocket()
    const info = await zk.getInfo().catch(() => null) as { serialNumber?: string } | null
    return { ok: true, serial: info?.serialNumber }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  } finally {
    try { await zk.disconnect() } catch { /* ignore */ }
  }
}
