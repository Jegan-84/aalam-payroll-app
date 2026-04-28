import Link from 'next/link'

type Props = {
  date: string
  todayIso: string
  humanLabel: string
  prevDate: string
  nextDate: string
}

export function DateNav({ date, todayIso, humanLabel, prevDate, nextDate }: Props) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
      <Link href={`/attendance/punches?date=${prevDate}`} className="text-sm font-medium text-slate-600 hover:text-brand-700 dark:text-slate-300">
        ← {prevDate}
      </Link>
      <div className="flex items-center gap-3">
        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{humanLabel}</div>
        {date !== todayIso && (
          <Link href={`/attendance/punches?date=${todayIso}`} className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-400">
            Today
          </Link>
        )}
      </div>
      <Link href={`/attendance/punches?date=${nextDate}`} className="text-sm font-medium text-slate-600 hover:text-brand-700 dark:text-slate-300">
        {nextDate} →
      </Link>
    </div>
  )
}
