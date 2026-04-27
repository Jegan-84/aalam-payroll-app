'use client'

import { useRouter } from 'next/navigation'
import { useBlockingTransition } from '@/lib/ui/action-blocker'
import { useSnackbar } from '@/components/ui/snackbar'
import { markWeekendsAction } from '@/lib/masters/holidays'

type Option = { id: number; code: string; name: string }

export function WeekendSweeper({
  fy, projects, locations, defaultFrom, defaultTo,
}: {
  fy: string
  projects: Option[]
  locations: Option[]
  defaultFrom: string
  defaultTo: string
}) {
  const router = useRouter()
  const snack = useSnackbar()
  const [pending, startTransition] = useBlockingTransition()

  const run = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await markWeekendsAction(fd)
      if (res.error) snack.show({ kind: 'error', message: res.error })
      else {
        snack.show({
          kind: 'success',
          message: `Added ${res.added ?? 0}, skipped ${res.skipped ?? 0} already-existing.`,
        })
        router.refresh()
      }
    })
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Mark weekends as holiday</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Generates one holiday row per weekend day in the chosen range. Re-running is safe — existing entries in the same scope are skipped.
        </p>
      </div>

      <form onSubmit={run} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <input type="hidden" name="financial_year" value={fy} />
        <LabeledField label="From">
          <input name="from_date" type="date" defaultValue={defaultFrom} required className={inputCls} />
        </LabeledField>
        <LabeledField label="To">
          <input name="to_date" type="date" defaultValue={defaultTo} required className={inputCls} />
        </LabeledField>
        <LabeledField label="Label">
          <input name="name" type="text" defaultValue="Weekly off" required className={inputCls} />
        </LabeledField>
        <LabeledField label="Type">
          <select name="type" defaultValue="restricted" className={inputCls}>
            <option value="public">Public</option>
            <option value="restricted">Restricted</option>
            <option value="optional">Optional</option>
          </select>
        </LabeledField>
        <LabeledField label="Project">
          <select name="project_id" className={inputCls}>
            <option value="">All projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </LabeledField>
        <LabeledField label="Location">
          <select name="location_id" className={inputCls}>
            <option value="">All locations</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </LabeledField>

        <div className="flex flex-wrap items-center gap-4 sm:col-span-2 lg:col-span-4">
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" name="include_saturday" defaultChecked />
            Saturdays
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" name="include_sunday" defaultChecked />
            Sundays
          </label>
        </div>
        <div className="flex items-end sm:col-span-2 lg:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="h-9 w-full rounded-md bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 disabled:opacity-60"
          >
            {pending ? 'Marking…' : 'Mark weekends'}
          </button>
        </div>
      </form>
    </div>
  )
}

const inputCls = 'h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:focus:border-slate-100 dark:focus:ring-slate-100'

function LabeledField({
  label, children, className = '',
}: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1 ${className}`}>
      <label className="text-xs font-medium text-slate-600 dark:text-slate-400">{label}</label>
      {children}
    </div>
  )
}
