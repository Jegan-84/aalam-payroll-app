'use client'

import { useState } from 'react'

type Format = 'generic' | 'icici' | 'hdfc' | 'sbi'

const FORMATS: { value: Format; label: string; desc: string }[] = [
  { value: 'generic', label: 'Generic NEFT (CSV)', desc: 'Simple 6-column format — works with most banks' },
  { value: 'icici',   label: 'ICICI Corporate',    desc: 'ICICI CIB bulk payment template (PAB_VENDOR)' },
  { value: 'hdfc',    label: 'HDFC Enterprise',    desc: 'HDFC NetBanking Enterprise NEFT upload' },
  { value: 'sbi',     label: 'SBI Corporate',      desc: 'SBI Corporate INB pipe-delimited bulk NEFT' },
]

export function PayoutDownload({
  cycleId,
  disabled,
}: {
  cycleId: string
  disabled: boolean
}) {
  const [format, setFormat] = useState<Format>('generic')
  const [open, setOpen] = useState(false)

  if (disabled) {
    return (
      <span
        className="inline-flex h-9 cursor-not-allowed items-center rounded-md border border-slate-200 bg-slate-100 px-3 text-sm font-medium text-slate-400 dark:border-slate-800 dark:bg-slate-900/50"
        title="Approve the cycle before downloading a payout file"
      >
        Payout file ▾
      </span>
    )
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
      >
        Payout file ▾
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-20 mt-1 w-80 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-950">
            <div className="border-b border-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800">
              Bank format
            </div>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {FORMATS.map((f) => (
                <li key={f.value}>
                  <button
                    type="button"
                    onClick={() => setFormat(f.value)}
                    className={`flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm transition-colors ${
                      format === f.value
                        ? 'bg-brand-50 dark:bg-brand-950/30'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-900'
                    }`}
                  >
                    <span className="font-medium text-slate-900 dark:text-slate-100">{f.label}</span>
                    <span className="text-xs text-slate-500">{f.desc}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/50">
              <a
                href={`/api/payroll/${cycleId}/payout/${format}`}
                className="inline-flex h-8 flex-1 items-center justify-center rounded-md bg-brand-600 px-3 text-xs font-medium text-white hover:bg-brand-700"
                onClick={() => setOpen(false)}
              >
                Download {format.toUpperCase()}
              </a>
              <a
                href={`/api/payroll/${cycleId}/payout/${format}/exceptions`}
                className="inline-flex h-8 items-center rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                onClick={() => setOpen(false)}
                title="List of employees skipped (missing bank details, zero pay)"
              >
                Exceptions
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
