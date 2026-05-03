'use client'

import { useBlockingActionState } from '@/lib/ui/action-blocker'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { TemplateFormErrors, TemplateFormState } from '@/lib/salary-templates/schemas'

type Designation = { id: number; name: string }
type Defaults = Partial<Record<string, string | number | boolean | null>>

type Props = {
  mode: 'create' | 'edit'
  action: (prev: TemplateFormState, formData: FormData) => Promise<TemplateFormState>
  designations: Designation[]
  defaults?: Defaults
}

export function TemplateForm({ mode, action, designations, defaults = {} }: Props) {
  const [state, formAction, pending] = useBlockingActionState(action, undefined)
  const router = useRouter()
  const err = (k: keyof TemplateFormErrors) => state?.errors?.[k]?.[0]
  const v = (k: string, fallback: string = '') => String(defaults[k] ?? fallback)

  // After create, redirect to the edit page for the new template
  if (state?.ok && state.id && mode === 'create') {
    router.push(`/salary/templates/${state.id}`)
  }

  return (
    <form action={formAction} className="max-w-3xl space-y-4">
      {state?.errors?._form && (
        <div role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {state.errors._form[0]}
        </div>
      )}
      {mode === 'edit' && state?.ok && (
        <div role="status" className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
          Saved.
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Identity
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Code" required error={err('code')}>
            <input name="code" defaultValue={v('code')} placeholder="CONS_A" className={inputCls} required />
          </Field>
          <Field label="Name" required error={err('name')}>
            <input name="name" defaultValue={v('name')} placeholder="Consultant — Tier A" className={inputCls} required />
          </Field>
          <Field label="Description" error={err('description')}>
            <input name="description" defaultValue={v('description')} className={inputCls} />
          </Field>
          <Field label="Employment type" error={err('employment_type')}>
            <select name="employment_type" defaultValue={v('employment_type')} className={selectCls}>
              <option value="">—</option>
              <option value="full_time">Full-time</option>
              <option value="contract">Contract</option>
              <option value="intern">Intern</option>
              <option value="consultant">Consultant</option>
            </select>
          </Field>
          <Field label="Designation" error={err('designation_id')}>
            <select name="designation_id" defaultValue={v('designation_id')} className={selectCls}>
              <option value="">—</option>
              {designations.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Display order" error={err('display_order')}>
            <input type="number" name="display_order" defaultValue={v('display_order', '100')} className={inputCls} />
          </Field>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Compensation
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Annual fixed CTC" required error={err('annual_fixed_ctc')}>
            <input type="number" name="annual_fixed_ctc" min="0" step="1" defaultValue={v('annual_fixed_ctc')} className={inputCls} required />
          </Field>
          <Field label="Variable pay (% of gross)" error={err('variable_pay_percent')}>
            <input type="number" name="variable_pay_percent" min="0" step="0.1" defaultValue={v('variable_pay_percent', '10')} className={inputCls} />
          </Field>
          <Field label="EPF mode" required error={err('epf_mode')}>
            <select name="epf_mode" defaultValue={v('epf_mode', 'ceiling')} className={selectCls}>
              <option value="ceiling">Ceiling (12% × min(Basic, 15,000))</option>
              <option value="fixed_max">Fixed max (₹1,800 always)</option>
              <option value="actual">Actual (12% × Basic, no cap)</option>
            </select>
          </Field>
          <Field label="Medical insurance / month" error={err('medical_insurance_monthly')}>
            <input type="number" name="medical_insurance_monthly" min="0" step="1" defaultValue={v('medical_insurance_monthly', '500')} className={inputCls} />
          </Field>
          <Field label="Internet / year" error={err('internet_annual')}>
            <input type="number" name="internet_annual" min="0" step="1" defaultValue={v('internet_annual', '12000')} className={inputCls} />
          </Field>
          <Field label="Training / year" error={err('training_annual')}>
            <input type="number" name="training_annual" min="0" step="1" defaultValue={v('training_annual', '12000')} className={inputCls} />
          </Field>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Notes &amp; status
        </h3>
        <div className="space-y-3">
          <Field label="Notes" error={err('notes')}>
            <textarea name="notes" rows={2} defaultValue={v('notes')} className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:focus:border-slate-100" />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="is_active" defaultChecked={defaults.is_active !== false} />
            Active (inactive templates are hidden from the &ldquo;Start from template&rdquo; dropdown)
          </label>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Link href="/salary/templates" className="inline-flex h-9 items-center rounded-md border border-slate-300 px-4 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
          Cancel
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-9 items-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? 'Saving…' : mode === 'create' ? 'Create template' : 'Save changes'}
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
