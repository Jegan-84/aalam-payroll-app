import Link from 'next/link'
import {
  getDailyDeviceSummary,
  getDailyPunchLog,
  getUnmappedDeviceUsers,
} from '@/lib/attendance/device-queries'
import { getConfiguredDevices } from '@/lib/attendance/devices'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SyncDevicesButton } from './_components/sync-devices-button'
import { DateNav } from './_components/date-nav'

export const metadata = { title: 'Biometric punches' }

type SP = Promise<{ date?: string }>

export default async function PunchesPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams
  const today = new Date()
  const todayIso = today.toISOString().slice(0, 10)
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : todayIso
  const dateAsDate = new Date(date + 'T00:00:00Z')
  const prevDate = new Date(dateAsDate.getTime() - 86_400_000).toISOString().slice(0, 10)
  const nextDate = new Date(dateAsDate.getTime() + 86_400_000).toISOString().slice(0, 10)
  const humanLabel = dateAsDate.toLocaleDateString('en-IN', {
    weekday: 'long', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
  })

  const devices = getConfiguredDevices()
  const [summary, punchLog, unmapped] = await Promise.all([
    getDailyDeviceSummary(date),
    getDailyPunchLog(date),
    getUnmappedDeviceUsers(date),
  ])

  // Derive IN/OUT direction by alternating per-employee, in chronological
  // order — matches how Zoho People displays the punch log when the device
  // doesn't report a direction flag.
  const directionByPunch = new Map<string, 'IN' | 'OUT'>()
  const seqByEmp = new Map<string, number>()
  for (const p of punchLog) {
    const empKey = p.employeeId ?? `bio:${p.biometricUserId}`
    const idx = (seqByEmp.get(empKey) ?? 0)
    seqByEmp.set(empKey, idx + 1)
    directionByPunch.set(`${p.deviceId}:${p.biometricUserId}:${p.punchTime}`, idx % 2 === 0 ? 'IN' : 'OUT')
  }

  const present = summary.filter((r) => r.firstIn).length
  const incomplete = summary.filter((r) => r.firstIn && !r.lastOut).length
  const unknown = summary.filter((r) => !r.employeeId).length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Biometric punches"
        back={{ href: '/attendance', label: 'Attendance' }}
        subtitle={
          devices.length === 0
            ? 'No biometric devices configured. Set BIOMETRIC_DEVICES in .env.local.'
            : `Pulling from ${devices.length} device(s) on the office network. Sync to refresh today's data.`
        }
        actions={<SyncDevicesButton hasDevices={devices.length > 0} />}
      />

      <DateNav
        date={date}
        todayIso={todayIso}
        humanLabel={humanLabel}
        prevDate={prevDate}
        nextDate={nextDate}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Punched in" value={present} tone="brand" />
        <Stat label="Incomplete (no OUT)" value={incomplete} tone={incomplete > 0 ? 'warn' : 'neutral'} />
        <Stat label="Unknown user IDs" value={unknown} tone={unknown > 0 ? 'danger' : 'neutral'} />
        <Stat label="Total punches" value={summary.reduce((s, r) => s + r.punchCount, 0)} tone="neutral" />
      </div>

      {unmapped.length > 0 && (
        <Card className="border-amber-300 dark:border-amber-900">
          <div className="px-4 py-3">
            <div className="mb-1 text-sm font-semibold text-amber-900 dark:text-amber-200">
              ⚠ {unmapped.length} unmapped device user{unmapped.length === 1 ? '' : 's'} on {date}
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              These device IDs punched today but aren&apos;t mapped to any employee. Open the matching employee record and set their <code>biometric_id</code> in Statutory IDs to claim the punches. Re-sync isn&apos;t required — once you save the mapping it&apos;ll resolve on the next sync.
            </p>
          </div>
          <div className="overflow-x-auto border-t border-amber-200 dark:border-amber-900">
            <table className="min-w-full divide-y divide-amber-100 dark:divide-amber-900">
              <thead className="bg-amber-50/60 text-left text-[11px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                <tr>
                  <th className="px-4 py-2">Bio ID</th>
                  <th className="px-4 py-2">Device</th>
                  <th className="px-4 py-2">First seen</th>
                  <th className="px-4 py-2 text-right">Punches</th>
                  <th className="px-4 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100 text-sm dark:divide-amber-900">
                {unmapped.map((u) => (
                  <tr key={`${u.deviceId}:${u.biometricUserId}`}>
                    <td className="px-4 py-2 tabular-nums font-mono text-xs">{u.biometricUserId}</td>
                    <td className="px-4 py-2 text-xs text-slate-600 dark:text-slate-300">{u.deviceId}</td>
                    <td className="px-4 py-2 tabular-nums text-xs text-slate-600 dark:text-slate-300">{formatTime(u.firstSeen)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{u.punchCount}</td>
                    <td className="px-4 py-2 text-right">
                      <Link href="/employees" className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-400">
                        Open Employees →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        {summary.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">
            No punches on {date}.{' '}
            {devices.length > 0 && <>Click <span className="font-medium">Sync now</span> to pull from devices.</>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
              <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Check-in</th>
                  <th className="px-4 py-3">Check-out</th>
                  <th className="px-4 py-3 text-right">Hours</th>
                  <th className="px-4 py-3 text-right">Punches</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
                {summary.map((r) => {
                  const status: { label: string; tone: 'brand' | 'warn' | 'danger' | 'neutral' } =
                    !r.employeeId
                      ? { label: 'Unknown', tone: 'danger' }
                      : !r.lastOut
                        ? { label: 'Incomplete', tone: 'warn' }
                        : (r.hoursWorked ?? 0) < 4
                          ? { label: 'Short day', tone: 'warn' }
                          : { label: 'Present', tone: 'brand' }
                  return (
                    <tr key={`${r.employeeId ?? r.biometricUserId}`}>
                      <td className="px-4 py-3">
                        {r.employeeId ? (
                          <Link href={`/employees/${r.employeeId}`} className="text-slate-900 hover:text-brand-700 dark:text-slate-100">
                            <span className="font-medium">{r.employeeName}</span>
                            <span className="ml-2 text-xs text-slate-500">{r.employeeCode}</span>
                          </Link>
                        ) : (
                          <span className="text-slate-700 dark:text-slate-200">
                            <span className="italic">Unmapped device user</span>
                            <span className="ml-2 text-xs text-slate-500">id: {r.biometricUserId}</span>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-emerald-700 dark:text-emerald-400">
                        {r.firstIn ? formatTime(r.firstIn) : '—'}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-rose-700 dark:text-rose-400">
                        {r.lastOut ? formatTime(r.lastOut) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {r.hoursWorked != null ? r.hoursWorked.toFixed(2) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-500">{r.punchCount}</td>
                      <td className="px-4 py-3"><Badge tone={status.tone}>{status.label}</Badge></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Full chronological log — admin / HR view of every individual punch */}
      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">All punches today</div>
            <div className="text-[11px] text-slate-500">{punchLog.length} event(s) · chronological · earliest first</div>
          </div>
        </div>
        {punchLog.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-slate-500">No raw punches.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
              <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2.5">Time</th>
                  <th className="px-4 py-2.5">Direction</th>
                  <th className="px-4 py-2.5">Employee</th>
                  <th className="px-4 py-2.5">Device</th>
                  <th className="px-4 py-2.5">Bio ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
                {punchLog.map((p) => {
                  const dir = directionByPunch.get(`${p.deviceId}:${p.biometricUserId}:${p.punchTime}`) ?? 'IN'
                  return (
                    <tr key={`${p.deviceId}:${p.biometricUserId}:${p.punchTime}`}>
                      <td className="px-4 py-2 tabular-nums text-slate-700 dark:text-slate-200">{formatTime(p.punchTime)}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                          dir === 'IN'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200'
                        }`}>
                          {dir}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        {p.employeeId ? (
                          <Link href={`/employees/${p.employeeId}`} className="text-slate-900 hover:text-brand-700 dark:text-slate-100">
                            <span className="font-medium">{p.employeeName}</span>
                            <span className="ml-2 text-xs text-slate-500">{p.employeeCode}</span>
                          </Link>
                        ) : (
                          <span className="italic text-slate-700 dark:text-slate-200">{p.employeeName}</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-500">{p.deviceId}</td>
                      <td className="px-4 py-2 text-xs text-slate-500 tabular-nums">{p.biometricUserId}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="text-[11px] text-slate-500">
        Times shown in IST. Direction inferred by alternating IN / OUT per employee in chronological order — matches Zoho People&apos;s default behaviour for devices that don&apos;t report it.
      </p>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'brand' | 'warn' | 'danger' | 'neutral' }) {
  const toneCls: Record<typeof tone, string> = {
    brand:   'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200',
    warn:    'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200',
    danger:  'border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200',
    neutral: 'border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100',
  }
  return (
    <div className={`rounded-lg border p-3 ${toneCls[tone]}`}>
      <div className="text-[11px] font-medium uppercase tracking-wide opacity-75">{label}</div>
      <div className="mt-0.5 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  )
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
  })
}
