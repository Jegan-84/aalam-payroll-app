'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useBlockingTransition } from '@/lib/ui/action-blocker'
import { saveStatutoryConfigAction } from '@/lib/statutory/actions'

type Config = {
  id: string
  epf_employee_percent: number
  epf_employer_percent: number
  epf_wage_ceiling: number
  epf_max_monthly_contribution: number
  esi_employee_percent: number
  esi_employer_percent: number
  esi_wage_ceiling: number
  gratuity_percent: number
  basic_percent_of_gross: number
  hra_percent_of_basic: number
  conv_percent_of_basic: number
  conv_monthly_cap: number
}

export function StatutoryForm({ defaults }: { defaults: Config }) {
  const router = useRouter()
  const [pending, startTransition] = useBlockingTransition()
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setMsg(null)
    const fd = new FormData(e.currentTarget)
    fd.set('id', defaults.id)
    startTransition(async () => {
      const res = await saveStatutoryConfigAction(fd)
      if (res.error) setMsg({ kind: 'err', text: res.error })
      else {
        setMsg({ kind: 'ok', text: 'Saved. Next payroll compute will pick up the new values.' })
        router.refresh()
      }
    })
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {msg && (
        <div role="alert" className={`rounded-md border px-3 py-2 text-sm ${msg.kind === 'err' ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'}`}>
          {msg.text}
        </div>
      )}

      <Section
        title="CTC structure"
        note="Drives BASIC / HRA / Conveyance on every new payslip. Approved cycles are snapshot-frozen and NOT retroactively changed."
      >
        <Field name="basic_percent_of_gross" label="BASIC % of Gross" suffix="%" step="0.01" min={1} max={100} defaultValue={defaults.basic_percent_of_gross} />
        <Field name="hra_percent_of_basic" label="HRA % of BASIC" suffix="%" step="0.01" min={0} max={100} defaultValue={defaults.hra_percent_of_basic} />
        <Field name="conv_percent_of_basic" label="Conveyance % of BASIC" suffix="%" step="0.01" min={0} max={100} defaultValue={defaults.conv_percent_of_basic} />
        <Field name="conv_monthly_cap" label="Conveyance monthly cap" suffix="₹" step="1" min={0} defaultValue={defaults.conv_monthly_cap} />
      </Section>

      <Section title="Provident Fund (PF / EPF)" note="Section 192 of EPF Act.">
        <Field name="epf_employee_percent" label="Employee contribution" suffix="%" step="0.01" min={0} max={100} defaultValue={defaults.epf_employee_percent} />
        <Field name="epf_employer_percent" label="Employer contribution" suffix="%" step="0.01" min={0} max={100} defaultValue={defaults.epf_employer_percent} />
        <Field name="epf_wage_ceiling" label="Wage ceiling (monthly Basic)" suffix="₹" step="1" min={0} defaultValue={defaults.epf_wage_ceiling} />
        <Field name="epf_max_monthly_contribution" label="Max monthly contribution" suffix="₹" step="1" min={0} defaultValue={defaults.epf_max_monthly_contribution} />
      </Section>

      <Section title="Employees State Insurance (ESI)" note="Applies only if monthly gross ≤ wage ceiling.">
        <Field name="esi_employee_percent" label="Employee contribution" suffix="%" step="0.01" min={0} max={100} defaultValue={defaults.esi_employee_percent} />
        <Field name="esi_employer_percent" label="Employer contribution" suffix="%" step="0.01" min={0} max={100} defaultValue={defaults.esi_employer_percent} />
        <Field name="esi_wage_ceiling" label="Wage ceiling (monthly gross)" suffix="₹" step="1" min={0} defaultValue={defaults.esi_wage_ceiling} />
      </Section>

      <Section title="Gratuity" note="Monthly accrual = this % × BASIC. Paid out at F&F after ≥5 years of service.">
        <Field name="gratuity_percent" label="Gratuity % of BASIC" suffix="%" step="0.0001" min={0} max={100} defaultValue={defaults.gratuity_percent} />
      </Section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="h-9 rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
        >
          {pending ? 'Saving…' : 'Save changes'}
        </button>
        <Link href="/settings" className="text-sm text-slate-500 hover:underline">Cancel</Link>
        <p className="ml-auto text-xs text-slate-500">
          Changes apply to the next payroll compute. Approved / locked cycles are frozen and remain unchanged.
        </p>
      </div>
    </form>
  )
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-1 text-sm font-semibold text-slate-900 dark:text-slate-50">{title}</div>
      {note && <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">{note}</p>}
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  )
}

function Field({
  name, label, suffix, step, min, max, defaultValue,
}: {
  name: string
  label: string
  suffix: string
  step: string
  min: number
  max?: number
  defaultValue: number
}) {
  return (
    <label className="flex flex-col">
      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</span>
      <div className="mt-1 flex items-center gap-1">
        <input
          name={name}
          type="number"
          step={step}
          min={min}
          max={max}
          defaultValue={defaultValue}
          required
          className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-right text-sm tabular-nums dark:border-slate-700 dark:bg-slate-950"
        />
        <span className="text-sm text-slate-500">{suffix}</span>
      </div>
    </label>
  )
}
