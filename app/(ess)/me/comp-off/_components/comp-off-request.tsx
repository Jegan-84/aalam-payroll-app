'use client'

import { useRouter } from 'next/navigation'
import { useBlockingTransition } from '@/lib/ui/action-blocker'
import { useSnackbar } from '@/components/ui/snackbar'
import {
  submitCompOffRequestAction,
  cancelCompOffRequestAction,
} from '@/lib/leave/comp-off'

type Req = {
  id: string
  work_date: string
  days_requested: number
  reason: string | null
  status: 'submitted' | 'approved' | 'rejected' | 'cancelled'
  decided_at: string | null
  decision_note: string | null
  created_at: string
}

const TONE: Record<Req['status'], string> = {
  submitted: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  approved:  'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
  rejected:  'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200',
  cancelled: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
}

export function MyCompOffRequest({ requests }: { requests: Req[] }) {
  const router = useRouter()
  const snack = useSnackbar()
  const [pending, startTransition] = useBlockingTransition()

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await submitCompOffRequestAction(fd)
      if (res.error) snack.show({ kind: 'error', message: res.error })
      else {
        snack.show({ kind: 'success', message: 'Comp off request submitted.' })
        ;(e.target as HTMLFormElement).reset()
        router.refresh()
      }
    })
  }

  const cancel = (id: string) => {
    const fd = new FormData()
    fd.set('id', id)
    startTransition(async () => {
      const res = await cancelCompOffRequestAction(fd)
      if (res.error) snack.show({ kind: 'error', message: res.error })
      else {
        snack.show({ kind: 'info', message: 'Request cancelled.' })
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Request Comp Off</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Worked on a holiday / weekend? Request comp off. HR approves it, and you get 30 days from the work date to use it.
        </p>
      </div>

      <form onSubmit={submit} className="grid gap-2 sm:grid-cols-[160px_120px_1fr_auto]">
        <input name="work_date" type="date" required className={inputCls} />
        <input name="days_requested" type="number" min="0.5" max="2" step="0.5" defaultValue="1" required className={inputCls} />
        <input name="reason" type="text" placeholder="Reason (optional)" className={inputCls} />
        <button
          type="submit"
          disabled={pending}
          className="h-9 rounded-md bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 disabled:opacity-60"
        >
          {pending ? 'Submitting…' : 'Submit'}
        </button>
      </form>

      {requests.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
              <tr>
                <th className="px-3 py-2">Worked on</th>
                <th className="px-3 py-2 text-right">Days</th>
                <th className="px-3 py-2">Reason</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">{' '}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs dark:divide-slate-800">
              {requests.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2 tabular-nums">{r.work_date}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{Number(r.days_requested).toFixed(1)}</td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{r.reason ?? '—'}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${TONE[r.status]}`}>{r.status}</span>
                    {r.decision_note && <span className="ml-2 text-[10px] text-slate-500">{r.decision_note}</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {r.status === 'submitted' && (
                      <button
                        type="button"
                        onClick={() => cancel(r.id)}
                        disabled={pending}
                        className="text-[11px] font-medium text-slate-600 hover:text-red-600 hover:underline"
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const inputCls = 'h-9 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950'
