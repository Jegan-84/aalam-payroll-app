'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useBlockingTransition } from '@/lib/ui/action-blocker'
import { useConfirm } from '@/components/ui/confirm'
import { approveReimbursementAction, rejectReimbursementAction, deleteReimbursementAction } from '@/lib/reimbursements/actions'

type Status = 'pending' | 'approved' | 'rejected' | 'paid'

export function ReviewActions({ id, status }: { id: string; status: Status }) {
  const router = useRouter()
  const confirm = useConfirm()
  const [pending, startTransition] = useBlockingTransition()
  const [rejectOpen, setRejectOpen] = useState(false)
  const [notes, setNotes] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const run = (action: (fd: FormData) => Promise<{ ok?: true; error?: string }>, body?: FormData) => {
    setErr(null)
    const fd = body ?? new FormData()
    fd.set('id', id)
    startTransition(async () => {
      const res = await action(fd)
      if (res.error) setErr(res.error)
      else {
        setRejectOpen(false); setNotes('')
        router.refresh()
      }
    })
  }

  if (status === 'paid') {
    return <span className="text-xs text-slate-500">paid</span>
  }
  if (status === 'approved') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">approved — pending next payroll</span>
        <button
          type="button"
          onClick={async () => {
            if (await confirm({ body: 'Delete this approved (unpaid) claim?', confirmLabel: 'Delete', tone: 'danger' })) {
              run(deleteReimbursementAction)
            }
          }}
          disabled={pending}
          className="text-xs text-red-700 underline disabled:opacity-50 dark:text-red-400"
        >
          Delete
        </button>
      </div>
    )
  }
  if (status === 'rejected') {
    return <span className="text-xs text-slate-500">rejected</span>
  }

  // pending
  return (
    <div className="flex flex-wrap items-center gap-1">
      <button
        type="button"
        onClick={() => run(approveReimbursementAction)}
        disabled={pending}
        className="inline-flex h-7 items-center rounded-md bg-emerald-600 px-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        Approve
      </button>
      <button
        type="button"
        onClick={() => setRejectOpen((v) => !v)}
        disabled={pending}
        className="inline-flex h-7 items-center rounded-md border border-red-300 bg-white px-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-950/40"
      >
        Reject
      </button>
      {rejectOpen && (
        <div className="mt-1 flex w-full flex-col gap-1 rounded-md border border-red-200 bg-red-50 p-2 dark:border-red-900 dark:bg-red-950/20">
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Reason for rejection"
            className="h-7 rounded-md border border-red-300 bg-white px-2 text-xs dark:border-red-800 dark:bg-slate-950"
            autoFocus
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (notes.trim() === '') { setErr('Add a short reason.'); return }
                const fd = new FormData(); fd.set('notes', notes)
                run(rejectReimbursementAction, fd)
              }}
              disabled={pending}
              className="inline-flex h-7 items-center rounded-md bg-red-700 px-2 text-xs font-medium text-white hover:bg-red-800 disabled:opacity-60"
            >
              Confirm reject
            </button>
            <button type="button" onClick={() => { setRejectOpen(false); setNotes(''); setErr(null) }} className="text-xs text-slate-500 hover:underline">Cancel</button>
            {err && <span className="text-xs text-red-700 dark:text-red-400">{err}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
