'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useBlockingTransition } from '@/lib/ui/action-blocker'
import { useSnackbar } from '@/components/ui/snackbar'
import { savePriorEarningsAction } from '@/lib/tax/prior-earnings'
import { Card, CardBody } from '@/components/ui/card'

type Props = {
  employeeId?: string                     // pass when admin/HR is editing for someone else
  fyStart: string
  fyLabel: string
  defaults?: {
    gross_salary?: number
    basic?: number | null
    hra?: number | null
    conveyance?: number | null
    perquisites?: number | null
    pf_deducted?: number
    professional_tax_deducted?: number
    tds_deducted?: number
    prev_employer_name?: string | null
    prev_employer_pan?: string | null
    prev_employer_tan?: string | null
    prev_regime?: 'OLD' | 'NEW' | null
    notes?: string | null
    verified_at?: string | null
  }
  locked?: boolean                        // verified-by-HR locks employee edits
  asAdmin?: boolean                       // unlocks the form even when verified
}

export function PriorEarningsForm({
  employeeId, fyStart, fyLabel, defaults, locked, asAdmin,
}: Props) {
  const router = useRouter()
  const snack = useSnackbar()
  const [pending, startTransition] = useBlockingTransition()
  const [open, setOpen] = useState(Boolean(defaults?.gross_salary))

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('fy_start', fyStart)
    if (employeeId) fd.set('employee_id', employeeId)
    startTransition(async () => {
      const res = await savePriorEarningsAction(fd)
      if (res.error) snack.show({ kind: 'error', message: res.error })
      else {
        snack.show({ kind: 'success', message: '12B saved.' })
        router.refresh()
      }
    })
  }

  const readOnly = !asAdmin && Boolean(locked)

  if (!open && !defaults) {
    return (
      <Card>
        <CardBody>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Previous employer (Form 12B)</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                If you joined Aalam mid-FY {fyLabel}, declare salary + TDS from your previous employer this FY so your TDS here reflects the combined annual picture (Section 192(2)).
                Skip this if you didn&apos;t work elsewhere in FY {fyLabel}.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              Add 12B details
            </button>
          </div>
        </CardBody>
      </Card>
    )
  }

  return (
    <Card>
      <CardBody>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
              Previous employer (Form 12B) — FY {fyLabel}
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Salary &amp; TDS from your previous employer, this FY only. Aadhaar / PAN aren&apos;t needed — just rupee figures + employer name. The TDS engine
              uses these to compute your combined annual tax under your current regime.
            </p>
          </div>
          {defaults?.verified_at && (
            <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
              ✓ HR verified
            </span>
          )}
        </div>

        {readOnly && (
          <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            HR has verified this 12B. Ask HR to unlock if anything needs changing.
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <Section title="Salary received from previous employer (this FY)">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Gross salary (₹)" name="gross_salary" required defaults={defaults?.gross_salary} readOnly={readOnly} hint="Sum of all components you actually received." />
              <Field label="Basic" name="basic" defaults={defaults?.basic ?? undefined} readOnly={readOnly} optional />
              <Field label="HRA" name="hra" defaults={defaults?.hra ?? undefined} readOnly={readOnly} optional />
              <Field label="Conveyance" name="conveyance" defaults={defaults?.conveyance ?? undefined} readOnly={readOnly} optional />
              <Field label="Perquisites" name="perquisites" defaults={defaults?.perquisites ?? undefined} readOnly={readOnly} optional />
            </div>
          </Section>

          <Section title="Tax & deductions by previous employer">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="TDS deducted (₹)" name="tds_deducted" required defaults={defaults?.tds_deducted ?? 0} readOnly={readOnly} hint="From your last payslip / Form 16 — total TDS this FY." />
              <Field label="PF deducted" name="pf_deducted" defaults={defaults?.pf_deducted ?? 0} readOnly={readOnly} optional />
              <Field label="Professional tax" name="professional_tax_deducted" defaults={defaults?.professional_tax_deducted ?? 0} readOnly={readOnly} optional />
            </div>
          </Section>

          <Section title="Employer details (for Form 16 reference)">
            <div className="grid gap-3 sm:grid-cols-3">
              <TextField label="Employer name" name="prev_employer_name" defaults={defaults?.prev_employer_name ?? ''} readOnly={readOnly} />
              <TextField label="Employer PAN" name="prev_employer_pan" defaults={defaults?.prev_employer_pan ?? ''} readOnly={readOnly} placeholder="ABCDE1234F" />
              <TextField label="Employer TAN" name="prev_employer_tan" defaults={defaults?.prev_employer_tan ?? ''} readOnly={readOnly} placeholder="MUMA12345B" />
            </div>
            <div className="mt-3">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Previous regime <span className="text-slate-400">(optional, informational)</span>
              </label>
              <select
                name="prev_regime"
                defaultValue={defaults?.prev_regime ?? ''}
                disabled={readOnly}
                className={inputCls}
              >
                <option value="">—</option>
                <option value="OLD">Old regime</option>
                <option value="NEW">New regime</option>
              </select>
              <p className="mt-1 text-[11px] text-slate-500">
                Doesn&apos;t change your TDS here — your current regime + declarations always apply. We just store this for record.
              </p>
            </div>
          </Section>

          <Section title="Notes">
            <textarea
              name="notes"
              defaultValue={defaults?.notes ?? ''}
              disabled={readOnly}
              rows={2}
              placeholder="e.g. Worked at XYZ Corp from Apr to Sep 2026 before joining Aalam."
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </Section>

          {!readOnly && (
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
              <button
                type="submit"
                disabled={pending}
                className="h-9 rounded-md bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 disabled:opacity-60"
              >
                {pending ? 'Saving…' : 'Save 12B'}
              </button>
            </div>
          )}
        </form>
      </CardBody>
    </Card>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      {children}
    </div>
  )
}

function Field({
  label, name, required, defaults, hint, readOnly, optional,
}: {
  label: string; name: string; required?: boolean; defaults?: number | null;
  hint?: string; readOnly?: boolean; optional?: boolean
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
        {label}
        {required && <span className="ml-0.5 text-red-600">*</span>}
        {optional && <span className="ml-1 text-[10px] text-slate-400">(optional)</span>}
      </label>
      <input
        type="number"
        name={name}
        min={0}
        step="0.01"
        required={required}
        defaultValue={defaults ?? ''}
        disabled={readOnly}
        className={inputCls}
      />
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </div>
  )
}

function TextField({
  label, name, defaults, placeholder, readOnly,
}: { label: string; name: string; defaults?: string; placeholder?: string; readOnly?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">{label}</label>
      <input
        type="text"
        name={name}
        defaultValue={defaults ?? ''}
        placeholder={placeholder}
        disabled={readOnly}
        className={inputCls}
      />
    </div>
  )
}

const inputCls =
  'mt-1 block h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:bg-slate-50 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:disabled:bg-slate-900'
