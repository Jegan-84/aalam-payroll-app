'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useBlockingTransition } from '@/lib/ui/action-blocker'
import { useSnackbar } from '@/components/ui/snackbar'
import {
  approveConfigChangeAction,
  rejectConfigChangeAction,
} from '@/lib/config-approvals/actions'
import type { PendingChangeRow } from '@/lib/config-approvals/queries'

const TARGET_LABEL: Record<string, string> = {
  statutory_config: 'Statutory configuration',
  tax_slabs:        'Income tax slabs',
  tax_config:       'Tax config (deductions / rebates)',
  tax_surcharge_slabs: 'Tax surcharge slabs',
  tax_clone_fy:     'Tax — clone FY',
  pt_slabs:         'Professional tax (PT)',
}

export function ApprovalQueue({ rows }: { rows: PendingChangeRow[] }) {
  const router = useRouter()
  const snack = useSnackbar()
  const [pending, startTransition] = useBlockingTransition()
  const [noteById, setNoteById] = useState<Record<string, string>>({})
  const [openId, setOpenId] = useState<string | null>(null)

  const run = (
    fn: (fd: FormData) => Promise<{ ok?: true; error?: string }>,
    id: string,
    successMsg: string,
  ) => {
    const fd = new FormData()
    fd.set('id', id)
    if (noteById[id]?.trim()) fd.set('note', noteById[id].trim())
    startTransition(async () => {
      const res = await fn(fd)
      if (res.error) snack.show({ kind: 'error', message: res.error })
      else {
        snack.show({ kind: 'success', message: successMsg })
        router.refresh()
      }
    })
  }

  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-800">
      {rows.map((r) => {
        const open = openId === r.id
        return (
          <div key={r.id} className="px-4 py-3">
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {TARGET_LABEL[r.target_table] ?? r.target_table}
                  </span>
                  <span className="text-[10px] uppercase tracking-wide text-slate-500">{r.action}</span>
                </div>
                <div className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                  {r.description ?? <span className="text-slate-400">—</span>}
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  Submitted {new Date(r.submitted_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                  {r.submitted_by_email && <> by <span className="font-medium">{r.submitted_by_email}</span></>}
                </div>
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : r.id)}
                  className="mt-1 text-[11px] font-medium text-brand-700 hover:underline dark:text-brand-400"
                >
                  {open ? 'Hide payload ▴' : 'Show payload ▾'}
                </button>
                {open && (
                  <pre className="mt-2 overflow-x-auto rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                    {JSON.stringify(r.payload, null, 2)}
                  </pre>
                )}
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-[320px]">
                <input
                  type="text"
                  value={noteById[r.id] ?? ''}
                  onChange={(e) => setNoteById((m) => ({ ...m, [r.id]: e.target.value }))}
                  placeholder="Note to maker (optional)"
                  className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-950"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(approveConfigChangeAction, r.id, 'Change approved and applied.')}
                    className="inline-flex h-9 flex-1 items-center justify-center rounded-md bg-emerald-700 px-3 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
                  >
                    Approve &amp; apply
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(rejectConfigChangeAction, r.id, 'Change rejected.')}
                    className="inline-flex h-9 flex-1 items-center justify-center rounded-md border border-red-300 px-3 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
