'use client'

import { useMemo, useState } from 'react'
import { useBlockingActionState } from '@/lib/ui/action-blocker'
import Link from 'next/link'
import { saveDraftDeclarationAction, submitDeclarationAction } from '@/lib/tax/actions'
import { computeDeductions, type RawDeclaration } from '@/lib/tax/declarations'
import type { DeclarationFormErrors, DeclarationFormState } from '@/lib/tax/schemas'

const inr = (n: number): string => '₹ ' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(n))

type Defaults = Partial<RawDeclaration> & { status?: string }

type Props = {
  employeeId: string
  fyStart: string
  fyEnd: string
  fyLabel: string
  annualBasic: number          // approx, used for HRA exemption preview
  annualHra: number
  regime: 'NEW' | 'OLD'
  defaults?: Defaults
  locked?: boolean             // true when status='approved'
}

export function DeclarationForm({
  employeeId, fyStart, fyEnd, fyLabel, annualBasic, annualHra, regime, defaults = {}, locked,
}: Props) {
  const [draftState, draftAction, draftPending] = useBlockingActionState(saveDraftDeclarationAction, undefined)
  const [submitState, submitAction, submitPending] = useBlockingActionState(submitDeclarationAction, undefined)

  const [values, setValues] = useState<Defaults>(defaults)
  const set = <K extends keyof Defaults>(k: K, v: Defaults[K]) => setValues((p) => ({ ...p, [k]: v }))
  const num = (k: keyof RawDeclaration) => Number((values as Record<string, unknown>)[k] ?? 0)
  const bool = (k: keyof RawDeclaration) => Boolean((values as Record<string, unknown>)[k] ?? false)

  const preview = useMemo(
    () =>
      computeDeductions(
        {
          sec_80c_ppf: num('sec_80c_ppf'),
          sec_80c_lic: num('sec_80c_lic'),
          sec_80c_elss: num('sec_80c_elss'),
          sec_80c_nsc: num('sec_80c_nsc'),
          sec_80c_tuition_fees: num('sec_80c_tuition_fees'),
          sec_80c_home_loan_principal: num('sec_80c_home_loan_principal'),
          sec_80c_epf: num('sec_80c_epf'),
          sec_80c_other: num('sec_80c_other'),
          sec_80d_self_family: num('sec_80d_self_family'),
          sec_80d_parents: num('sec_80d_parents'),
          sec_80d_parents_senior: bool('sec_80d_parents_senior'),
          sec_80d_self_senior: bool('sec_80d_self_senior'),
          sec_80ccd_1b_nps: num('sec_80ccd_1b_nps'),
          sec_80e_education_loan: num('sec_80e_education_loan'),
          sec_80g_donations: num('sec_80g_donations'),
          sec_80tta_savings_interest: num('sec_80tta_savings_interest'),
          home_loan_interest: num('home_loan_interest'),
          rent_paid_annual: num('rent_paid_annual'),
          metro_city: bool('metro_city'),
          lta_claimed: num('lta_claimed'),
        },
        { hraReceivedAnnual: annualHra, basicAnnual: annualBasic },
      ),
    [values, annualBasic, annualHra], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const state: DeclarationFormState = draftState ?? submitState
  const err = (k: keyof DeclarationFormErrors) => state?.errors?.[k]?.[0]

  const commonHidden = (
    <>
      <input type="hidden" name="employee_id" value={employeeId} />
      <input type="hidden" name="fy_start" value={fyStart} />
      <input type="hidden" name="fy_end" value={fyEnd} />
      <input type="hidden" name="regime" value={regime} />
    </>
  )

  const readonly = Boolean(locked)
  const actionButtons = (
    <div className="flex items-center justify-end gap-2">
      <button
        type="submit"
        formAction={draftAction}
        disabled={readonly || draftPending}
        className="inline-flex h-9 items-center rounded-md border border-slate-300 px-4 text-sm font-medium hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
      >
        {draftPending ? 'Saving…' : 'Save draft'}
      </button>
      <button
        type="submit"
        formAction={submitAction}
        disabled={readonly || submitPending}
        className="inline-flex h-9 items-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
      >
        {submitPending ? 'Submitting…' : 'Submit to HR'}
      </button>
    </div>
  )

  if (regime === 'NEW') {
    return (
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-5 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
        The employee is on the <strong>New Regime</strong>. Exemptions under 10(13A), 80C, 80D, etc. don&apos;t apply — only the standard deduction does.
        Switch the regime on the employee&apos;s profile to OLD if they want to claim investments.
      </div>
    )
  }

  return (
    <form className="grid gap-5 lg:grid-cols-5">
      {commonHidden}

      <div className="space-y-4 lg:col-span-3">
        {state?.errors?._form && (
          <div role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {state.errors._form[0]}
          </div>
        )}
        {state?.ok && (
          <div role="status" className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
            Saved. {locked ? 'Declaration is locked.' : 'HR will review and approve.'}
          </div>
        )}
        {readonly && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            This declaration is approved and locked. Ask HR to reopen it to make changes.
          </div>
        )}

        <Section title="Section 80C (capped at ₹1,50,000)">
          <Grid>
            <Num label="PPF"            k="sec_80c_ppf" values={values} set={set} err={err} readOnly={readonly} />
            <Num label="LIC premium"    k="sec_80c_lic" values={values} set={set} err={err} readOnly={readonly} />
            <Num label="ELSS (mutual funds)" k="sec_80c_elss" values={values} set={set} err={err} readOnly={readonly} />
            <Num label="NSC / other"    k="sec_80c_nsc" values={values} set={set} err={err} readOnly={readonly} />
            <Num label="Tuition fees"   k="sec_80c_tuition_fees" values={values} set={set} err={err} readOnly={readonly} />
            <Num label="Home loan principal" k="sec_80c_home_loan_principal" values={values} set={set} err={err} readOnly={readonly} />
            <Num label="EPF contribution (self)" k="sec_80c_epf" values={values} set={set} err={err} readOnly={readonly} />
            <Num label="Other 80C"      k="sec_80c_other" values={values} set={set} err={err} readOnly={readonly} />
          </Grid>
        </Section>

        <Section title="Section 80D — Health insurance">
          <Grid>
            <Num label="Self + family premium" k="sec_80d_self_family" values={values} set={set} err={err} readOnly={readonly} />
            <Num label="Parents premium"       k="sec_80d_parents"     values={values} set={set} err={err} readOnly={readonly} />
          </Grid>
          <div className="mt-2 flex gap-4 text-sm">
            <BoolLabel label="Self is a senior citizen" k="sec_80d_self_senior" values={values} set={set} readOnly={readonly} />
            <BoolLabel label="Parents are senior citizens" k="sec_80d_parents_senior" values={values} set={set} readOnly={readonly} />
          </div>
        </Section>

        <Section title="Other deductions">
          <Grid>
            <Num label="80CCD(1B) — NPS (cap ₹50k)" k="sec_80ccd_1b_nps" values={values} set={set} err={err} readOnly={readonly} />
            <Num label="80E — Education loan interest" k="sec_80e_education_loan" values={values} set={set} err={err} readOnly={readonly} />
            <Num label="80G — Donations" k="sec_80g_donations" values={values} set={set} err={err} readOnly={readonly} />
            <Num label="80TTA — Savings interest (cap ₹10k)" k="sec_80tta_savings_interest" values={values} set={set} err={err} readOnly={readonly} />
            <Num label="Section 24(b) — Home loan interest (cap ₹2L)" k="home_loan_interest" values={values} set={set} err={err} readOnly={readonly} />
          </Grid>
        </Section>

        <Section title="HRA & LTA">
          <Grid>
            <Num label="Annual rent paid" k="rent_paid_annual" values={values} set={set} err={err} readOnly={readonly} />
            <Num label="LTA claimed"      k="lta_claimed" values={values} set={set} err={err} readOnly={readonly} />
          </Grid>
          <div className="mt-2 text-sm">
            <BoolLabel label="Live in a metro city (50% HRA exemption)" k="metro_city" values={values} set={set} readOnly={readonly} />
          </div>
          <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            HRA exemption = least of (actual HRA / rent − 10% Basic / 50% (metro) or 40% (non-metro) of Basic).
          </p>
        </Section>

        {actionButtons}
      </div>

      <aside className="lg:col-span-2">
        <div className="sticky top-4 rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Preview — FY {fyLabel}</h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Annual basic &asymp; {inr(annualBasic)} &middot; Annual HRA &asymp; {inr(annualHra)}
          </p>
          <table className="mt-3 w-full text-sm">
            <tbody>
              {preview.breakup.map((b) => (
                <tr key={b.label}>
                  <td className="py-1 text-slate-700 dark:text-slate-300">{b.label}</td>
                  <td className="py-1 text-right tabular-nums">{inr(b.amount)}</td>
                </tr>
              ))}
              <tr className="border-t border-slate-200 dark:border-slate-800">
                <td className="py-2 font-semibold">Total deductions</td>
                <td className="py-2 text-right font-semibold tabular-nums">{inr(preview.total)}</td>
              </tr>
            </tbody>
          </table>
          <Link href={`/employees/${employeeId}`} className="mt-3 inline-block text-xs underline">
            Back to employee
          </Link>
        </div>
      </aside>
    </form>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</h3>
      {children}
    </div>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
}

function Num({
  label, k, values, set, err, readOnly,
}: {
  label: string
  k: keyof RawDeclaration
  values: Defaults
  set: <K extends keyof Defaults>(k: K, v: Defaults[K]) => void
  err: (k: keyof DeclarationFormErrors) => string | undefined
  readOnly?: boolean
}) {
  const v = (values as Record<string, unknown>)[k]
  const value = v === null || v === undefined ? '' : String(v)
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">{label}</label>
      <input
        type="number"
        name={k}
        readOnly={readOnly}
        value={value}
        onChange={(e) => {
          const num = e.target.value === '' ? 0 : Number(e.target.value)
          set(k as keyof Defaults, num as Defaults[keyof Defaults])
        }}
        className="block h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 disabled:bg-slate-50 read-only:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:focus:border-slate-100 dark:focus:ring-slate-100 dark:read-only:bg-slate-900"
      />
      {err(k as keyof DeclarationFormErrors) && <p className="text-xs text-red-600">{err(k as keyof DeclarationFormErrors)}</p>}
    </div>
  )
}

function BoolLabel({
  label, k, values, set, readOnly,
}: {
  label: string
  k: keyof RawDeclaration
  values: Defaults
  set: <K extends keyof Defaults>(k: K, v: Defaults[K]) => void
  readOnly?: boolean
}) {
  return (
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        name={k}
        disabled={readOnly}
        checked={Boolean((values as Record<string, unknown>)[k])}
        onChange={(e) => set(k as keyof Defaults, e.target.checked as Defaults[keyof Defaults])}
      />
      <span>{label}</span>
    </label>
  )
}
