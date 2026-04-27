'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useBlockingTransition } from '@/lib/ui/action-blocker'
import { approvePoiAction, rejectPoiAction } from '@/lib/poi/actions'

export function ReviewActions({ id, status }: { id: string; status: 'pending' | 'approved' | 'rejected' }) {
  const router = useRouter()
  const [pending, startTransition] = useBlockingTransition()
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const run = (
    action: (fd: FormData) => Promise<{ ok?: true; error?: string }>,
    needsNotes: boolean,
  ) => {
    if (needsNotes && notes.trim() === '') {
      setErr('Add a short reason for rejection.')
      return
    }
    setErr(null)
    const fd = new FormData()
    fd.set('id', id)
    if (notes) fd.set('notes', notes)
    startTransition(async () => {
      const res = await action(fd)
      if (res.error) setErr(res.error)
      else {
        setOpen(false)
        setNotes('')
        router.refresh()
      }
    })
  }

  if (status !== 'pending') {
    return <span className="text-xs text-slate-500">{status}</span>
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      <button
        type="button"
        onClick={() => run(approvePoiAction, false)}
        disabled={pending}
        className="inline-flex h-7 items-center rounded-md bg-emerald-600 px-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        Approve
      </button>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        className="inline-flex h-7 items-center rounded-md border border-red-300 bg-white px-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-950/40"
      >
        Reject
      </button>
      {open && (
        <div className="mt-1 flex w-full flex-col gap-1 rounded-md border border-red-200 bg-red-50 p-2 dark:border-red-900 dark:bg-red-950/20">
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Reason for rejection"
            className="h-7 rounded-md border border-red-300 bg-white px-2 text-xs dark:border-red-800 dark:bg-slate-950"
            autoFocus
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => run(rejectPoiAction, true)}
              disabled={pending}
              className="inline-flex h-7 items-center rounded-md bg-red-700 px-2 text-xs font-medium text-white hover:bg-red-800 disabled:opacity-60"
            >
              Confirm reject
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setNotes(''); setErr(null) }}
              className="text-xs text-slate-500 hover:underline"
            >
              Cancel
            </button>
            {err && <span className="text-xs text-red-700 dark:text-red-400">{err}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
