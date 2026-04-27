'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useBlockingTransition } from '@/lib/ui/action-blocker'
import { updateLeaveTypePolicyAction } from '@/lib/leave/policy-actions'
import type { LeaveTypePolicyRow } from '@/lib/leave/policy-queries'

export function PolicyRow({ row }: { row: LeaveTypePolicyRow }) {
  const router = useRouter()
  const [pending, startTransition] = useBlockingTransition()
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [accrualType, setAccrualType] = useState(row.accrual_type)

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setMsg(null)
    const fd = new FormData(e.currentTarget)
    fd.set('id', String(row.id))
    startTransition(async () => {
      const res = await updateLeaveTypePolicyAction(fd)
      if (res.error) setMsg({ kind: 'err', text: res.error })
      else {
        setMsg({ kind: 'ok', text: 'Saved.' })
        router.refresh()
      }
    })
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <span className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-50">{row.code}</span>
          <span className="ml-2 text-sm text-slate-500">{row.name}</span>
        </div>
        {msg && (
          <span className={`text-xs ${msg.kind === 'ok' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
            {msg.text}
          </span>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Annual quota (days)">
          <input name="annual_quota_days" type="number" min="0" step="0.01" defaultValue={row.annual_quota_days} className={inputCls} />
        </Field>
        <Field label="Accrual type">
          <select
            name="accrual_type"
            defaultValue={row.accrual_type}
            onChange={(e) => setAccrualType(e.target.value as LeaveTypePolicyRow['accrual_type'])}
            className={inputCls}
          >
            <option value="annual">Annual (credited upfront on Jan 1)</option>
            <option value="half_yearly">Half-yearly (quota÷2 on Jan 1 + Jul 1)</option>
            <option value="monthly">Monthly (accrues each month)</option>
            <option value="none">None (LOP / unpaid)</option>
          </select>
        </Field>
        <Field label="Monthly accrual (days)" hint={accrualType === 'monthly' ? 'Added to `accrued` every month' : 'Ignored unless type = monthly'}>
          <input name="monthly_accrual_days" type="number" min="0" step="0.001" defaultValue={row.monthly_accrual_days} className={inputCls} disabled={accrualType !== 'monthly'} />
        </Field>
        <Field label="Carry-forward cap (days)" hint="Max balance rolled to next FY">
          <input name="carry_forward_max_days" type="number" min="0" step="0.01" defaultValue={row.carry_forward_max_days} className={inputCls} />
        </Field>
        <Field label="Max balance cap (days)" hint="Absolute cap on current balance. Blank = uncapped.">
          <input name="max_balance_days" type="number" min="0" step="0.01" defaultValue={row.max_balance_days ?? ''} className={inputCls} />
        </Field>
        <Checkbox name="is_paid" label="Paid leave" defaultChecked={row.is_paid} />
        <Checkbox name="encashable_on_exit" label="Encashable on exit" defaultChecked={row.encashable_on_exit} />
        <Checkbox name="is_active" label="Active" defaultChecked={row.is_active} />
      </div>

      <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/50">
        <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">
          Applicable to employment types
          <span className="ml-2 text-slate-400 normal-case">
            (if none selected, applies to everyone)
          </span>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          {(['full_time', 'probation', 'contract', 'intern', 'consultant'] as const).map((et) => {
            const active = row.applicable_employment_types
            const checked = active == null || active.length === 0 || active.includes(et)
            return (
              <label key={et} className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                <input type="checkbox" name={`emp_${et}`} defaultChecked={checked} />
                {et.replace('_', ' ')}
              </label>
            )
          })}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-end">
        <button
          type="submit"
          disabled={pending}
          className="h-8 rounded-md bg-slate-900 px-3 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
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

function Checkbox({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-800 dark:text-slate-200">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} />
      {label}
    </label>
  )
}

const inputCls = 'mt-1 h-9 rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 disabled:opacity-50'
