import * as React from 'react'

type Tone = 'default' | 'brand' | 'warn' | 'danger'

const toneStyles: Record<Tone, string> = {
  default: 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900',
  brand:   'border-brand-200 bg-brand-50 dark:border-brand-900 dark:bg-brand-950/40',
  warn:    'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40',
  danger:  'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40',
}

export function Stat({
  label, value, hint, tone = 'default',
}: {
  label: string
  value: React.ReactNode
  hint?: string
  tone?: Tone
}) {
  return (
    <div className={`rounded-xl border p-4 transition-colors ${toneStyles[tone]}`}>
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-50">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{hint}</div>}
    </div>
  )
}
