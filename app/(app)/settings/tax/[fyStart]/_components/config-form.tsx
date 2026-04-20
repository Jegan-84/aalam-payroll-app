'use client'

import { useState } from 'react'
import { useBlockingTransition } from '@/lib/ui/action-blocker'
import { saveConfigAction } from '@/lib/settings/tax-actions'

type Config = {
  standard_deduction: number
  rebate_87a_income_limit: number
  rebate_87a_max_amount: number
  cess_percent: number
  surcharge_enabled: boolean
}

type Props = {
  fyStart: string
  fyEnd: string
  regime: 'NEW' | 'OLD'
  initial: Config
}

export function ConfigForm({ fyStart, fyEnd, regime, initial }: Props) {
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [pending, startTransition] = useBlockingTransition()

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setMsg(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await saveConfigAction(fd)
      if (res.error) setMsg({ kind: 'err', text: res.error })
      else setMsg({ kind: 'ok', text: 'Saved.' })
    })
  }

  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">{regime} — Tax config</h3>
        {msg && (
          <span className={`text-xs ${msg.kind === 'ok' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
            {msg.text}
          </span>
        )}
      </div>

      <input type="hidden" name="fy_start" value={fyStart} />
      <input type="hidden" name="fy_end" value={fyEnd} />
      <input type="hidden" name="regime" value={regime} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Standard deduction (₹)">
          <input type="number" name="standard_deduction" defaultValue={initial.standard_deduction} className={inputCls} />
        </Field>
        <Field label="Rebate 87A — income limit (₹)">
          <input type="number" name="rebate_87a_income_limit" defaultValue={initial.rebate_87a_income_limit} className={inputCls} />
        </Field>
        <Field label="Rebate 87A — max amount (₹)">
          <input type="number" name="rebate_87a_max_amount" defaultValue={initial.rebate_87a_max_amount} className={inputCls} />
        </Field>
        <Field label="Cess (%)">
          <input type="number" step="0.01" name="cess_percent" defaultValue={initial.cess_percent} className={inputCls} />
        </Field>
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" name="surcharge_enabled" defaultChecked={initial.surcharge_enabled} />
        Surcharge enabled
      </label>

      <div className="mt-3">
        <button type="submit" disabled={pending} className="h-8 rounded-md bg-slate-900 px-3 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200">
          {pending ? 'Saving…' : 'Save config'}
        </button>
      </div>
    </form>
  )
}

const inputCls = 'block h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:focus:border-slate-100 dark:focus:ring-slate-100'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">{label}</label>
      {children}
    </div>
  )
}
