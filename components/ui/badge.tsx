import * as React from 'react'

type Tone = 'neutral' | 'brand' | 'success' | 'warn' | 'danger' | 'info'

const tones: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  brand:   'bg-brand-100 text-brand-800 dark:bg-brand-950/60 dark:text-brand-200',
  success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  warn:    'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  danger:  'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300',
  info:    'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300',
}

export function Badge({
  tone = 'neutral',
  children,
  className = '',
}: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${tones[tone]} ${className}`}>
      {children}
    </span>
  )
}
