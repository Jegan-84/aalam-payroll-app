'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useBlockingTransition } from '@/lib/ui/action-blocker'
import {
  approveCycleAction,
  computeCycleAction,
  lockCycleAction,
  reopenCycleAction,
} from '@/lib/payroll/actions'

type Status = 'draft' | 'computed' | 'approved' | 'locked' | 'paid'

export function CycleControls({ cycleId, status }: { cycleId: string; status: Status }) {
  const router = useRouter()
  const [pending, startTransition] = useBlockingTransition()
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [skipped, setSkipped] = useState<string[]>([])

  const run = (
    action: (fd: FormData) => Promise<{ ok?: true; error?: string; count?: number; skipped?: string[] }>,
    label: string,
    confirmMsg?: string,
  ) => {
    if (confirmMsg && !confirm(confirmMsg)) return
    setMsg(null)
    setSkipped([])
    startTransition(async () => {
      const fd = new FormData()
      fd.set('cycle_id', cycleId)
      const res = await action(fd)
      if (res.error) setMsg({ kind: 'err', text: res.error })
      else setMsg({ kind: 'ok', text: `${label} OK${res.count != null ? ` (${res.count} employee${res.count === 1 ? '' : 's'})` : ''}` })
      if (res.skipped && res.skipped.length > 0) setSkipped(res.skipped)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {(status === 'draft' || status === 'computed') && (
        <button
          onClick={() => run(computeCycleAction, 'Computed')}
          disabled={pending}
          className="inline-flex h-9 items-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
        >
          {pending ? 'Working…' : status === 'draft' ? 'Compute' : 'Recompute'}
        </button>
      )}

      {status === 'computed' && (
        <button
          onClick={() =>
            run(
              approveCycleAction,
              'Approved',
              'Approving will freeze payroll items and LOCK attendance for this month. Continue?',
            )
          }
          disabled={pending}
          className="inline-flex h-9 items-center rounded-md bg-yellow-600 px-4 text-sm font-medium text-white hover:bg-yellow-700 disabled:opacity-60"
        >
          Approve
        </button>
      )}

      {status === 'approved' && (
        <button
          onClick={() => run(lockCycleAction, 'Locked', 'Lock this cycle? Payslips become permanent.')}
          disabled={pending}
          className="inline-flex h-9 items-center rounded-md bg-green-700 px-4 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-60"
        >
          Lock
        </button>
      )}

      {(status === 'approved' || status === 'locked') && (
        <button
          onClick={() =>
            run(
              reopenCycleAction,
              'Reopened',
              'Reopen this cycle? Attendance will be unlocked and items reset to draft.',
            )
          }
          disabled={pending}
          className="inline-flex h-9 items-center rounded-md border border-slate-300 px-4 text-sm font-medium hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Reopen
        </button>
      )}

      {msg && (
        <span className={`text-xs ${msg.kind === 'ok' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
          {msg.text}
        </span>
      )}

      {skipped.length > 0 && (
        <div className="mt-2 w-full rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <div className="font-semibold">{skipped.length} employee{skipped.length === 1 ? '' : 's'} skipped:</div>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {skipped.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}
