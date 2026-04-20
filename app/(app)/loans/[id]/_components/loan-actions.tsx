'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useBlockingTransition } from '@/lib/ui/action-blocker'
import { forecloseLoanAction, writeOffLoanAction } from '@/lib/loans/actions'

export function LoanActions({ id, status }: { id: string; status: 'active' | 'closed' | 'foreclosed' | 'written_off' }) {
  const router = useRouter()
  const [pending, startTransition] = useBlockingTransition()
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const run = (
    action: (fd: FormData) => Promise<{ ok?: true; error?: string }>,
    label: string,
    confirmMsg: string,
  ) => {
    if (!confirm(confirmMsg)) return
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

  if (status !== 'active') {
    return (
      <span className="text-xs text-slate-500">No actions — loan is {status.replace('_', ' ')}.</span>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={() =>
          run(
            forecloseLoanAction,
            'Foreclosed',
            'Foreclose this loan? The outstanding balance is cleared (paid outside payroll). No more deductions will happen.',
          )
        }
        disabled={pending}
        className="inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
      >
        Foreclose
      </button>
      <button
        onClick={() =>
          run(
            writeOffLoanAction,
            'Written off',
            'Write off the outstanding balance? Use this for exits / uncollectable amounts.',
          )
        }
        disabled={pending}
        className="inline-flex h-9 items-center rounded-md border border-red-300 bg-white px-4 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-950/40"
      >
        Write off
      </button>
      {msg && (
        <span className={`text-xs ${msg.kind === 'ok' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
          {msg.text}
        </span>
      )}
    </div>
  )
}
