'use client'

import { useRouter } from 'next/navigation'
import { useBlockingTransition } from '@/lib/ui/action-blocker'
import { useSnackbar } from '@/components/ui/snackbar'
import { saveHolidayAction, deleteHolidayAction } from '@/lib/masters/holidays'

type Option = { id: number; code: string; name: string }
type Holiday = {
  id: number
  financial_year: string
  holiday_date: string
  name: string
  type: 'public' | 'restricted' | 'optional'
  location_id: number | null
  project_id: number | null
}

export function HolidaysManager({
  fy,
  holidays,
  locations,
  projects,
}: { fy: string; holidays: Holiday[]; locations: Option[]; projects: Option[] }) {
  const router = useRouter()
  const snack = useSnackbar()
  const [pending, startTransition] = useBlockingTransition()

  const save = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    startTransition(async () => {
      const res = await saveHolidayAction(undefined, fd)
      if (res?.error) snack.show({ kind: 'error', message: res.error })
      else {
        snack.show({ kind: 'success', message: 'Holiday saved.' })
        if (!fd.get('id')) form.reset()
        router.refresh()
      }
    })
  }

  const remove = (id: number) => {
    if (!confirm('Delete this holiday? This cannot be undone.')) return
    const fd = new FormData()
    fd.set('id', String(id))
    startTransition(async () => {
      const res = await deleteHolidayAction(fd)
      if (res.error) snack.show({ kind: 'error', message: res.error })
      else {
        snack.show({ kind: 'info', message: 'Holiday deleted.' })
        router.refresh()
      }
    })
  }

  const scopeLabel = (h: Holiday) => {
    const bits: string[] = []
    if (h.project_id) bits.push(`project: ${projects.find((p) => p.id === h.project_id)?.code ?? '#' + h.project_id}`)
    if (h.location_id) bits.push(`loc: ${locations.find((l) => l.id === h.location_id)?.code ?? '#' + h.location_id}`)
    if (bits.length === 0) return 'All'
    return bits.join(' · ')
  }

  return (
    <div className="space-y-4">

      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-50">Add holiday</h3>
        <form onSubmit={save} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <input type="hidden" name="financial_year" value={fy} />
          <LabeledField label="Date">
            <input name="holiday_date" type="date" required className={inputCls} />
          </LabeledField>
          <LabeledField label="Name" className="sm:col-span-2">
            <input name="name" type="text" placeholder="Republic Day" required className={inputCls} />
          </LabeledField>
          <LabeledField label="Type">
            <select name="type" defaultValue="public" className={inputCls}>
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
          <div className="flex items-end sm:col-span-2 lg:col-span-6">
            <button
              type="submit"
              disabled={pending}
              className="h-9 w-full rounded-md bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 disabled:opacity-60 sm:w-auto"
            >
              {pending ? 'Saving…' : 'Add holiday'}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-50">
          Holidays ({holidays.length})
        </div>
        {holidays.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">No holidays configured.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
              <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Day</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Applies to</th>
                  <th className="px-3 py-2">{' '}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
                {holidays.map((h) => (
                  <tr key={h.id}>
                    <td className="px-3 py-2 tabular-nums">{h.holiday_date}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">
                      {new Date(h.holiday_date + 'T00:00:00Z').toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'UTC' })}
                    </td>
                    <td className="px-3 py-2">{h.name}</td>
                    <td className="px-3 py-2 text-xs capitalize text-slate-600 dark:text-slate-300">{h.type}</td>
                    <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-300">{scopeLabel(h)}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => remove(h.id)}
                        disabled={pending}
                        className="text-xs font-medium text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
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
