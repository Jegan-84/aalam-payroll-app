'use client'

import { useState } from 'react'
import { useBlockingTransition } from '@/lib/ui/action-blocker'
import { saveSlabsAction, saveSurchargeAction } from '@/lib/settings/tax-actions'

type Slab = { min: number; max: number | null; rate: number }

type Props = {
  fyStart: string
  fyEnd: string
  regime: 'NEW' | 'OLD'
  kind: 'slabs' | 'surcharge'
  initial: Slab[]
}

export function SlabsEditor({ fyStart, fyEnd, regime, kind, initial }: Props) {
  const [rows, setRows] = useState<Slab[]>(initial)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [pending, startTransition] = useBlockingTransition()

  const update = (i: number, field: keyof Slab, v: string) => {
    setRows((prev) =>
      prev.map((r, idx) =>
        idx !== i
          ? r
          : {
              ...r,
              [field]:
                field === 'max'
                  ? v.trim() === ''
                    ? null
                    : Number(v)
                  : Number(v),
            },
      ),
    )
  }

  const addRow = () =>
    setRows((prev) => [
      ...prev,
      { min: prev.length > 0 ? (prev[prev.length - 1].max ?? 0) + 1 : 0, max: null, rate: 0 },
    ])

  const removeRow = (i: number) => setRows((prev) => prev.filter((_, idx) => idx !== i))

  const save = () => {
    setMsg(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set('fy_start', fyStart)
      fd.set('fy_end', fyEnd)
      fd.set('regime', regime)
      fd.set('slabs', JSON.stringify(rows))
      const action = kind === 'slabs' ? saveSlabsAction : saveSurchargeAction
      const res = await action(fd)
      if (res.error) setMsg({ kind: 'err', text: res.error })
      else setMsg({ kind: 'ok', text: 'Saved.' })
    })
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
          {regime} — {kind === 'slabs' ? 'Tax slabs' : 'Surcharge slabs'}
        </h3>
        <div className="flex items-center gap-2">
          {msg && (
            <span className={`text-xs ${msg.kind === 'ok' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
              {msg.text}
            </span>
          )}
          <button type="button" onClick={addRow} className="h-8 rounded-md border border-slate-300 px-2 text-xs font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
            + Row
          </button>
          <button type="button" onClick={save} disabled={pending} className="h-8 rounded-md bg-slate-900 px-3 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200">
            {pending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-xs text-slate-500">
            <tr>
              <th className="py-1 pr-3">Min (₹)</th>
              <th className="py-1 pr-3">Max (₹) — blank = open</th>
              <th className="py-1 pr-3">Rate (%)</th>
              <th className="py-1 pr-3">{' '}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={4} className="py-3 text-xs text-slate-500">No rows. Click &quot;+ Row&quot; to add.</td></tr>
            )}
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="py-1 pr-3">
                  <input type="number" value={r.min} onChange={(e) => update(i, 'min', e.target.value)} className="h-8 w-32 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
                </td>
                <td className="py-1 pr-3">
                  <input
                    type="number"
                    value={r.max ?? ''}
                    onChange={(e) => update(i, 'max', e.target.value)}
                    className="h-8 w-32 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                    placeholder="∞"
                  />
                </td>
                <td className="py-1 pr-3">
                  <input type="number" step="0.01" value={r.rate} onChange={(e) => update(i, 'rate', e.target.value)} className="h-8 w-24 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
                </td>
                <td className="py-1 pr-3">
                  <button type="button" onClick={() => removeRow(i)} className="h-7 rounded-md border border-red-200 px-2 text-xs text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40">
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
