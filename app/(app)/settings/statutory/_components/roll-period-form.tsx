'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useBlockingTransition } from '@/lib/ui/action-blocker'
import { rollStatutoryPeriodAction } from '@/lib/statutory/actions'

type Seed = {
  basic_percent_of_gross: number
  hra_percent_of_basic: number
  conv_percent_of_basic: number
  conv_monthly_cap: number
  epf_employee_percent: number
  epf_employer_percent: number
  epf_wage_ceiling: number
  epf_max_monthly_contribution: number
  esi_employee_percent: number
  esi_employer_percent: number
  esi_wage_ceiling: number
  gratuity_percent: number
}

export function RollPeriodForm({ seed, minDate }: { seed: Seed; minDate: string }) {
  const router = useRouter()
  const [pending, startTransition] = useBlockingTransition()
  const [err, setErr] = useState<string | null>(null)

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErr(null)
    if (!confirm('Roll a new statutory period? The current period will be closed on the day before, and the new values take effect from the date above. This is permanent.')) return
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await rollStatutoryPeriodAction(fd)
      if (res.error) setErr(res.error)
      else router.refresh()
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {err && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {err}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field name="effective_from" label="Effective from" suffix="" type="date" min={minDate} required />
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
        <div className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-50">
          Values for the new period (pre-filled from current, edit what changed)
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <FieldN name="basic_percent_of_gross" label="BASIC % of Gross" step="0.01" defaultValue={seed.basic_percent_of_gross} />
          <FieldN name="hra_percent_of_basic" label="HRA % of BASIC" step="0.01" defaultValue={seed.hra_percent_of_basic} />
          <FieldN name="conv_percent_of_basic" label="Conveyance % of BASIC" step="0.01" defaultValue={seed.conv_percent_of_basic} />
          <FieldN name="conv_monthly_cap" label="Conveyance monthly cap ₹" step="1" defaultValue={seed.conv_monthly_cap} />
          <FieldN name="epf_employee_percent" label="EPF employee %" step="0.01" defaultValue={seed.epf_employee_percent} />
          <FieldN name="epf_employer_percent" label="EPF employer %" step="0.01" defaultValue={seed.epf_employer_percent} />
          <FieldN name="epf_wage_ceiling" label="EPF wage ceiling ₹" step="1" defaultValue={seed.epf_wage_ceiling} />
          <FieldN name="epf_max_monthly_contribution" label="EPF max monthly ₹" step="1" defaultValue={seed.epf_max_monthly_contribution} />
          <FieldN name="esi_employee_percent" label="ESI employee %" step="0.01" defaultValue={seed.esi_employee_percent} />
          <FieldN name="esi_employer_percent" label="ESI employer %" step="0.01" defaultValue={seed.esi_employer_percent} />
          <FieldN name="esi_wage_ceiling" label="ESI wage ceiling ₹" step="1" defaultValue={seed.esi_wage_ceiling} />
          <FieldN name="gratuity_percent" label="Gratuity %" step="0.0001" defaultValue={seed.gratuity_percent} />
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="h-9 rounded-md bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? 'Working…' : 'Roll new period'}
      </button>
    </form>
  )
}

function Field({
  name, label, suffix, type = 'number', step, min, required,
}: {
  name: string; label: string; suffix: string; type?: string; step?: string; min?: string; required?: boolean
}) {
  return (
    <label className="flex flex-col">
      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</span>
      <div className="mt-1 flex items-center gap-1">
        <input
          name={name}
          type={type}
          step={step}
          min={min}
          required={required}
          className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
        />
        {suffix && <span className="text-sm text-slate-500">{suffix}</span>}
      </div>
    </label>
  )
}

function FieldN({
  name, label, step, defaultValue,
}: { name: string; label: string; step: string; defaultValue: number }) {
  return (
    <label className="flex flex-col">
      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</span>
      <input
        name={name}
        type="number"
        step={step}
        defaultValue={defaultValue}
        required
        className="mt-1 h-9 rounded-md border border-slate-300 bg-white px-3 text-right text-sm tabular-nums dark:border-slate-700 dark:bg-slate-950"
      />
    </label>
  )
}
