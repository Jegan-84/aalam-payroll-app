'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useBlockingTransition } from '@/lib/ui/action-blocker'
import { Dialog } from '@/components/ui/dialog'
import { useSnackbar } from '@/components/ui/snackbar'
import { convertEmploymentTypeAction } from '@/lib/leave/actions'

const TYPE_LABELS: Record<string, string> = {
  full_time: 'Full-time (permanent)',
  probation: 'Probation',
  contract:  'Contract',
  intern:    'Intern',
  consultant: 'Consultant',
}

type ConversionResult = {
  added: Array<{ code: string; days: number }>
  dropped: Array<{ code: string; balance: number }>
}

export function ConvertTypeButton({
  employeeId, currentType, employeeLabel,
}: {
  employeeId: string
  currentType: string
  employeeLabel: string
}) {
  const router = useRouter()
  const snack = useSnackbar()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useBlockingTransition()
  const [err, setErr] = useState<string | null>(null)
  const [result, setResult] = useState<ConversionResult | null>(null)

  const close = () => {
    if (pending) return
    setErr(null)
    setResult(null)
    setOpen(false)
  }

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErr(null)
    setResult(null)
    const fd = new FormData(e.currentTarget)
    fd.set('employee_id', employeeId)
    startTransition(async () => {
      const res = await convertEmploymentTypeAction(fd)
      if (res.error) setErr(res.error)
      else {
        setResult({ added: res.added ?? [], dropped: res.dropped ?? [] })
        snack.show({ kind: 'success', message: 'Employment type converted.' })
        router.refresh()
      }
    })
  }

  const otherTypes = Object.keys(TYPE_LABELS).filter((t) => t !== currentType)

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); setErr(null); setResult(null) }}
        className="inline-flex h-9 items-center whitespace-nowrap rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
      >
        Convert employment type →
      </button>

      <Dialog
        open={open}
        onClose={close}
        size="md"
        title={`Convert ${employeeLabel}`}
        subtitle={`Currently ${TYPE_LABELS[currentType] ?? currentType}. Converting also reconciles leave eligibility — newly-eligible types get prorated balances from the effective date.`}
      >
        {result ? (
          <div className="space-y-4">
            <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-100">
              Conversion complete.
            </div>

            {result.added.length > 0 && (
              <div>
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Newly-eligible — granted</h4>
                <ul className="space-y-1 text-sm">
                  {result.added.map((a) => (
                    <li key={a.code} className="flex justify-between rounded-md bg-slate-50 px-3 py-1.5 dark:bg-slate-950">
                      <span className="font-medium">{a.code}</span>
                      <span className="tabular-nums">{a.days.toFixed(1)} d</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.dropped.length > 0 && (
              <div>
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">No longer eligible — balances retained</h4>
                <p className="mb-1 text-[11px] text-slate-500">Existing balances aren&apos;t deleted. Use the Adjust dialog on /leave/balances if you want to claw them back.</p>
                <ul className="space-y-1 text-sm">
                  {result.dropped.map((d) => (
                    <li key={d.code} className="flex justify-between rounded-md bg-slate-50 px-3 py-1.5 dark:bg-slate-950">
                      <span className="font-medium">{d.code}</span>
                      <span className="text-slate-500 tabular-nums">balance {d.balance.toFixed(1)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.added.length === 0 && result.dropped.length === 0 && (
              <p className="text-sm text-slate-500">No leave eligibility changed for this conversion.</p>
            )}

            <div className="flex justify-end border-t border-slate-100 pt-3 dark:border-slate-800">
              <button
                type="button"
                onClick={close}
                className="h-9 rounded-md bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700 active:bg-brand-800"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                New employment type <span className="text-red-600">*</span>
              </label>
              <select name="new_employment_type" required className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">
                <option value="">— select —</option>
                {otherTypes.map((t) => (
                  <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Effective date <span className="text-red-600">*</span>
              </label>
              <input
                name="effective_date"
                type="date"
                required
                defaultValue={new Date().toISOString().slice(0, 10)}
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Prorate anchor for newly-eligible types. Months remaining from this date through Dec 31 ÷ 12.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Reason <span className="text-red-600">*</span>
              </label>
              <textarea
                name="reason"
                required
                rows={2}
                placeholder="e.g. Probation completed; confirmed as full-time per ticket #4527"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            {err && <p className="text-xs text-red-600 dark:text-red-400">{err}</p>}

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
              <button
                type="button"
                onClick={close}
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
                {pending ? 'Converting…' : 'Convert'}
              </button>
            </div>
          </form>
        )}
      </Dialog>
    </>
  )
}
