'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useBlockingTransition } from '@/lib/ui/action-blocker'
import { useSnackbar } from '@/components/ui/snackbar'
import {
  approveCompOffRequestAction,
  rejectCompOffRequestAction,
} from '@/lib/leave/comp-off'

export function CompOffReviewActions({ id }: { id: string }) {
  const router = useRouter()
  const snack = useSnackbar()
  const [pending, startTransition] = useBlockingTransition()
  const [note, setNote] = useState('')

  const run = (
    fn: (fd: FormData) => Promise<{ ok?: true; error?: string }>,
    label: string,
  ) => {
    const fd = new FormData()
    fd.set('id', id)
    if (note.trim()) fd.set('note', note.trim())
    startTransition(async () => {
      const res = await fn(fd)
      if (res.error) snack.show({ kind: 'error', message: res.error })
      else {
        snack.show({ kind: 'success', message: label })
        router.push('/me/comp-off/approvals')
      }
    })
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/40">
        <label className="mb-2 block text-xs font-medium text-green-800 dark:text-green-300">Approval note (optional)</label>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mb-3 block h-9 w-full rounded-md border border-green-300 bg-white px-3 text-sm dark:border-green-800 dark:bg-slate-950"
        />
        <button
          type="button"
          onClick={() => run(approveCompOffRequestAction, 'Forwarded to HR.')}
          disabled={pending}
          className="inline-flex h-9 items-center rounded-md bg-green-700 px-4 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-60"
        >
          Approve and forward to HR
        </button>
      </div>
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40">
        <label className="mb-2 block text-xs font-medium text-red-800 dark:text-red-300">Reason for rejection</label>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mb-3 block h-9 w-full rounded-md border border-red-300 bg-white px-3 text-sm dark:border-red-800 dark:bg-slate-950"
        />
        <button
          type="button"
          onClick={() => run(rejectCompOffRequestAction, 'Request rejected.')}
          disabled={pending}
          className="inline-flex h-9 items-center rounded-md bg-red-700 px-4 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-60"
        >
          Reject
        </button>
      </div>
    </div>
  )
}
