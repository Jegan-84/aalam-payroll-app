'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useSnackbar } from '@/components/ui/snackbar'
import { useBlockingTransition } from '@/lib/ui/action-blocker'
import { savePtPeriodAction } from '@/lib/settings/pt-actions'

type Slab = {
  half_year_gross_min: number
  half_year_gross_max: number | null
  half_year_pt_amount: number
}

type Props = {
  stateCode: string
  effectiveFrom: string
  effectiveTo: string | null
  initial: Slab[]
}

export function PeriodEditor({ stateCode, effectiveFrom, effectiveTo: initialEffectiveTo, initial }: Props) {
  const router = useRouter()
  const snack = useSnackbar()
  const [rows, setRows] = useState<Slab[]>(initial)
  const [effectiveTo, setEffectiveTo] = useState<string>(initialEffectiveTo ?? '')
  const [pending, startTransition] = useBlockingTransition()

  const update = (i: number, field: keyof Slab, v: string) => {
    setRows((prev) =>
      prev.map((r, idx) =>
        idx !== i
          ? r
          : {
              ...r,
              [field]:
                field === 'half_year_gross_max'
                  ? v.trim() === '' ? null : Number(v)
                  : Number(v),
            },
      ),
    )
  }

  const addRow = () =>
    setRows((prev) => [
      ...prev,
      {
        half_year_gross_min: prev.length > 0 ? (prev[prev.length - 1].half_year_gross_max ?? 0) + 1 : 0,
        half_year_gross_max: null,
        half_year_pt_amount: 0,
      },
    ])

  const removeRow = (i: number) => setRows((prev) => prev.filter((_, idx) => idx !== i))

  const save = () => {
    startTransition(async () => {
      const fd = new FormData()
      fd.set('state_code', stateCode)
      fd.set('effective_from', effectiveFrom)
      fd.set('effective_to', effectiveTo)
      fd.set('slabs', JSON.stringify(rows))
      const res = await savePtPeriodAction(fd)
      if (res.error) snack.show({ kind: 'error', message: res.error })
      else {
        snack.show({ kind: 'success', message: 'Saved.' })
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Effective from</label>
          <input value={effectiveFrom} readOnly className="mt-1 h-9 w-[160px] rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400" />
        </div>
        <div>
          <label className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Effective to (blank = ongoing)</label>
          <input
            type="date"
            value={effectiveTo}
            onChange={(e) => setEffectiveTo(e.target.value)}
            className="mt-1 block h-9 w-[160px] rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={addRow}>+ Row</Button>
          <Button size="sm" onClick={save} disabled={pending}>
            {pending ? 'Saving…' : 'Save period'}
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-800">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2">Half-year gross min (₹)</th>
              <th className="px-3 py-2">Half-year gross max (₹) · blank = open-ended</th>
              <th className="px-3 py-2">Half-year PT (₹)</th>
              <th className="px-3 py-2">Monthly deduction</th>
              <th className="px-3 py-2">{' '}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-4 text-xs text-slate-500">No slabs. Click &quot;+ Row&quot;.</td></tr>
            )}
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="px-3 py-2">
                  <input type="number" value={r.half_year_gross_min} onChange={(e) => update(i, 'half_year_gross_min', e.target.value)} className={inputCls} />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    value={r.half_year_gross_max ?? ''}
                    onChange={(e) => update(i, 'half_year_gross_max', e.target.value)}
                    className={inputCls}
                    placeholder="∞"
                  />
                </td>
                <td className="px-3 py-2">
                  <input type="number" value={r.half_year_pt_amount} onChange={(e) => update(i, 'half_year_pt_amount', e.target.value)} className={inputCls} />
                </td>
                <td className="px-3 py-2 text-xs text-slate-500 tabular-nums">≈ ₹{Math.round(r.half_year_pt_amount / 6)}/mo</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => removeRow(i)} className="rounded-md px-2 py-1 text-xs text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40">
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

const inputCls =
  'h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-950'
