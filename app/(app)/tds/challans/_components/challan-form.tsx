'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useBlockingTransition } from '@/lib/ui/action-blocker'
import { saveTdsChallanAction, deleteTdsChallanAction } from '@/lib/tds/challan-actions'
import type { TdsChallanRow } from '@/lib/tds/challan-queries'

type Props = {
  mode: 'create' | 'edit'
  defaults?: Partial<TdsChallanRow> & { year?: number; month?: number }
}

export function ChallanForm({ mode, defaults = {} }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useBlockingTransition()
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setMsg(null)
    const fd = new FormData(e.currentTarget)
    if (defaults.id) fd.set('id', defaults.id)
    startTransition(async () => {
      const res = await saveTdsChallanAction(fd)
      if (res.error) setMsg({ kind: 'err', text: res.error })
      else {
        if (mode === 'create') router.push('/tds/challans')
        else {
          setMsg({ kind: 'ok', text: 'Saved.' })
          router.refresh()
        }
      }
    })
  }

  const onDelete = () => {
    if (!defaults.id) return
    if (!confirm('Delete this challan? This only removes the record; the bank deposit itself is not affected.')) return
    setMsg(null)
    const fd = new FormData()
    fd.set('id', defaults.id)
    startTransition(async () => {
      const res = await deleteTdsChallanAction(fd)
      if (res.error) setMsg({ kind: 'err', text: res.error })
      else router.push('/tds/challans')
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {msg && (
        <div role="alert" className={`rounded-md border px-3 py-2 text-sm ${msg.kind === 'err' ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'}`}>
          {msg.text}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Year" hint="Calendar year of the period">
          <input name="year" type="number" min="2024" max="2100" defaultValue={defaults.year ?? new Date().getFullYear()} required className={inputCls} />
        </Field>
        <Field label="Month" hint="1 – 12, the month for which TDS was deposited">
          <input name="month" type="number" min="1" max="12" defaultValue={defaults.month ?? new Date().getMonth() + 1} required className={inputCls} />
        </Field>

        <Field label="BSR code" hint="7-digit bank branch code (printed on the challan counterfoil)">
          <input
            name="bsr_code"
            type="text"
            pattern="\d{7}"
            maxLength={7}
            defaultValue={defaults.bsr_code ?? ''}
            required
            placeholder="e.g. 6910333"
            className={inputCls}
          />
        </Field>
        <Field label="Challan serial number" hint="5-digit serial on the challan (CIN)">
          <input
            name="challan_serial_no"
            type="text"
            pattern="\d{3,7}"
            maxLength={7}
            defaultValue={defaults.challan_serial_no ?? ''}
            required
            placeholder="e.g. 00123"
            className={inputCls}
          />
        </Field>

        <Field label="Deposit date" hint="Date of deposit at the bank (stamped on challan)">
          <input name="deposit_date" type="date" defaultValue={defaults.deposit_date ?? ''} required className={inputCls} />
        </Field>

        <Field label="TDS amount ₹" hint="Principal TDS deposited (s.192)">
          <input name="tds_amount" type="number" min="0" step="0.01" defaultValue={defaults.tds_amount ?? 0} required className={inputCls} />
        </Field>
        <Field label="Surcharge ₹">
          <input name="surcharge" type="number" min="0" step="0.01" defaultValue={defaults.surcharge ?? 0} className={inputCls} />
        </Field>
        <Field label="Cess ₹">
          <input name="cess" type="number" min="0" step="0.01" defaultValue={defaults.cess ?? 0} className={inputCls} />
        </Field>
        <Field label="Interest ₹" hint="u/s 201 (late deposit penalty interest, if applicable)">
          <input name="interest" type="number" min="0" step="0.01" defaultValue={defaults.interest ?? 0} className={inputCls} />
        </Field>
        <Field label="Penalty ₹">
          <input name="penalty" type="number" min="0" step="0.01" defaultValue={defaults.penalty ?? 0} className={inputCls} />
        </Field>

        <div className="sm:col-span-2">
          <Field label="Notes (optional)">
            <textarea name="notes" rows={2} defaultValue={defaults.notes ?? ''} className={inputCls + ' resize-none'} />
          </Field>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="h-9 rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
        >
          {pending ? 'Saving…' : mode === 'create' ? 'Record challan' : 'Save changes'}
        </button>
        <Link href="/tds/challans" className="text-sm text-slate-500 hover:underline">Cancel</Link>
        {mode === 'edit' && (
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className="ml-auto h-9 rounded-md border border-red-300 bg-white px-4 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            Delete
          </button>
        )}
      </div>
    </form>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col">
      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</span>
      {children}
      {hint && <span className="mt-1 text-[11px] text-slate-500">{hint}</span>}
    </label>
  )
}

const inputCls =
  'mt-1 h-9 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-950'
