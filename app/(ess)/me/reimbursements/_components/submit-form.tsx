'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useBlockingTransition } from '@/lib/ui/action-blocker'
import { useConfirm } from '@/components/ui/confirm'
import { submitReimbursementAction, deleteReimbursementAction } from '@/lib/reimbursements/actions'
import type { ReimbursementClaimRow } from '@/lib/reimbursements/queries'
import { CATEGORY_LABELS } from '@/lib/reimbursements/constants'

const fmt = (n: number) => '₹ ' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(n))

const STATUS_TONE: Record<string, string> = {
  pending:  'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
  approved: 'bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200',
  paid:     'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
}

export function ReimbursementSubmit({ claims }: { claims: ReimbursementClaimRow[] }) {
  const router = useRouter()
  const confirm = useConfirm()
  const [pending, startTransition] = useBlockingTransition()
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const formRef = useRef<HTMLFormElement | null>(null)

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setMsg(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await submitReimbursementAction(fd)
      if (res.error) setMsg({ kind: 'err', text: res.error })
      else {
        setMsg({ kind: 'ok', text: 'Submitted. HR will review.' })
        formRef.current?.reset()
        router.refresh()
      }
    })
  }

  const onDelete = async (id: string) => {
    if (!await confirm({
      title: 'Delete this claim?',
      body: 'Only pending claims can be deleted.',
      confirmLabel: 'Delete',
      tone: 'danger',
    })) return
    setMsg(null)
    const fd = new FormData()
    fd.set('id', id)
    startTransition(async () => {
      const res = await deleteReimbursementAction(fd)
      if (res.error) setMsg({ kind: 'err', text: res.error })
      else { setMsg({ kind: 'ok', text: 'Deleted.' }); router.refresh() }
    })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Submit a new claim</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Upload the receipt; approved claims flow into your next payroll cycle.
            </p>
          </div>
          {msg && (
            <span className={`text-xs ${msg.kind === 'ok' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
              {msg.text}
            </span>
          )}
        </div>
        <form ref={formRef} onSubmit={onSubmit} encType="multipart/form-data" className="grid gap-2 sm:grid-cols-5">
          <select name="category" required defaultValue="fuel" className={inputCls}>
            {Object.entries(CATEGORY_LABELS).map(([v, label]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>
          <input name="sub_category" type="text" placeholder="Description (optional)" className={inputCls} />
          <input name="claim_date" type="date" required className={inputCls} />
          <input name="amount" type="number" min="1" step="1" placeholder="Amount ₹" required className={inputCls} />
          <input
            name="file"
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            required
            className="h-9 w-full cursor-pointer rounded-md border border-slate-300 bg-white px-2 text-sm file:mr-2 file:rounded file:border-0 file:bg-slate-900 file:px-2 file:py-1 file:text-xs file:font-medium file:text-white dark:border-slate-700 dark:bg-slate-950 dark:file:bg-slate-100 dark:file:text-slate-900"
          />
          <button
            type="submit"
            disabled={pending}
            className="sm:col-span-5 inline-flex h-9 items-center justify-center rounded-md bg-brand-600 px-3 text-sm font-medium text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? 'Uploading…' : 'Submit claim'}
          </button>
        </form>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-50">
          My claims
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="py-1 px-3 text-left font-normal">Submitted</th>
                <th className="py-1 px-3 text-left font-normal">Claim date</th>
                <th className="py-1 px-3 text-left font-normal">Category</th>
                <th className="py-1 px-3 text-left font-normal">Description</th>
                <th className="py-1 px-3 text-right font-normal">Amount</th>
                <th className="py-1 px-3 text-left font-normal">Status</th>
                <th className="py-1 px-3 text-left font-normal">Receipt</th>
                <th className="py-1 px-3 text-right font-normal">{' '}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {claims.length === 0 && (
                <tr><td colSpan={8} className="py-8 text-center text-sm text-slate-500">No claims yet.</td></tr>
              )}
              {claims.map((c) => (
                <tr key={c.id}>
                  <td className="py-2 px-3 text-xs text-slate-500">{c.submitted_at.slice(0, 10)}</td>
                  <td className="py-2 px-3 tabular-nums">{c.claim_date}</td>
                  <td className="py-2 px-3">{CATEGORY_LABELS[c.category]}</td>
                  <td className="py-2 px-3">{c.sub_category ?? '—'}</td>
                  <td className="py-2 px-3 text-right tabular-nums">{fmt(c.amount)}</td>
                  <td className="py-2 px-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_TONE[c.status]}`}>
                      {c.status}
                    </span>
                    {c.status === 'rejected' && c.review_notes && (
                      <div className="mt-0.5 text-[11px] text-red-700 dark:text-red-400">{c.review_notes}</div>
                    )}
                  </td>
                  <td className="py-2 px-3">
                    <a href={`/api/reimbursement/${c.id}`} target="_blank" rel="noopener" className="text-xs font-medium text-brand-700 hover:underline">
                      {c.file_name}
                    </a>
                  </td>
                  <td className="py-2 px-3 text-right">
                    {c.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => onDelete(c.id)}
                        disabled={pending}
                        className="text-xs text-red-700 underline disabled:opacity-50 dark:text-red-400"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const inputCls = 'h-9 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950'
