'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useBlockingTransition } from '@/lib/ui/action-blocker'
import { useSnackbar } from '@/components/ui/snackbar'
import {
  approveCompOffRequestAction,
  rejectCompOffRequestAction,
} from '@/lib/leave/comp-off'

type Row = {
  id: string
  work_date: string
  days_requested: number
  reason: string | null
  created_at: string
  employee: { employee_code: string; full_name_snapshot: string }
}

export function CompOffApprovalQueue({ rows }: { rows: Row[] }) {
  const router = useRouter()
  const snack = useSnackbar()
  const [pending, startTransition] = useBlockingTransition()
  const [noteById, setNoteById] = useState<Record<string, string>>({})

  const runAction = (
    fn: (fd: FormData) => Promise<{ ok?: true; error?: string }>,
    id: string,
    successMsg: string,
  ) => {
    const fd = new FormData()
    fd.set('id', id)
    if (noteById[id]) fd.set('note', noteById[id])
    startTransition(async () => {
      const res = await fn(fd)
      if (res.error) snack.show({ kind: 'error', message: res.error })
      else {
        snack.show({ kind: 'success', message: successMsg })
        router.refresh()
      }
    })
  }

  if (rows.length === 0) {
    return <p className="px-4 py-8 text-center text-sm text-slate-500">No pending comp off requests.</p>
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
          <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2">Employee</th>
              <th className="px-3 py-2">Worked on</th>
              <th className="px-3 py-2 text-right">Days</th>
              <th className="px-3 py-2">Reason</th>
              <th className="px-3 py-2">Note to employee</th>
              <th className="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
            {rows.map((r) => (
              <tr key={r.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-950">
                <td className="px-3 py-2">
                  <div className="font-medium text-slate-900 dark:text-slate-100">{r.employee.full_name_snapshot}</div>
                  <div className="text-[11px] text-slate-500">{r.employee.employee_code}</div>
                </td>
                <td className="px-3 py-2 tabular-nums">{r.work_date}</td>
                <td className="px-3 py-2 text-right tabular-nums">{Number(r.days_requested).toFixed(1)}</td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{r.reason ?? '—'}</td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={noteById[r.id] ?? ''}
                    onChange={(e) => setNoteById((m) => ({ ...m, [r.id]: e.target.value }))}
                    placeholder="Optional"
                    className="h-8 w-48 rounded-md border border-slate-300 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => runAction(approveCompOffRequestAction, r.id, 'Comp off approved.')}
                      className="h-8 rounded-md bg-green-600 px-3 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-60"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => runAction(rejectCompOffRequestAction, r.id, 'Comp off rejected.')}
                      className="h-8 rounded-md border border-red-300 px-3 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
                    >
                      Reject
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
