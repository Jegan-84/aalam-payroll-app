'use client'

import * as React from 'react'
import Link from 'next/link'
import { MONTH_NAMES } from '@/lib/attendance/engine'

type Props = {
  year: number
  month: number
  basePath: string
  buildQuery?: (y: number, m: number) => string
}

export function MonthPicker({ year, month, basePath, buildQuery }: Props) {
  const [open, setOpen] = React.useState(false)
  const [popYear, setPopYear] = React.useState(year)
  const ref = React.useRef<HTMLDivElement>(null)

  // Re-align the popover year whenever the currently-viewed month/year changes
  // (e.g. clicking a month inside the popover navigates; we want next open to
  // start on the new year). Using an immediate state sync — cheaper than an effect.
  const [syncedYear, setSyncedYear] = React.useState(year)
  if (syncedYear !== year) {
    setSyncedYear(year)
    setPopYear(year)
  }

  React.useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const q = (y: number, m: number) => (buildQuery ? buildQuery(y, m) : `?year=${y}&month=${m}`)
  const prev = addMonths(year, month, -1)
  const next = addMonths(year, month, 1)

  const today = new Date()
  const todayY = today.getFullYear()
  const todayM = today.getMonth() + 1
  const alreadyToday = year === todayY && month === todayM

  return (
    <div ref={ref} className="relative inline-flex">
      <div className="inline-flex h-9 items-stretch overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <Link
          href={`${basePath}${q(prev.year, prev.month)}`}
          aria-label={`Previous month — ${MONTH_NAMES[prev.month - 1]} ${prev.year}`}
          title={`${MONTH_NAMES[prev.month - 1]} ${prev.year}`}
          className="flex w-9 items-center justify-center text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        >
          <IconChevronLeft />
        </Link>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="dialog"
          aria-expanded={open}
          className="flex min-w-[140px] items-center justify-center gap-1.5 border-x border-slate-200 px-3 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          {MONTH_NAMES[month - 1]} {year}
          <IconChevronDown />
        </button>

        <Link
          href={`${basePath}${q(next.year, next.month)}`}
          aria-label={`Next month — ${MONTH_NAMES[next.month - 1]} ${next.year}`}
          title={`${MONTH_NAMES[next.month - 1]} ${next.year}`}
          className="flex w-9 items-center justify-center text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        >
          <IconChevronRight />
        </Link>
      </div>

      {open && (
        <div
          role="dialog"
          className="absolute right-0 top-[calc(100%+6px)] z-30 w-[280px] rounded-lg border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setPopYear((y) => y - 1)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
              aria-label="Previous year"
            >
              <IconChevronLeft />
            </button>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">{popYear}</div>
            <button
              type="button"
              onClick={() => setPopYear((y) => y + 1)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
              aria-label="Next year"
            >
              <IconChevronRight />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {MONTH_NAMES.map((m, i) => {
              const mNum = i + 1
              const isSelected = popYear === year && mNum === month
              const isToday = popYear === todayY && mNum === todayM
              return (
                <Link
                  key={m}
                  href={`${basePath}${q(popYear, mNum)}`}
                  onClick={() => setOpen(false)}
                  className={[
                    'rounded-md px-2 py-1.5 text-center text-xs font-medium transition-colors',
                    isSelected
                      ? 'bg-brand-600 text-white shadow-sm hover:bg-brand-700'
                      : isToday
                        ? 'border border-brand-300 text-brand-700 hover:bg-brand-50 dark:border-brand-800 dark:text-brand-300 dark:hover:bg-brand-950/40'
                        : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
                  ].join(' ')}
                >
                  {m.slice(0, 3)}
                </Link>
              )
            })}
          </div>

          <div className="mt-3 border-t border-slate-100 pt-2 dark:border-slate-800">
            {alreadyToday ? (
              <div className="text-center text-[11px] text-slate-400">
                Viewing {MONTH_NAMES[todayM - 1]} {todayY}
              </div>
            ) : (
              <Link
                href={`${basePath}${q(todayY, todayM)}`}
                onClick={() => setOpen(false)}
                className="block rounded-md px-2 py-1.5 text-center text-xs font-medium text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-950/40"
              >
                Jump to current month
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function addMonths(year: number, month: number, delta: number) {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1))
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 }
}

const svgProps = {
  width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 2,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, viewBox: '0 0 24 24',
}
function IconChevronLeft()  { return <svg {...svgProps}><path d="m15 18-6-6 6-6" /></svg> }
function IconChevronRight() { return <svg {...svgProps}><path d="m9 18 6-6-6-6" /></svg> }
function IconChevronDown()  { return <svg {...svgProps} width={14} height={14}><path d="m6 9 6 6 6-6" /></svg> }
