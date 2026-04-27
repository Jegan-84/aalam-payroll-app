'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useBlockingTransition } from '@/lib/ui/action-blocker'
import { useSnackbar } from '@/components/ui/snackbar'
import { runYearEndConversionAction } from '@/lib/leave/year-end'

export function YearEndButton({ currentYear }: { currentYear: number }) {
  const router = useRouter()
  const snack = useSnackbar()
  const [pending, startTransition] = useBlockingTransition()
  const [year, setYear] = useState(currentYear - 1)

  const run = () => {
    if (!confirm(`Run year-end conversion for ${year}? This closes PL balances, transfers up to 6 days to EL where needed, and queues the remaining PL as leave encashment on the next payslip. Safe to re-run — duplicate employees are upserted.`)) return
    const fd = new FormData()
    fd.set('leave_year', String(year))
    startTransition(async () => {
      const res = await runYearEndConversionAction(fd)
      if (res.error) snack.show({ kind: 'error', message: res.error })
      else {
        snack.show({
          kind: 'success',
          message: `Year-end ${year}: ${res.converted ?? 0} employees · ₹${(res.encashmentTotal ?? 0).toLocaleString('en-IN')} encashment queued.`,
          duration: 7000,
        })
        router.refresh()
      }
    })
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Year-end conversion</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Dec 31 closeout — moves up to 6 PL → EL for employees with empty EL, queues remaining PL as leave encashment
          on the next payslip.
        </p>
      </div>
      <div className="mt-3 flex items-end gap-2">
        <label className="flex flex-col">
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Leave year</span>
          <input
            type="number"
            min="2024"
            max={String(currentYear)}
            value={year}
            onChange={(e) => setYear(Number(e.target.value) || currentYear - 1)}
            className="mt-1 h-9 w-28 rounded-md border border-slate-300 bg-white px-3 text-sm tabular-nums dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="h-9 rounded-md bg-amber-600 px-4 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
        >
          {pending ? 'Converting…' : `Run year-end for ${year}`}
        </button>
      </div>
    </div>
  )
}
