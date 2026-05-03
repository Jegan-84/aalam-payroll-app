'use client'

import Link from 'next/link'
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
  status: 'submitted' | 'manager_approved' | 'approved' | 'rejected' | 'cancelled'
  decided_at: string | null
  decision_note: string | null
  manager_approved_at?: string | null
  created_at: string
}

const TONE: Record<Req['status'], string> = {
  submitted:        'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  manager_approved: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  approved:         'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
  rejected:         'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200',
  cancelled:        'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
}

const STATUS_LABEL: Record<Req['status'], string> = {
  submitted:        'awaiting manager',
  manager_approved: 'awaiting HR',
  approved:         'approved',
  rejected:         'rejected',
  cancelled:        'cancelled',
}

type Prefill = {
  work_date?: string
  days_requested?: number
  reason?: string | null
}

export function MyCompOffRequest({
  requests, prefill, banner,
}: {
  requests: Req[]
  prefill?: Prefill
  banner?: { kind: 'info' | 'warn'; text: string } | null
}) {
  const router = useRouter()
  const snack = useSnackbar()
  const [pending, startTransition] = useBlockingTransition()

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    startTransition(async () => {
      const res = await submitCompOffRequestAction(fd)
      if (res.error) snack.show({ kind: 'error', message: res.error })
      else {
        snack.show({ kind: 'success', message: 'Comp off request submitted.' })
        form.reset()
        // If we got here from a Re-apply link, the URL still carries
        // `?from_request=...`. Drop the query so a refresh doesn't re-prefill
        // the form with the old values.
        if (prefill) router.replace('/me/comp-off')
        else router.refresh()
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

  // Force the form to remount when `prefill` flips between defined/undefined
  // (or changes shape) so the uncontrolled inputs pick up the new defaults
  // instead of holding stale state.
  const formKey = prefill ? `prefill:${prefill.work_date}-${prefill.days_requested}` : 'fresh'

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Request Comp Off</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Worked on a holiday / weekend? Request comp off. HR approves it, and you get 30 days from the work date to use it.
        </p>
      </div>

      {banner && (
        <div
          role="status"
          className={`rounded-md border px-3 py-2 text-sm ${
            banner.kind === 'warn'
              ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
              : 'border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200'
          }`}
        >
          {banner.text}
        </div>
      )}

      <form key={formKey} onSubmit={submit} className="grid gap-2 sm:grid-cols-[160px_120px_1fr_auto]">
        <input name="work_date" type="date" defaultValue={prefill?.work_date ?? ''} required className={inputCls} />
        <input
          name="days_requested"
          type="number"
          min="0.5"
          max="2"
          step="0.5"
          defaultValue={prefill?.days_requested != null ? String(prefill.days_requested) : '1'}
          required
          className={inputCls}
        />
        <input name="reason" type="text" defaultValue={prefill?.reason ?? ''} placeholder="Reason (optional)" className={inputCls} />
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
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${TONE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                    {r.decision_note && <span className="ml-2 text-[10px] text-slate-500">{r.decision_note}</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {(r.status === 'submitted' || r.status === 'manager_approved') && (
                      <button
                        type="button"
                        onClick={() => cancel(r.id)}
                        disabled={pending}
                        className="text-[11px] font-medium text-slate-600 hover:text-red-600 hover:underline"
                      >
                        Cancel
                      </button>
                    )}
                    {(r.status === 'rejected' || r.status === 'cancelled') && (
                      <Link
                        href={`/me/comp-off?from_request=${r.id}`}
                        className="text-[11px] font-medium text-brand-700 hover:underline dark:text-brand-400"
                      >
                        Re-apply →
                      </Link>
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
