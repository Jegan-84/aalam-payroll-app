'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useBlockingActionState } from '@/lib/ui/action-blocker'
import { saveCompanyAction } from '@/lib/companies/actions'
import type { CompanyFormErrors, CompanyFormState, CompanyInput } from '@/lib/companies/schemas'

type Defaults = Partial<Record<keyof CompanyInput, string | number | boolean | null | undefined>>

type Props = {
  mode: 'create' | 'edit'
  defaults?: Defaults
}

export function CompanyForm({ mode, defaults = {} }: Props) {
  const router = useRouter()
  const [state, action, pending] = useBlockingActionState<CompanyFormState, FormData>(saveCompanyAction, undefined)
  const err = (k: keyof CompanyFormErrors) => state?.errors?.[k]?.[0]
  const s = (k: keyof CompanyInput, fb: string = '') => String(defaults[k] ?? fb)

  if (state?.ok && state.id && mode === 'create') router.push(`/settings/companies/${state.id}`)

  return (
    <form action={action} className="max-w-3xl space-y-4">
      {defaults.id ? <input type="hidden" name="id" value={String(defaults.id)} /> : null}

      {state?.errors?._form && (
        <div role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {state.errors._form[0]}
        </div>
      )}
      {state?.ok && mode === 'edit' && (
        <div role="status" className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
          Saved.
        </div>
      )}

      <Card title="Identity">
        <Grid>
          <Field label="Code" required error={err('code')}>
            <input name="code" defaultValue={s('code')} placeholder="AALAM_INFO" required className={inputCls} />
          </Field>
          <Field label="Legal name" required error={err('legal_name')}>
            <input name="legal_name" defaultValue={s('legal_name')} placeholder="Aalam Info Solutions LLP" required className={inputCls} />
          </Field>
          <Field label="Display name" required error={err('display_name')}>
            <input name="display_name" defaultValue={s('display_name')} placeholder="Aalam Info Solutions" required className={inputCls} />
          </Field>
          <Field label="Logo URL" error={err('logo_url')}>
            <input name="logo_url" defaultValue={s('logo_url')} placeholder="https://…/logo.png" className={inputCls} />
          </Field>
        </Grid>
      </Card>

      <Card title="Statutory identifiers">
        <Grid>
          <Field label="PAN" error={err('pan')}>
            <input name="pan" defaultValue={s('pan')} placeholder="ABCDE1234F" className={inputCls} style={{ textTransform: 'uppercase' }} />
          </Field>
          <Field label="TAN" error={err('tan')}>
            <input name="tan" defaultValue={s('tan')} placeholder="CHEN12345A" className={inputCls} style={{ textTransform: 'uppercase' }} />
          </Field>
          <Field label="GSTIN" error={err('gstin')}>
            <input name="gstin" defaultValue={s('gstin')} className={inputCls} />
          </Field>
          <Field label="CIN" error={err('cin')}>
            <input name="cin" defaultValue={s('cin')} className={inputCls} />
          </Field>
          <Field label="EPF establishment ID" error={err('epf_establishment_id')}>
            <input name="epf_establishment_id" defaultValue={s('epf_establishment_id')} className={inputCls} />
          </Field>
          <Field label="ESI establishment ID" error={err('esi_establishment_id')}>
            <input name="esi_establishment_id" defaultValue={s('esi_establishment_id')} className={inputCls} />
          </Field>
          <Field label="PT registration no." error={err('pt_registration_no')}>
            <input name="pt_registration_no" defaultValue={s('pt_registration_no')} className={inputCls} />
          </Field>
        </Grid>
      </Card>

      <Card title="Address">
        <Grid>
          <Field label="Address line 1" error={err('address_line1')}>
            <input name="address_line1" defaultValue={s('address_line1')} className={inputCls} />
          </Field>
          <Field label="Address line 2" error={err('address_line2')}>
            <input name="address_line2" defaultValue={s('address_line2')} className={inputCls} />
          </Field>
          <Field label="City" error={err('city')}>
            <input name="city" defaultValue={s('city')} className={inputCls} />
          </Field>
          <Field label="State" error={err('state')}>
            <input name="state" defaultValue={s('state')} className={inputCls} />
          </Field>
          <Field label="Pincode" error={err('pincode')}>
            <input name="pincode" defaultValue={s('pincode')} className={inputCls} />
          </Field>
          <Field label="Country" error={err('country')}>
            <input name="country" defaultValue={s('country', 'India')} className={inputCls} />
          </Field>
        </Grid>
      </Card>

      <Card title="Status">
        <Grid>
          <Field label="Display order" error={err('display_order')}>
            <input type="number" name="display_order" defaultValue={s('display_order', '100')} className={inputCls} />
          </Field>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="is_active" defaultChecked={defaults.is_active !== false} />
              Active
            </label>
          </div>
        </Grid>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Link href="/settings/companies" className="inline-flex h-9 items-center rounded-md border border-slate-300 px-4 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
          Cancel
        </Link>
        <button type="submit" disabled={pending} className="inline-flex h-9 items-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200">
          {pending ? 'Saving…' : mode === 'create' ? 'Create company' : 'Save changes'}
        </button>
      </div>
    </form>
  )
}

const inputCls = 'block h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:focus:border-slate-100 dark:focus:ring-slate-100'

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</div>
      {children}
    </div>
  )
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
}
function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
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
