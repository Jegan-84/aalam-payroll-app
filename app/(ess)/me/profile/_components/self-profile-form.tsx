'use client'

import * as React from 'react'
import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { useSnackbar } from '@/components/ui/snackbar'
import { updateMyProfileAction } from '@/lib/employees/self-service'
import type { SelfProfileState } from '@/lib/employees/self-service-constants'

type Defaults = Record<string, string | number | boolean | null | undefined>

export function SelfProfileForm({ defaults }: { defaults: Defaults }) {
  const router = useRouter()
  const snack = useSnackbar()
  const [state, formAction, pending] = useActionState<SelfProfileState, FormData>(
    updateMyProfileAction,
    undefined,
  )

  const [sameAsCurrent, setSameAsCurrent] = React.useState<boolean>(
    Boolean(defaults.permanent_same_as_current ?? true),
  )

  React.useEffect(() => {
    if (state?.ok) {
      snack.show({ kind: 'success', message: 'Profile updated.' })
      router.refresh()
    } else if (state?.errors?._form?.length) {
      snack.show({ kind: 'error', message: state.errors._form[0] })
    }
  }, [state, snack, router])

  const v = (k: string) => (defaults[k] == null ? '' : String(defaults[k]))
  const err = (k: string): string | undefined => {
    const errs = state?.errors as Record<string, string[] | undefined> | undefined
    return errs?.[k]?.[0]
  }

  return (
    <form action={formAction} className="space-y-6">
      <Section title="Personal" hint="Name, contact, emergency contact.">
        <Grid>
          <Field label="First name" required error={err('first_name')}>
            <input name="first_name" defaultValue={v('first_name')} className={inp} required />
          </Field>
          <Field label="Middle name" error={err('middle_name')}>
            <input name="middle_name" defaultValue={v('middle_name')} className={inp} />
          </Field>
          <Field label="Last name" required error={err('last_name')}>
            <input name="last_name" defaultValue={v('last_name')} className={inp} required />
          </Field>
          <Field label="Date of birth" error={err('date_of_birth')}>
            <input type="date" name="date_of_birth" defaultValue={v('date_of_birth')} className={inp} />
          </Field>
          <Field label="Gender" error={err('gender')}>
            <select name="gender" defaultValue={v('gender')} className={inp}>
              <option value="">—</option>
              <option value="M">Male</option>
              <option value="F">Female</option>
              <option value="O">Other</option>
            </select>
          </Field>
          <Field label="Marital status" error={err('marital_status')}>
            <select name="marital_status" defaultValue={v('marital_status')} className={inp}>
              <option value="">—</option>
              <option value="single">Single</option>
              <option value="married">Married</option>
              <option value="divorced">Divorced</option>
              <option value="widowed">Widowed</option>
            </select>
          </Field>
          <Field label="Blood group">
            <input name="blood_group" defaultValue={v('blood_group')} className={inp} placeholder="O+ / B-" />
          </Field>
          <Field label="Personal email" error={err('personal_email')}>
            <input type="email" name="personal_email" defaultValue={v('personal_email')} className={inp} />
          </Field>
          <Field label="Personal phone">
            <input name="personal_phone" defaultValue={v('personal_phone')} className={inp} />
          </Field>
        </Grid>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Emergency contact — name">
            <input name="emergency_contact_name" defaultValue={v('emergency_contact_name')} className={inp} />
          </Field>
          <Field label="Relation">
            <input name="emergency_contact_relation" defaultValue={v('emergency_contact_relation')} className={inp} />
          </Field>
          <Field label="Phone">
            <input name="emergency_contact_phone" defaultValue={v('emergency_contact_phone')} className={inp} />
          </Field>
        </div>
      </Section>

      <Section title="Current address">
        <Grid>
          <Field label="Line 1"><input name="current_address_line1" defaultValue={v('current_address_line1')} className={inp} /></Field>
          <Field label="Line 2"><input name="current_address_line2" defaultValue={v('current_address_line2')} className={inp} /></Field>
          <Field label="City"><input name="current_address_city" defaultValue={v('current_address_city')} className={inp} /></Field>
          <Field label="State"><input name="current_address_state" defaultValue={v('current_address_state')} className={inp} /></Field>
          <Field label="PIN code"><input name="current_address_pincode" defaultValue={v('current_address_pincode')} className={inp} /></Field>
          <Field label="Country"><input name="current_address_country" defaultValue={v('current_address_country') || 'India'} className={inp} /></Field>
        </Grid>
      </Section>

      <Section
        title="Permanent address"
        hint="Same as current is convenient — uncheck if your permanent address differs."
      >
        <label className="mb-3 inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="permanent_same_as_current"
            checked={sameAsCurrent}
            onChange={(e) => setSameAsCurrent(e.target.checked)}
          />
          <span>Same as current address</span>
        </label>
        {!sameAsCurrent && (
          <Grid>
            <Field label="Line 1"><input name="permanent_address_line1" defaultValue={v('permanent_address_line1')} className={inp} /></Field>
            <Field label="Line 2"><input name="permanent_address_line2" defaultValue={v('permanent_address_line2')} className={inp} /></Field>
            <Field label="City"><input name="permanent_address_city" defaultValue={v('permanent_address_city')} className={inp} /></Field>
            <Field label="State"><input name="permanent_address_state" defaultValue={v('permanent_address_state')} className={inp} /></Field>
            <Field label="PIN code"><input name="permanent_address_pincode" defaultValue={v('permanent_address_pincode')} className={inp} /></Field>
            <Field label="Country"><input name="permanent_address_country" defaultValue={v('permanent_address_country') || 'India'} className={inp} /></Field>
          </Grid>
        )}
      </Section>

      <Section title="Statutory IDs" hint="PAN, Aadhaar, UAN, ESI, Passport. HR will verify.">
        <Grid>
          <Field label="PAN" error={err('pan_number')}>
            <input name="pan_number" defaultValue={v('pan_number')} className={inp} placeholder="ABCDE1234F" />
          </Field>
          <Field label="Aadhaar (12 digits)" error={err('aadhaar_number')}>
            <input name="aadhaar_number" defaultValue={v('aadhaar_number')} className={inp} placeholder="123412341234" />
          </Field>
          <Field label="UAN"><input name="uan_number" defaultValue={v('uan_number')} className={inp} /></Field>
          <Field label="ESI number"><input name="esi_number" defaultValue={v('esi_number')} className={inp} /></Field>
          <Field label="Passport"><input name="passport_number" defaultValue={v('passport_number')} className={inp} /></Field>
        </Grid>
      </Section>

      <Section title="Bank" hint="Used by Finance to credit your salary.">
        <Grid>
          <Field label="Bank name"><input name="bank_name" defaultValue={v('bank_name')} className={inp} /></Field>
          <Field label="Account number"><input name="bank_account_number" defaultValue={v('bank_account_number')} className={inp} /></Field>
          <Field label="IFSC" error={err('bank_ifsc')}>
            <input name="bank_ifsc" defaultValue={v('bank_ifsc')} className={inp} placeholder="HDFC0ABCDEF" />
          </Field>
          <Field label="Account type">
            <select name="bank_account_type" defaultValue={v('bank_account_type')} className={inp}>
              <option value="">—</option>
              <option value="savings">Savings</option>
              <option value="current">Current</option>
            </select>
          </Field>
          <Field label="Account holder name">
            <input name="bank_account_holder_name" defaultValue={v('bank_account_holder_name')} className={inp} />
          </Field>
        </Grid>
      </Section>

      <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-200 bg-white/90 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center rounded-md bg-brand-600 px-5 text-sm font-medium text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 disabled:opacity-60"
        >
          {pending ? 'Saving…' : 'Save profile'}
        </button>
      </div>
    </form>
  )
}

const inp =
  'h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950'

function Section({
  title, hint, children,
}: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">{title}</h3>
      {hint && <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
}

function Field({
  label, required, error, children,
}: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label} {required && <span className="text-rose-600">*</span>}
      </span>
      <span className="mt-1 block">{children}</span>
      {error && <span className="mt-1 block text-[11px] text-rose-600">{error}</span>}
    </label>
  )
}
