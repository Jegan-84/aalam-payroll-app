'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useBlockingTransition } from '@/lib/ui/action-blocker'
import { saveFnfManualLineAction, deleteFnfLineAction } from '@/lib/fnf/actions'

const fmt = (n: number) => '₹ ' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(n))

type Status = 'draft' | 'computed' | 'approved' | 'paid'

type ManualLine = {
  id: string
  code: string
  name: string
  kind: 'earning' | 'deduction'
  amount: number
}

export function ManualLinesPanel({
  settlementId,
  status,
  lines,
}: {
  settlementId: string
  status: Status
  lines: ManualLine[]
}) {
  const router = useRouter()
  const readonly = status === 'approved' || status === 'paid'
  const [pending, startTransition] = useBlockingTransition()
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [kind, setKind] = useState<'earning' | 'deduction'>('earning')
  const [amount, setAmount] = useState('')

  const save = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!code || !name || !amount) return
    setMsg(null)
    const fd = new FormData()
    fd.set('settlement_id', settlementId)
    fd.set('code', code)
    fd.set('name', name)
    fd.set('kind', kind)
    fd.set('amount', amount)
    startTransition(async () => {
      const res = await saveFnfManualLineAction(fd)
      if (res.error) setMsg({ kind: 'err', text: res.error })
      else {
        setMsg({ kind: 'ok', text: 'Added. Click Recompute to refresh totals + TDS.' })
        setCode(''); setName(''); setAmount('')
        router.refresh()
      }
    })
  }

  const remove = (id: string) => {
    setMsg(null)
    const fd = new FormData()
    fd.set('id', id)
    fd.set('settlement_id', settlementId)
    startTransition(async () => {
      const res = await deleteFnfLineAction(fd)
      if (res.error) setMsg({ kind: 'err', text: res.error })
      else {
        setMsg({ kind: 'ok', text: 'Removed. Click Recompute to refresh totals + TDS.' })
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Manual lines</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            HR-entered earnings (bonus, ex-gratia, reimbursement payout) or deductions (loan recovery, asset shortfall).
            After saving, click Recompute to refresh totals and TDS.
          </p>
        </div>
        {msg && (
          <span className={`text-xs ${msg.kind === 'ok' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
            {msg.text}
          </span>
        )}
      </div>

      {lines.length > 0 && (
        <table className="w-full text-sm">
          <thead className="text-xs text-slate-500">
            <tr>
              <th className="py-1 text-left font-normal">Code</th>
              <th className="py-1 text-left font-normal">Name</th>
              <th className="py-1 text-left font-normal">Kind</th>
              <th className="py-1 text-right font-normal">Amount</th>
              <th className="py-1 text-right font-normal">{' '}</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id}>
                <td className="py-1 font-mono text-xs">{l.code}</td>
                <td className="py-1">{l.name}</td>
                <td className="py-1 text-xs">{l.kind}</td>
                <td className="py-1 text-right tabular-nums">{fmt(l.amount)}</td>
                <td className="py-1 text-right">
                  {!readonly && (
                    <button
                      type="button"
                      onClick={() => remove(l.id)}
                      disabled={pending}
                      className="text-xs text-red-700 underline disabled:opacity-50 dark:text-red-400"
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!readonly && (
        <form onSubmit={save} className="grid grid-cols-1 gap-2 sm:grid-cols-5">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Code (e.g. BONUS)"
            className={inputCls}
          />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Label" className={inputCls} />
          <select value={kind} onChange={(e) => setKind(e.target.value as 'earning' | 'deduction')} className={inputCls}>
            <option value="earning">Earning</option>
            <option value="deduction">Deduction</option>
          </select>
          <input
            type="number"
            min="0"
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount ₹"
            className={inputCls}
          />
          <button
            type="submit"
            disabled={pending || !code || !name || !amount}
            className="h-9 rounded-md bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {pending ? 'Saving…' : 'Add'}
          </button>
        </form>
      )}
    </div>
  )
}

const inputCls = 'h-9 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950'
