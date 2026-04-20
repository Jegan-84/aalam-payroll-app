'use client'

import { useMemo, useState } from 'react'
import { useBlockingActionState } from '@/lib/ui/action-blocker'
import Link from 'next/link'
import { applyLeaveAction } from '@/lib/leave/actions'
import { countLeaveDays } from '@/lib/leave/engine'
import type { LeaveFormErrors } from '@/lib/leave/schemas'

type Props = {
  employees: { id: string; employee_code: string; full_name_snapshot: string }[]
  leaveTypes: { id: number; code: string; name: string; is_paid: boolean }[]
  weeklyOffDays: number[]
  holidayDates: string[]   // already within a reasonable horizon (e.g. next 12 months)
}

export function ApplyLeaveForm({ employees, leaveTypes, weeklyOffDays, holidayDates }: Props) {
  const [state, action, pending] = useBlockingActionState(applyLeaveAction, undefined)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const holidaysSet = useMemo(() => new Set(holidayDates), [holidayDates])
  const days = useMemo(() => {
    if (!from || !to || to < from) return 0
    return countLeaveDays(from, to, { weeklyOffDays, holidayDates: holidaysSet })
  }, [from, to, weeklyOffDays, holidaysSet])

  const err = (k: keyof LeaveFormErrors) => state?.errors?.[k]?.[0]

  return (
    <form action={action} className="max-w-xl space-y-4">
      {state?.errors?._form && (
        <div role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {state.errors._form[0]}
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Employee" error={err('employee_id')} required>
            <select name="employee_id" required defaultValue="" className={selectCls}>
              <option value="" disabled>Select employee</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.full_name_snapshot} ({e.employee_code})
                </option>
              ))}
            </select>
          </Field>

          <Field label="Leave type" error={err('leave_type_id')} required>
            <select name="leave_type_id" required defaultValue="" className={selectCls}>
              <option value="" disabled>Select type</option>
              {leaveTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code} — {t.name}{!t.is_paid ? ' (unpaid)' : ''}
                </option>
              ))}
            </select>
          </Field>

          <Field label="From" error={err('from_date')} required>
            <input
              type="date"
              name="from_date"
              required
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className={inputCls}
            />
          </Field>

          <Field label="To" error={err('to_date')} required>
            <input
              type="date"
              name="to_date"
              required
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className={inputCls}
            />
          </Field>

          <Field label="Reason">
            <input name="reason" className={inputCls} placeholder="Optional" />
          </Field>

          <div className="flex items-end">
            <div className="w-full rounded-md border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-950">
              <span className="text-slate-500 dark:text-slate-400">Working days in range:</span>{' '}
              <span className="font-semibold text-slate-900 dark:text-slate-100">{days}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Link href="/leave" className="inline-flex h-9 items-center rounded-md border border-slate-300 px-4 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
          Cancel
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-9 items-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
        >
          {pending ? 'Submitting…' : 'Submit application'}
        </button>
      </div>
    </form>
  )
}

const inputCls = 'block h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:focus:border-slate-100 dark:focus:ring-slate-100'
const selectCls = 'block h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:focus:border-slate-100 dark:focus:ring-slate-100'

function Field({
  label, required, error, children,
}: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
        {label}{required && <span className="text-red-600"> *</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}
