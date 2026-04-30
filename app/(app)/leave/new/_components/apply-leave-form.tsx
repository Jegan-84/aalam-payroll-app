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
  const [isHalfDay, setIsHalfDay] = useState(false)

  const holidaysSet = useMemo(() => new Set(holidayDates), [holidayDates])
  const fullDays = useMemo(() => {
    if (!from || !to || to < from) return 0
    return countLeaveDays(from, to, { weeklyOffDays, holidayDates: holidaysSet })
  }, [from, to, weeklyOffDays, holidaysSet])

  // Half-day applies only on a single-day range. The checkbox is rendered
  // (and its value submitted) only when from == to, so if the user expands
  // the range the input simply unmounts and the form receives no half-day
  // flag — local state can stay set without affecting submission.
  const sameDay = !!from && from === to
  const halfDayEffective = sameDay && isHalfDay
  const days = halfDayEffective ? 0.5 : fullDays

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
              <span className="text-slate-500 dark:text-slate-400">{halfDayEffective ? 'Half-day leave:' : 'Working days in range:'}</span>{' '}
              <span className="font-semibold text-slate-900 dark:text-slate-100">{days}</span>
            </div>
          </div>

          {sameDay && (
            <div className="sm:col-span-2">
              <label
                className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
                title="Half-day applies only when the from and to dates match. 0.5 day will be deducted from your balance."
              >
                <input
                  type="checkbox"
                  name="is_half_day"
                  checked={isHalfDay}
                  onChange={(e) => setIsHalfDay(e.target.checked)}
                />
                Apply as <strong>half-day</strong> leave (0.5 day)
              </label>
              {err('is_half_day') && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{err('is_half_day')}</p>}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Link href="/leave" className="inline-flex h-9 items-center rounded-md border border-slate-300 px-4 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
          Cancel
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-9 items-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
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
