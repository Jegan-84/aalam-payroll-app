import Link from 'next/link'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type {
  UpcomingHoliday,
  UpcomingBirthday,
  ExpiringCompOff,
} from '@/lib/dashboard/queries'

const TYPE_TONE: Record<UpcomingHoliday['type'], 'brand' | 'warn' | 'neutral'> = {
  public:     'brand',
  restricted: 'warn',
  optional:   'neutral',
}

function dayLabel(date: string): string {
  return new Date(date + 'T00:00:00Z').toLocaleDateString('en-IN', {
    weekday: 'short', timeZone: 'UTC',
  })
}

function relative(daysAway: number): string {
  if (daysAway === 0) return 'today'
  if (daysAway === 1) return 'tomorrow'
  return `in ${daysAway} days`
}

// -----------------------------------------------------------------------------
export function UpcomingHolidaysCard({
  holidays, viewAllHref,
}: { holidays: UpcomingHoliday[]; viewAllHref?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming holidays</CardTitle>
      </CardHeader>
      <CardBody className="p-0">
        {holidays.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-500">No holidays in the next 90 days.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {holidays.map((h) => (
              <li key={h.holiday_date + h.name} className="flex items-center gap-3 px-4 py-2.5">
                <div className="w-12 shrink-0 text-center">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    {new Date(h.holiday_date + 'T00:00:00Z').toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' })}
                  </div>
                  <div className="text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                    {Number(h.holiday_date.slice(8))}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{h.name}</div>
                  <div className="text-[11px] text-slate-500">
                    {dayLabel(h.holiday_date)} · {relative(h.daysAway)} · {h.scope}
                  </div>
                </div>
                <Badge tone={TYPE_TONE[h.type]}>{h.type}</Badge>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
      {viewAllHref && (
        <div className="border-t border-slate-100 px-4 py-2 text-right dark:border-slate-800">
          <Link href={viewAllHref} className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-400">
            View full calendar →
          </Link>
        </div>
      )}
    </Card>
  )
}

// -----------------------------------------------------------------------------
export function UpcomingBirthdaysCard({
  birthdays, viewerEmployeeId,
}: { birthdays: UpcomingBirthday[]; viewerEmployeeId?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming birthdays</CardTitle>
      </CardHeader>
      <CardBody className="p-0">
        {birthdays.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-500">No birthdays coming up.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {birthdays.map((b) => {
              const isMe = viewerEmployeeId && b.employee_id === viewerEmployeeId
              return (
                <li key={b.employee_id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pink-100 text-base dark:bg-pink-900/30">
                    🎂
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                      {b.full_name_snapshot}{isMe && <span className="ml-1 text-xs text-slate-500">(you)</span>}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {b.employee_code} · {new Date(b.birthdayThisYear + 'T00:00:00Z').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'UTC' })} · {relative(b.daysAway)}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  )
}

// -----------------------------------------------------------------------------
export function ExpiringCompOffCard({
  grants, applyHref,
}: { grants: ExpiringCompOff[]; applyHref: string }) {
  if (grants.length === 0) return null  // hide when nothing's expiring

  const urgent = grants.some((g) => g.daysLeft <= 3)

  return (
    <Card className={urgent ? 'border-red-300 dark:border-red-900' : 'border-amber-300 dark:border-amber-900'}>
      <CardHeader>
        <CardTitle>
          {urgent ? '⚠️ Comp Off expiring soon' : 'Comp Off expiring'}
        </CardTitle>
      </CardHeader>
      <CardBody className="p-0">
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {grants.map((g) => (
            <li key={g.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {Number(g.granted_days).toFixed(1)} day{g.granted_days === 1 ? '' : 's'} from {g.work_date}
                </div>
                <div className="text-[11px] text-slate-500">
                  Expires {g.expires_on} · {g.daysLeft === 0 ? 'today' : g.daysLeft === 1 ? 'tomorrow' : `in ${g.daysLeft} days`}
                </div>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                g.daysLeft <= 3
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
              }`}>
                {g.daysLeft <= 3 ? 'urgent' : 'soon'}
              </span>
            </li>
          ))}
        </ul>
      </CardBody>
      <div className="border-t border-slate-100 px-4 py-2 text-right dark:border-slate-800">
        <Link href={applyHref} className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-400">
          Apply COMP_OFF leave →
        </Link>
      </div>
    </Card>
  )
}
