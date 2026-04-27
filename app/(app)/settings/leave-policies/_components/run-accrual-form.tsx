'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useBlockingTransition } from '@/lib/ui/action-blocker'
import { runMonthlyAccrualAction } from '@/lib/leave/policy-actions'

export function RunAccrualForm() {
  const router = useRouter()
  const [pending, startTransition] = useBlockingTransition()
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const now = new Date()
  const [year, setYear] = useState(now.getUTCFullYear())
  const [month, setMonth] = useState(now.getUTCMonth() + 1)

  const run = () => {
    setMsg(null)
    const fd = new FormData()
    fd.set('year', String(year))
    fd.set('month', String(month))
    startTransition(async () => {
      const res = await runMonthlyAccrualAction(fd)
      if (res.error) setMsg({ kind: 'err', text: res.error })
      else {
        setMsg({ kind: 'ok', text: `Accrued ${res.accrued ?? 0} balance${res.accrued === 1 ? '' : 's'} (${res.skipped ?? 0} skipped — already accrued or at cap).` })
        router.refresh()
      }
    })
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">Run monthly accrual</div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Adds this month&apos;s accrual to every employee&apos;s balance for leave types with
            <code className="mx-1">accrual_type = monthly</code>. Safe to re-run; already-accrued balances are skipped.
          </p>
        </div>
        {msg && (
          <span className={`text-xs ${msg.kind === 'ok' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
            {msg.text}
          </span>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="flex flex-col">
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Year</span>
          <input
            type="number"
            min="2024"
            max="2100"
            value={year}
            onChange={(e) => setYear(Number(e.target.value) || now.getUTCFullYear())}
            className="mt-1 h-9 w-28 rounded-md border border-slate-300 bg-white px-3 text-sm tabular-nums dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
        <label className="flex flex-col">
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Month</span>
          <input
            type="number"
            min="1"
            max="12"
            value={month}
            onChange={(e) => setMonth(Math.min(12, Math.max(1, Number(e.target.value) || 1)))}
            className="mt-1 h-9 w-20 rounded-md border border-slate-300 bg-white px-3 text-sm tabular-nums dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="h-9 rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? 'Accruing…' : 'Run accrual'}
        </button>
      </div>
    </div>
  )
}
