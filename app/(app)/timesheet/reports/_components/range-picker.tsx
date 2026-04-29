'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function RangePicker({
  from, to, tab, live,
}: { from: string; to: string; tab: string; live: boolean }) {
  const router = useRouter()
  const [f, setF] = useState(from)
  const [t, setT] = useState(to)

  const apply = (overrides?: Partial<{ from: string; to: string; live: boolean }>) => {
    const params = new URLSearchParams({ tab, from: overrides?.from ?? f, to: overrides?.to ?? t })
    if (overrides?.live ?? live) params.set('live', '1')
    router.push(`/timesheet/reports?${params.toString()}`)
  }

  const preset = (which: 'this_month' | 'last_month' | 'this_quarter' | 'this_fy') => {
    const now = new Date()
    let from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    let to = new Date(now.getTime())
    if (which === 'last_month') {
      from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
      to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0))
    } else if (which === 'this_quarter') {
      const qStartMonth = Math.floor(now.getUTCMonth() / 3) * 3
      from = new Date(Date.UTC(now.getUTCFullYear(), qStartMonth, 1))
    } else if (which === 'this_fy') {
      const fyStartYear = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
      from = new Date(Date.UTC(fyStartYear, 3, 1))
    }
    const fromIso = from.toISOString().slice(0, 10)
    const toIso = to.toISOString().slice(0, 10)
    setF(fromIso); setT(toIso)
    apply({ from: fromIso, to: toIso })
  }

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <Field label="From">
        <input type="date" value={f} onChange={(e) => setF(e.target.value)} className={inputCls} />
      </Field>
      <Field label="To">
        <input type="date" value={t} onChange={(e) => setT(e.target.value)} className={inputCls} />
      </Field>
      <button
        type="button"
        onClick={() => apply()}
        className="h-9 rounded-md bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
      >
        Apply
      </button>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Preset onClick={() => preset('this_month')}>This month</Preset>
        <Preset onClick={() => preset('last_month')}>Last month</Preset>
        <Preset onClick={() => preset('this_quarter')}>This quarter</Preset>
        <Preset onClick={() => preset('this_fy')}>This FY</Preset>

        <label
          className="ml-2 inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
          title="When on, includes drafts + submitted — everything the employee has logged. When off, only signed-off (approved) data."
        >
          <input
            type="checkbox"
            checked={live}
            onChange={(e) => apply({ live: e.target.checked })}
          />
          Include drafts &amp; submitted
        </label>
      </div>
    </div>
  )
}

const inputCls = 'h-9 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</label>
      {children}
    </div>
  )
}

function Preset({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-7 rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
    >
      {children}
    </button>
  )
}
