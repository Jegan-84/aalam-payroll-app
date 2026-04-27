'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useBlockingTransition } from '@/lib/ui/action-blocker'
import { useSnackbar } from '@/components/ui/snackbar'
import { createLeaveTypePolicyAction } from '@/lib/leave/policy-actions'

const EMP_TYPES = [
  { key: 'full_time', label: 'Full-time' },
  { key: 'probation', label: 'Probation' },
  { key: 'contract',  label: 'Contract' },
  { key: 'intern',    label: 'Intern' },
  { key: 'consultant', label: 'Consultant' },
] as const

export function NewLeaveTypeForm() {
  const router = useRouter()
  const snack = useSnackbar()
  const [pending, startTransition] = useBlockingTransition()
  const [open, setOpen] = useState(false)

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await createLeaveTypePolicyAction(fd)
      if (res.error) snack.show({ kind: 'error', message: res.error })
      else {
        snack.show({ kind: 'success', message: 'Leave type created.' })
        ;(e.target as HTMLFormElement).reset()
        setOpen(false)
        router.refresh()
      }
    })
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-slate-900 hover:bg-slate-50 dark:text-slate-50 dark:hover:bg-slate-950"
      >
        <span>+ New leave type {open ? '' : '(Maternity, Paternity, Bereavement…)'}</span>
        <span className="text-slate-400">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <form onSubmit={submit} className="space-y-4 border-t border-slate-100 p-4 dark:border-slate-800">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Code" hint="A-Z, 0-9, _ (e.g. MATERNITY)">
              <input name="code" required placeholder="MATERNITY" className={inputCls} />
            </Field>
            <Field label="Name" className="lg:col-span-2">
              <input name="name" required placeholder="Maternity Leave" className={inputCls} />
            </Field>
            <Field label="Paid?">
              <label className="flex h-9 items-center gap-2 text-sm">
                <input type="checkbox" name="is_paid" defaultChecked /> paid
              </label>
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Annual quota (days)">
              <input name="annual_quota_days" type="number" min="0" step="0.5" defaultValue={0} className={inputCls} />
            </Field>
            <Field label="Accrual">
              <select name="accrual_type" defaultValue="annual" className={inputCls}>
                <option value="annual">Annual (upfront)</option>
                <option value="monthly">Monthly</option>
                <option value="half_yearly">Half-yearly</option>
                <option value="none">None (manual grants only)</option>
              </select>
            </Field>
            <Field label="Monthly accrual (if monthly)">
              <input name="monthly_accrual_days" type="number" min="0" step="0.5" defaultValue={0} className={inputCls} />
            </Field>
            <Field label="Carry-fwd cap (days)">
              <input name="carry_forward_max_days" type="number" min="0" step="0.5" defaultValue={0} className={inputCls} />
            </Field>
            <Field label="Max balance (optional)">
              <input name="max_balance_days" type="number" min="0" step="0.5" placeholder="(no cap)" className={inputCls} />
            </Field>
            <Field label="Encashable on exit">
              <label className="flex h-9 items-center gap-2 text-sm">
                <input type="checkbox" name="encashable_on_exit" /> encashable
              </label>
            </Field>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
              Applicable employment types
            </label>
            <div className="flex flex-wrap gap-3">
              {EMP_TYPES.map((t) => (
                <label key={t.key} className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" name={`emp_${t.key}`} /> {t.label}
                </label>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Tick none to make this type only assignable via Special Grant on /leave/balances. Tick all to apply to everyone. Otherwise apply only to the ticked types.
            </p>
          </div>


          <div className="flex justify-end">
            <button
              type="submit"
              disabled={pending}
              className="h-9 rounded-md bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 disabled:opacity-60"
            >
              {pending ? 'Creating…' : 'Create leave type'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

const inputCls = 'h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950'

function Field({ label, hint, children, className = '' }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1 ${className}`}>
      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-slate-500">{hint}</p>}
    </div>
  )
}
