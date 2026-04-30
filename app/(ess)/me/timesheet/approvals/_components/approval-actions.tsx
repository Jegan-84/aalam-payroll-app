'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useBlockingTransition } from '@/lib/ui/action-blocker'
import { useSnackbar } from '@/components/ui/snackbar'
import { useConfirm } from '@/components/ui/confirm'
import {
  approveTimesheetWeekAction,
  rejectTimesheetWeekAction,
} from '@/lib/timesheet/approval-actions'

export function ApprovalActions({ weekId }: { weekId: string }) {
  const router = useRouter()
  const snack = useSnackbar()
  const confirm = useConfirm()
  const [pending, startTransition] = useBlockingTransition()
  const [showReject, setShowReject] = useState(false)
  const [note, setNote] = useState('')

  const approve = async () => {
    if (!await confirm({
      title: 'Approve this timesheet?',
      body: 'The week will be locked. The employee can request a reopen if they need to fix something.',
      confirmLabel: 'Approve',
    })) return
    const fd = new FormData()
    fd.set('week_id', weekId)
    startTransition(async () => {
      const res = await approveTimesheetWeekAction(fd)
      if (res.error) snack.show({ kind: 'error', message: res.error })
      else {
        snack.show({ kind: 'success', message: 'Timesheet approved.' })
        router.push('/me/timesheet/approvals')
      }
    })
  }

  const reject = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!note.trim()) {
      snack.show({ kind: 'error', message: 'A reason is required when rejecting.' })
      return
    }
    const fd = new FormData()
    fd.set('week_id', weekId)
    fd.set('note', note)
    startTransition(async () => {
      const res = await rejectTimesheetWeekAction(fd)
      if (res.error) snack.show({ kind: 'error', message: res.error })
      else {
        snack.show({ kind: 'success', message: 'Timesheet rejected. Employee notified.' })
        router.push('/me/timesheet/approvals')
      }
    })
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      {showReject ? (
        <form onSubmit={reject} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
              Reason for rejection <span className="text-red-600">*</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              required
              placeholder="e.g. Missing description for Friday's hours, or hours don't match standup notes."
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              The employee gets a notification and the week returns to draft so they can edit and resubmit.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setShowReject(false); setNote('') }}
              disabled={pending}
              className="h-9 rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="h-9 rounded-md bg-rose-600 px-4 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60"
            >
              {pending ? 'Rejecting…' : 'Send rejection'}
            </button>
          </div>
        </form>
      ) : (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Review the entries above before deciding.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowReject(true)}
              disabled={pending}
              className="h-9 rounded-md border border-rose-300 px-4 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-60 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/40"
            >
              Reject
            </button>
            <button
              type="button"
              onClick={approve}
              disabled={pending}
              className="h-9 rounded-md bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 disabled:opacity-60"
            >
              {pending ? 'Approving…' : 'Approve'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
