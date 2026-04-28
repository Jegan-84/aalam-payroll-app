'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useBlockingTransition } from '@/lib/ui/action-blocker'
import { useSnackbar } from '@/components/ui/snackbar'
import { reopenApprovedWeekAction } from '@/lib/timesheet/approval-actions'

export function ReopenButton({ weekId }: { weekId: string }) {
  const router = useRouter()
  const snack = useSnackbar()
  const [pending, startTransition] = useBlockingTransition()
  const [showForm, setShowForm] = useState(false)
  const [note, setNote] = useState('')

  const reopen = () => {
    const fd = new FormData()
    fd.set('week_id', weekId)
    if (note.trim()) fd.set('note', note.trim())
    startTransition(async () => {
      const res = await reopenApprovedWeekAction(fd)
      if (res.error) snack.show({ kind: 'error', message: res.error })
      else {
        snack.show({ kind: 'success', message: 'Week reopened. Employee notified.' })
        router.push('/me/timesheet/approvals')
      }
    })
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      {showForm ? (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
              Note (optional — shown to the employee)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="e.g. Need to add 4 hours of meeting time on Wednesday."
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              The week returns to draft. The employee gets a notification and can edit + resubmit. Audit log captures the reopen.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setShowForm(false); setNote('') }}
              disabled={pending}
              className="h-9 rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={reopen}
              disabled={pending}
              className="h-9 rounded-md bg-amber-600 px-4 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
            >
              {pending ? 'Reopening…' : 'Reopen week'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Already approved. Need a correction? Reopen the week so the employee can edit and resubmit.
          </p>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="h-9 rounded-md border border-amber-300 px-4 text-sm font-medium text-amber-800 hover:bg-amber-50 dark:border-amber-900 dark:text-amber-300 dark:hover:bg-amber-950/40"
          >
            Reopen for editing
          </button>
        </div>
      )}
    </div>
  )
}
