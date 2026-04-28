import Link from 'next/link'
import { getCurrentEmployee } from '@/lib/auth/dal'
import { getEmployeeWeek, type WeekDayRow } from '@/lib/attendance/week-queries'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'

export const metadata = { title: 'My attendance' }

type SP = Promise<{ week?: string }>

export default async function MyAttendancePage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams
  const { employeeId } = await getCurrentEmployee()
  const week = await getEmployeeWeek(employeeId, sp.week ?? '')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance"
        subtitle={`Punches synced from the office biometric device.`}
      />

      <div className="flex items-center justify-center gap-4 rounded-lg border border-slate-200 bg-white py-2 dark:border-slate-800 dark:bg-slate-900">
        <Link
          href={`/me/attendance?week=${week.prevAnchor}`}
          className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800"
          aria-label="Previous week"
        >
          ‹
        </Link>
        <div className="text-sm font-medium tabular-nums text-slate-900 dark:text-slate-50">
          {week.rangeLabel}
        </div>
        <Link
          href={`/me/attendance?week=${week.nextAnchor}`}
          className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800"
          aria-label="Next week"
        >
          ›
        </Link>
        {week.rangeFrom > week.todayIso || week.rangeTo < week.todayIso ? (
          <Link
            href="/me/attendance"
            className="ml-2 text-xs font-medium text-brand-700 hover:underline dark:text-brand-400"
          >
            This week
          </Link>
        ) : null}
      </div>

      <Card className="overflow-hidden p-0">
        <ul>
          {week.rows.map((r, i) => (
            <li
              key={r.date}
              className={`grid grid-cols-[64px_110px_1fr_110px_120px] items-center gap-3 px-4 py-3 sm:px-6 ${
                i < week.rows.length - 1 ? 'border-b border-slate-100 dark:border-slate-800' : ''
              }`}
            >
              <DateCell row={r} />
              <TimeCell time={r.firstIn} fallback={r.status === 'absent' ? '00:00' : '—'} />
              <Timeline row={r} />
              <TimeCell time={r.lastOut} fallback={r.status === 'absent' ? '00:00' : '—'} alignRight />
              <HoursCell hours={r.hoursWorked} status={r.status} />
            </li>
          ))}
        </ul>
      </Card>

      <p className="text-[11px] text-slate-500">
        Times shown in IST. &quot;Office-in&quot; = punched at the device. Status is computed from punches, holidays, and approved leave applications.
      </p>
    </div>
  )
}

function DateCell({ row }: { row: WeekDayRow }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-semibold leading-none tabular-nums text-slate-900 dark:text-slate-50">
        {row.dayNumber}
      </div>
      <div className="mt-1 text-[10px] font-medium tracking-wide text-slate-500">{row.dayLabel}</div>
    </div>
  )
}

function TimeCell({ time, fallback, alignRight = false }: { time: string | null; fallback: string; alignRight?: boolean }) {
  return (
    <div className={`text-sm tabular-nums text-slate-700 dark:text-slate-200 ${alignRight ? 'text-right' : ''}`}>
      {time ? formatTime(time) : <span className="text-slate-400">{fallback}</span>}
    </div>
  )
}

function HoursCell({ hours, status }: { hours: number | null; status: WeekDayRow['status'] }) {
  if (status === 'weekend' || status === 'holiday' || status === 'leave') {
    return <div className="text-right text-xs text-slate-400">—</div>
  }
  return (
    <div className="text-right">
      <div className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-50">
        {hours != null ? `${formatHours(hours)}` : '00:00'}
      </div>
      <div className="text-[10px] text-slate-500">Hrs Worked</div>
    </div>
  )
}

function Timeline({ row }: { row: WeekDayRow }) {
  // Track + label colour by status, matching the reference screenshot.
  const tone: Record<WeekDayRow['status'], { track: string; dot: string; label: string }> = {
    present: {
      track: 'bg-emerald-300 dark:bg-emerald-700',
      dot:   'bg-emerald-500',
      label: 'border-emerald-300 bg-white text-slate-900 dark:border-emerald-800 dark:bg-slate-900 dark:text-slate-50',
    },
    absent: {
      track: 'bg-rose-300 dark:bg-rose-700',
      dot:   'bg-rose-500',
      label: 'border-rose-300 bg-white text-slate-900 dark:border-rose-800 dark:bg-slate-900 dark:text-slate-50',
    },
    weekend: {
      track: 'bg-amber-300 dark:bg-amber-700',
      dot:   'bg-amber-400',
      label: 'border-amber-300 bg-white text-slate-900 dark:border-amber-800 dark:bg-slate-900 dark:text-slate-50',
    },
    holiday: {
      track: 'bg-sky-300 dark:bg-sky-700',
      dot:   'bg-sky-500',
      label: 'border-sky-300 bg-white text-slate-900 dark:border-sky-800 dark:bg-slate-900 dark:text-slate-50',
    },
    leave: {
      track: 'bg-violet-300 dark:bg-violet-700',
      dot:   'bg-violet-500',
      label: 'border-violet-300 bg-white text-slate-900 dark:border-violet-800 dark:bg-slate-900 dark:text-slate-50',
    },
  }
  const t = tone[row.status]
  return (
    <div className="relative flex items-center">
      {/* outer ring dots (faint) */}
      <span className="h-2 w-2 rounded-full bg-slate-200 dark:bg-slate-700" aria-hidden />
      <span className={`mx-1 h-2.5 w-2.5 rounded-full ${t.dot}`} aria-hidden />
      <span className={`relative h-[2px] flex-1 ${t.track}`}>
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <span className={`inline-block whitespace-nowrap rounded-md border px-2.5 py-1 text-[11px] font-medium shadow-sm ${t.label}`}>
            {row.centerLabel}
          </span>
        </span>
      </span>
      <span className={`mx-1 h-2.5 w-2.5 rounded-full ${t.dot}`} aria-hidden />
      <span className="h-2 w-2 rounded-full bg-slate-200 dark:bg-slate-700" aria-hidden />
    </div>
  )
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
  })
}

function formatHours(hours: number): string {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
