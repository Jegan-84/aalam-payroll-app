'use client'

import Link from 'next/link'
import { useBlockingActionState } from '@/lib/ui/action-blocker'
import { saveEmployeeComponentAction, deleteEmployeeComponentAction } from '@/lib/components/actions'
import type { ComponentFormErrors, ComponentFormState, EmployeeComponentInput } from '@/lib/components/schemas'

type Props = {
  employeeId: string
  componentId?: string | null
  defaults?: Partial<EmployeeComponentInput> & { id?: string }
}

export function ComponentForm({ employeeId, componentId, defaults = {} }: Props) {
  const bound = saveEmployeeComponentAction.bind(null, componentId ?? null)
  const [state, action, pending] = useBlockingActionState<ComponentFormState, FormData>(bound, undefined)
  const err = (k: keyof ComponentFormErrors) => state?.errors?.[k]?.[0]
  const s = (k: keyof EmployeeComponentInput, fb = '') => String(defaults[k] ?? fb)

  return (
    <form action={action} className="max-w-2xl space-y-4">
      <input type="hidden" name="employee_id" value={employeeId} />

      {state?.errors?._form && (
        <div role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {state.errors._form[0]}
        </div>
      )}
      {state?.ok && (
        <div role="status" className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
          Saved.
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Code" required error={err('code')}>
            <input name="code" defaultValue={s('code')} placeholder="SHIFT / LUNCH / etc." required className={inputCls} />
          </Field>
          <Field label="Name" required error={err('name')}>
            <input name="name" defaultValue={s('name')} placeholder="Shift Allowance" required className={inputCls} />
          </Field>
          <Field label="Kind" required error={err('kind')}>
            <select name="kind" defaultValue={s('kind', 'earning')} className={selectCls}>
              <option value="earning">Earning (adds to net pay)</option>
              <option value="deduction">Deduction (reduces net pay)</option>
            </select>
          </Field>
          <Field label="Monthly amount (₹)" required error={err('monthly_amount')}>
            <input type="number" step="1" min="0" name="monthly_amount" defaultValue={s('monthly_amount', '0')} className={inputCls} />
          </Field>
          <Field label="Effective from" required error={err('effective_from')}>
            <input type="date" name="effective_from" defaultValue={s('effective_from')} required className={inputCls} />
          </Field>
          <Field label="Effective to (blank = ongoing)" error={err('effective_to')}>
            <input type="date" name="effective_to" defaultValue={s('effective_to')} className={inputCls} />
          </Field>
        </div>
        <div className="mt-3 space-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="prorate" defaultChecked={Boolean(defaults.prorate)} />
            Prorate by paid days (e.g. shift allowance scales with attendance)
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="include_in_gross" defaultChecked={Boolean(defaults.include_in_gross)} />
            Include in gross (affects ESI / TDS base) — leave off by default
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="is_active" defaultChecked={defaults.is_active !== false} />
            Active
          </label>
        </div>
        <div className="mt-3">
          <Field label="Notes" error={err('notes')}>
            <input name="notes" defaultValue={s('notes')} className={inputCls} />
          </Field>
        </div>
      </div>

      <div className="flex items-center justify-between">
        {componentId ? (
          <form action={deleteEmployeeComponentAction}>
            <input type="hidden" name="id" value={componentId} />
            <input type="hidden" name="employee_id" value={employeeId} />
            <button
              type="submit"
              onClick={(e) => { if (!confirm('Deactivate this component? Existing payslips are not affected.')) e.preventDefault() }}
              className="inline-flex h-9 items-center rounded-md border border-red-300 bg-red-50 px-4 text-sm font-medium text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
            >
              Deactivate
            </button>
          </form>
        ) : <span />}
        <div className="flex items-center gap-2">
          <Link href={`/employees/${employeeId}/components`} className="inline-flex h-9 items-center rounded-md border border-slate-300 px-4 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
            Cancel
          </Link>
          <button type="submit" disabled={pending} className="inline-flex h-9 items-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200">
            {pending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </form>
  )
}

const inputCls = 'block h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:focus:border-slate-100 dark:focus:ring-slate-100'
const selectCls = 'block h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:focus:border-slate-100 dark:focus:ring-slate-100'

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">{label}{required && <span className="text-red-600"> *</span>}</label>
      {children}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}
