'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useBlockingTransition } from '@/lib/ui/action-blocker'
import { Dialog } from '@/components/ui/dialog'
import { useSnackbar } from '@/components/ui/snackbar'
import { adjustLeaveBalanceAction } from '@/lib/leave/actions'

type Props = {
  employeeId: string
  employeeLabel: string
  leaveTypeId: number
  leaveTypeCode: string
  fyStart: string
  current: {
    opening_balance: number
    accrued: number
    carried_forward: number
    used: number
    encashed: number
    adjustment: number
  }
}

export function AdjustBalanceCell({
  employeeId, employeeLabel, leaveTypeId, leaveTypeCode, fyStart, current,
}: Props) {
  const router = useRouter()
  const snack = useSnackbar()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useBlockingTransition()
  const [adjustment, setAdjustment] = useState(String(current.adjustment ?? 0))
  const [notes, setNotes] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const balanceAfter =
    current.opening_balance + current.accrued + current.carried_forward
    - current.used - current.encashed + (Number(adjustment) || 0)

  const onClose = () => {
    if (pending) return
    setErr(null)
    setOpen(false)
  }

  const onOpen = () => {
    setAdjustment(String(current.adjustment ?? 0))
    setNotes('')
    setErr(null)
    setOpen(true)
  }

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErr(null)
    const fd = new FormData(e.currentTarget)
    fd.set('employee_id', employeeId)
    fd.set('leave_type_id', String(leaveTypeId))
    fd.set('fy_start', fyStart)
    startTransition(async () => {
      const res = await adjustLeaveBalanceAction(fd)
      if (res.error) setErr(res.error)
      else {
        snack.show({ kind: 'success', message: `${leaveTypeCode} adjustment saved.` })
        setOpen(false)
        router.refresh()
      }
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        title="Adjust this balance"
        className="text-[10px] font-medium text-brand-700 hover:underline dark:text-brand-400"
      >
        Adjust
      </button>

      <Dialog
        open={open}
        onClose={onClose}
        size="md"
        title={`Adjust ${leaveTypeCode} for ${employeeLabel}`}
        subtitle={`Leave year starting ${fyStart}. Adjustments are in-place; every change is logged with your notes.`}
      >
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-3 gap-3 rounded-md bg-slate-50 p-3 text-xs dark:bg-slate-950">
            <Stat label="Opening" value={current.opening_balance} />
            <Stat label="Accrued" value={current.accrued} />
            <Stat label="Carried fwd" value={current.carried_forward} />
            <Stat label="Used" value={current.used} />
            <Stat label="Encashed" value={current.encashed} />
            <Stat label="Adjustment (now)" value={current.adjustment} />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
              New adjustment value <span className="text-red-600">*</span>
            </label>
            <input
              name="adjustment"
              type="number"
              step="0.5"
              min={-365}
              max={365}
              required
              value={adjustment}
              onChange={(e) => setAdjustment(e.target.value)}
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Positive = grant extra days. Negative = claw back. This replaces the existing adjustment, it doesn&apos;t add to it.
            </p>
          </div>

          <div className="rounded-md border border-dashed border-slate-300 p-3 text-xs dark:border-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">New balance after adjustment</span>
              <span className={`text-base font-semibold tabular-nums ${balanceAfter < 0 ? 'text-red-700 dark:text-red-400' : 'text-slate-900 dark:text-slate-100'}`}>
                {balanceAfter.toFixed(2)}
              </span>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
              Reason / notes <span className="text-red-600">*</span>
            </label>
            <textarea
              name="notes"
              required
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. 2 day comp adjustment as agreed by HRBP — ticket #4527"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </div>

          {err && <p className="text-xs text-red-600 dark:text-red-400">{err}</p>}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="h-9 rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="h-9 rounded-md bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 disabled:opacity-60"
            >
              {pending ? 'Saving…' : 'Save adjustment'}
            </button>
          </div>
        </form>
      </Dialog>
    </>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">{Number(value).toFixed(2)}</div>
    </div>
  )
}
