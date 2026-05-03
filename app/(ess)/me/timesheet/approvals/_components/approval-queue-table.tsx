'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useBlockingTransition } from '@/lib/ui/action-blocker'
import { useSnackbar } from '@/components/ui/snackbar'
import { useConfirm } from '@/components/ui/confirm'
import {
  approveTimesheetWeekAction,
  bulkApproveTimesheetWeeksAction,
} from '@/lib/timesheet/approval-actions'

type Row = {
  id: string
  rangeLabel: string
  totalHours: number
  submittedAt: string | null
  employeeId: string
  employeeCode: string
  employeeName: string
}

export function ApprovalQueueTable({ rows }: { rows: Row[] }) {
  const router = useRouter()
  const snack = useSnackbar()
  const confirm = useConfirm()
  const [pending, startTransition] = useBlockingTransition()
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const setAll = (v: boolean) => setSelected(v ? new Set(rows.map((r) => r.id)) : new Set())

  const approveOne = (weekId: string) => {
    const fd = new FormData()
    fd.set('week_id', weekId)
    startTransition(async () => {
      const res = await approveTimesheetWeekAction(fd)
      if (res.error) snack.show({ kind: 'error', message: res.error })
      else {
        snack.show({ kind: 'success', message: 'Timesheet approved.' })
        router.refresh()
      }
    })
  }

  const bulkApprove = async () => {
    if (selected.size === 0) return
    if (!await confirm({
      title: `Approve ${selected.size} timesheet${selected.size === 1 ? '' : 's'}?`,
      body: 'Each selected week will be locked. The employee can request a reopen if they need to fix something.',
      confirmLabel: 'Approve all',
    })) return
    const fd = new FormData()
    fd.set('week_ids', Array.from(selected).join(','))
    startTransition(async () => {
      const res = await bulkApproveTimesheetWeeksAction(fd)
      if (res.error) snack.show({ kind: 'error', message: res.error })
      else if ((res.failed?.length ?? 0) > 0) {
        snack.show({
          kind: 'warn',
          message: `Approved ${res.approved ?? 0}; ${res.failed!.length} failed.`,
          duration: 7000,
        })
      } else {
        snack.show({ kind: 'success', message: `Approved ${res.approved ?? 0} timesheet(s).` })
      }
      setSelected(new Set())
      router.refresh()
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2 dark:border-slate-800">
        <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={selected.size > 0 && selected.size === rows.length}
            ref={(el) => { if (el) el.indeterminate = selected.size > 0 && selected.size < rows.length }}
            onChange={(e) => setAll(e.target.checked)}
          />
          {selected.size > 0 ? `${selected.size} selected` : 'Select all'}
        </label>
        {selected.size > 0 && (
          <button
            type="button"
            onClick={bulkApprove}
            disabled={pending}
            className="inline-flex h-8 items-center rounded-md bg-brand-600 px-3 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {pending ? 'Approving…' : `Approve ${selected.size} selected`}
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
          <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2 w-8"></th>
              <th className="px-3 py-2">Employee</th>
              <th className="px-3 py-2">Week</th>
              <th className="px-3 py-2 text-right">Hours</th>
              <th className="px-3 py-2">Submitted</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
            {rows.map((r) => {
              const checked = selected.has(r.id)
              return (
                <tr key={r.id} className="transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-950/30">
                  <td className="px-3 py-2.5">
                    <input type="checkbox" checked={checked} onChange={() => toggle(r.id)} />
                  </td>
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/me/timesheet/approvals/${r.id}`}
                      className="font-medium text-slate-900 hover:text-brand-700 dark:text-slate-100"
                    >
                      {r.employeeName}
                    </Link>
                    <div className="text-[11px] text-slate-500">{r.employeeCode}</div>
                  </td>
                  <td className="px-3 py-2.5 text-slate-700 dark:text-slate-200">{r.rangeLabel}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-slate-900 dark:text-slate-50">
                    {r.totalHours.toFixed(2)}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">
                    {r.submittedAt
                      ? new Date(r.submittedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })
                      : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/me/timesheet/approvals/${r.id}`}
                        className="inline-flex h-8 items-center rounded-md border border-slate-300 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
                      >
                        Review
                      </Link>
                      <button
                        type="button"
                        onClick={() => approveOne(r.id)}
                        disabled={pending}
                        className="inline-flex h-8 items-center rounded-md bg-brand-600 px-3 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                      >
                        Approve
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
