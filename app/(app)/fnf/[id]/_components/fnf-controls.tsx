'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useBlockingTransition } from '@/lib/ui/action-blocker'
import {
  computeFnfAction,
  approveFnfAction,
  markFnfPaidAction,
  reopenFnfAction,
} from '@/lib/fnf/actions'

type Status = 'draft' | 'computed' | 'approved' | 'paid'

export function FnfControls({ id, status }: { id: string; status: Status }) {
  const router = useRouter()
  const [pending, startTransition] = useBlockingTransition()
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const run = (
    action: (fd: FormData) => Promise<{ ok?: true; error?: string }>,
    label: string,
    confirmMsg?: string,
  ) => {
    if (confirmMsg && !confirm(confirmMsg)) return
    setMsg(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set('id', id)
      const res = await action(fd)
      if (res.error) setMsg({ kind: 'err', text: res.error })
      else {
        setMsg({ kind: 'ok', text: `${label} OK` })
        router.refresh()
      }
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {(status === 'draft' || status === 'computed') && (
        <button
          onClick={() => run(computeFnfAction, status === 'draft' ? 'Computed' : 'Recomputed')}
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
              approveFnfAction,
              'Approved',
              'Approving will mark the employee as EXITED, set their date_of_exit, close the active salary structure, and lock this settlement. Continue?',
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
          onClick={() => run(markFnfPaidAction, 'Paid', 'Mark this settlement as paid? This is the final state.')}
          disabled={pending}
          className="inline-flex h-9 items-center rounded-md bg-green-700 px-4 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-60"
        >
          Mark paid
        </button>
      )}

      {(status === 'computed' || status === 'approved') && (
        <button
          onClick={() =>
            run(
              reopenFnfAction,
              'Reopened',
              status === 'approved'
                ? 'Reopen this settlement? The employee will revert to on-notice and the structure will need to be reopened manually if needed. Continue?'
                : 'Reopen this settlement back to draft?',
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
    </div>
  )
}
