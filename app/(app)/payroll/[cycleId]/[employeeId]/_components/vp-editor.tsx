'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveVpAllocationAction } from '@/lib/payroll/vp-actions'

const fmt = (n: number) => '₹ ' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(n))
const r2 = (n: number) => Math.round(n * 100) / 100

type Status = 'draft' | 'computed' | 'approved' | 'locked' | 'paid'

type Props = {
  cycleId: string
  employeeId: string
  cycleStatus: Status
  cycleIncludesVp: boolean
  annualCtc: number
  initialPct: number
  initialAmount: number
}

export function VpEditor({
  cycleId,
  employeeId,
  cycleStatus,
  cycleIncludesVp,
  annualCtc,
  initialPct,
  initialAmount,
}: Props) {
  const router = useRouter()
  const readonly = cycleStatus === 'locked' || cycleStatus === 'paid'

  const [pctStr, setPctStr] = useState<string>(String(initialPct))
  const [amountStr, setAmountStr] = useState<string>(String(initialAmount))
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [lastEdited, setLastEdited] = useState<'pct' | 'amount'>('pct')

  const onPctChange = (v: string) => {
    setPctStr(v)
    setLastEdited('pct')
    const n = Number(v)
    if (Number.isFinite(n) && n >= 0 && annualCtc > 0) {
      setAmountStr(String(Math.round((annualCtc * n) / 100)))
    }
  }

  const onAmountChange = (v: string) => {
    setAmountStr(v)
    setLastEdited('amount')
    const n = Number(v)
    if (Number.isFinite(n) && n >= 0 && annualCtc > 0) {
      setPctStr(String(r2((n / annualCtc) * 100)))
    }
  }

  const save = () => {
    if (readonly) return
    setMsg(null)
    const fd = new FormData()
    fd.set('cycle_id', cycleId)
    fd.set('employee_id', employeeId)
    // Send only the field the user last edited; the server derives the other.
    if (lastEdited === 'amount') fd.set('vp_amount', amountStr)
    else fd.set('vp_pct', pctStr)

    startTransition(async () => {
      const res = await saveVpAllocationAction(fd)
      if (res.error) setMsg({ kind: 'err', text: res.error })
      else {
        setMsg({ kind: 'ok', text: 'Saved. Click Recompute on the cycle to refresh the payslip.' })
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Variable Pay</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Annual CTC: <span className="tabular-nums">{fmt(annualCtc)}</span>
            {!cycleIncludesVp && (
              <>
                {' · '}
                <span className="text-amber-700 dark:text-amber-400">
                  VP toggle is OFF for this cycle — amount below will not apply until enabled on the cycle page.
                </span>
              </>
            )}
          </p>
        </div>
        {msg && (
          <span className={`text-xs ${msg.kind === 'ok' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
            {msg.text}
          </span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="text-[11px] font-medium uppercase tracking-wide text-slate-500">VP percentage</label>
          <div className="mt-1 flex items-center gap-1">
            <input
              type="number"
              min="0"
              step="0.01"
              value={pctStr}
              onChange={(e) => onPctChange(e.target.value)}
              disabled={pending || readonly}
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-right text-sm tabular-nums dark:border-slate-700 dark:bg-slate-950 disabled:opacity-60"
            />
            <span className="text-sm text-slate-500">%</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">of annual CTC</p>
        </div>

        <div>
          <label className="text-[11px] font-medium uppercase tracking-wide text-slate-500">VP amount</label>
          <div className="mt-1 flex items-center gap-1">
            <span className="text-sm text-slate-500">₹</span>
            <input
              type="number"
              min="0"
              step="1"
              value={amountStr}
              onChange={(e) => onAmountChange(e.target.value)}
              disabled={pending || readonly}
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-right text-sm tabular-nums dark:border-slate-700 dark:bg-slate-950 disabled:opacity-60"
            />
          </div>
          <p className="mt-1 text-[11px] text-slate-500">paid this cycle</p>
        </div>

        <div className="flex items-end">
          <button
            type="button"
            onClick={save}
            disabled={pending || readonly}
            className="h-9 w-full rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {pending ? 'Saving…' : 'Save VP'}
          </button>
        </div>
      </div>
    </div>
  )
}
