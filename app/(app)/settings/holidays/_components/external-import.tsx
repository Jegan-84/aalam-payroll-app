'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useBlockingTransition } from '@/lib/ui/action-blocker'
import { useSnackbar } from '@/components/ui/snackbar'
import {
  fetchExternalHolidaysAction,
  importExternalHolidaysAction,
} from '@/lib/masters/holidays'
import type { ImportedHoliday, ProviderInfo } from '@/lib/holidays/external'

type Option = { id: number; code: string; name: string }

export function ExternalImportCard({
  fy, providers, projects, locations, defaultYear,
}: {
  fy: string
  providers: ProviderInfo[]
  projects: Option[]
  locations: Option[]
  defaultYear: number
}) {
  const router = useRouter()
  const snack = useSnackbar()
  const [pending, startTransition] = useBlockingTransition()

  const firstAvailable = providers.find((p) => p.available)?.id ?? 'nager'
  const [provider, setProvider] = useState(firstAvailable)
  const [country, setCountry] = useState('IN')
  const [year, setYear] = useState(defaultYear)
  const [region, setRegion] = useState('')
  const [scopeProject, setScopeProject] = useState('')
  const [scopeLocation, setScopeLocation] = useState('')

  const [rows, setRows] = useState<ImportedHoliday[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const providerInfo = providers.find((p) => p.id === provider)

  const fetchPreview = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setRows(null)
    setSelected(new Set())
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await fetchExternalHolidaysAction(fd)
      if (res.error) {
        snack.show({ kind: 'error', message: res.error })
      } else {
        const list = res.holidays ?? []
        setRows(list)
        setSelected(new Set(list.map((r) => r.key)))
        if (list.length === 0) snack.show({ kind: 'info', message: 'No holidays returned for that selection.' })
      }
    })
  }

  const toggle = (k: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }
  const setAll = (v: boolean) => {
    if (!rows) return
    setSelected(v ? new Set(rows.map((r) => r.key)) : new Set())
  }

  const importSelected = () => {
    if (!rows || selected.size === 0) return
    const payload = rows.filter((r) => selected.has(r.key)).map((r) => ({
      date: r.date, name: r.name, type: r.type,
    }))
    const fd = new FormData()
    fd.set('financial_year', fy)
    if (scopeProject) fd.set('project_id', scopeProject)
    if (scopeLocation) fd.set('location_id', scopeLocation)
    fd.set('rows', JSON.stringify(payload))
    startTransition(async () => {
      const res = await importExternalHolidaysAction(fd)
      if (res.error) {
        snack.show({ kind: 'error', message: res.error })
        return
      }
      snack.show({
        kind: 'success',
        message: `Imported ${res.created ?? 0} · skipped ${res.skipped ?? 0} (duplicates).`,
      })
      setRows(null)
      setSelected(new Set())
      router.refresh()
    })
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Import from external API</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Fetch the year&apos;s public holidays from a provider, preview the list, tick the ones you want, and bulk-insert them.
        </p>
      </div>

      <form onSubmit={fetchPreview} className="space-y-3">
        {/* Provider radio */}
        <div className="grid gap-2 sm:grid-cols-2">
          {providers.map((p) => (
            <label
              key={p.id}
              className={`cursor-pointer rounded-md border p-3 text-sm transition-colors ${
                provider === p.id
                  ? 'border-brand-500 bg-brand-50/50 dark:border-brand-700 dark:bg-brand-950/30'
                  : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600'
              } ${p.available ? '' : 'opacity-60'}`}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="provider"
                    value={p.id}
                    checked={provider === p.id}
                    onChange={() => setProvider(p.id)}
                    disabled={!p.available}
                  />
                  <span className="font-medium">{p.label}</span>
                </span>
                {!p.available && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-500 dark:bg-slate-800">
                    disabled
                  </span>
                )}
              </div>
              <p className="mt-1 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                {p.helper}
                {!p.available && p.unavailableReason ? ` · ${p.unavailableReason}` : ''}
              </p>
            </label>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <LabeledField label="Country (ISO 2)">
            <input
              name="country"
              value={country}
              onChange={(e) => setCountry(e.target.value.toUpperCase())}
              maxLength={2}
              required
              className={inputCls}
            />
          </LabeledField>
          <LabeledField label="Year">
            <input
              name="year"
              type="number"
              min={2000}
              max={2100}
              value={year}
              onChange={(e) => setYear(Number(e.target.value) || defaultYear)}
              required
              className={inputCls}
            />
          </LabeledField>
          <LabeledField label={`State / region${providerInfo?.supportsRegion ? '' : ' (n/a)'}`}>
            <input
              name="region"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder={providerInfo?.supportsRegion ? 'e.g. IN-TN' : '—'}
              disabled={!providerInfo?.supportsRegion}
              className={inputCls + ' disabled:cursor-not-allowed disabled:opacity-50'}
            />
          </LabeledField>
          <LabeledField label="Scope: project (optional)">
            <select value={scopeProject} onChange={(e) => setScopeProject(e.target.value)} className={inputCls}>
              <option value="">All projects</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </LabeledField>
          <LabeledField label="Scope: location (optional)">
            <select value={scopeLocation} onChange={(e) => setScopeLocation(e.target.value)} className={inputCls}>
              <option value="">All locations</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </LabeledField>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={pending}
            className="h-9 rounded-md bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 disabled:opacity-60"
          >
            {pending ? 'Fetching…' : 'Fetch preview'}
          </button>
        </div>
      </form>

      {rows && rows.length > 0 && (
        <div className="mt-4 rounded-md border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 dark:border-slate-800">
            <div className="text-xs text-slate-500">
              {selected.size} of {rows.length} selected
            </div>
            <div className="flex gap-2 text-xs">
              <button type="button" onClick={() => setAll(true)} className="font-medium text-brand-700 hover:underline dark:text-brand-400">
                Select all
              </button>
              <span className="text-slate-300">·</span>
              <button type="button" onClick={() => setAll(false)} className="font-medium text-slate-600 hover:underline dark:text-slate-300">
                Clear
              </button>
            </div>
          </div>
          <ul className="max-h-[360px] divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
            {rows.map((r) => {
              const checked = selected.has(r.key)
              const day = new Date(r.date + 'T00:00:00Z').toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'UTC' })
              return (
                <li key={r.key} className="flex items-center gap-3 px-3 py-2">
                  <input type="checkbox" checked={checked} onChange={() => toggle(r.key)} className="shrink-0" />
                  <div className="w-28 shrink-0 tabular-nums text-xs text-slate-600 dark:text-slate-300">
                    {r.date} <span className="text-slate-400">· {day}</span>
                  </div>
                  <div className="min-w-0 flex-1 truncate text-sm text-slate-900 dark:text-slate-100">
                    {r.name}
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                    r.type === 'public' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                    : r.type === 'restricted' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                  }`}>
                    {r.type}
                  </span>
                  {r.regions && r.regions.length > 0 && (
                    <span className="shrink-0 text-[11px] text-slate-500">{r.regions.slice(0, 3).join(', ')}{r.regions.length > 3 ? '…' : ''}</span>
                  )}
                </li>
              )
            })}
          </ul>
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-3 py-2 dark:border-slate-800">
            <p className="text-[11px] text-slate-500">
              Imported into FY <span className="font-medium">{fy}</span>
              {scopeProject && projects.find((p) => String(p.id) === scopeProject) && ` · project ${projects.find((p) => String(p.id) === scopeProject)!.code}`}
              {scopeLocation && locations.find((l) => String(l.id) === scopeLocation) && ` · location ${locations.find((l) => String(l.id) === scopeLocation)!.code}`}
            </p>
            <button
              type="button"
              onClick={importSelected}
              disabled={pending || selected.size === 0}
              className="h-9 rounded-md bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 disabled:opacity-60"
            >
              {pending ? 'Importing…' : `Import ${selected.size}`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const inputCls = 'h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:focus:border-slate-100 dark:focus:ring-slate-100'

function LabeledField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-slate-600 dark:text-slate-400">{label}</label>
      {children}
    </div>
  )
}
