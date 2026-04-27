import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { NewFyForm } from './_components/new-fy-form'

export const metadata = { title: 'Holiday calendar' }

type HolidayMeta = {
  financial_year: string
  type: 'public' | 'restricted' | 'optional'
  project_id: number | null
  location_id: number | null
}

type FySummary = {
  fy: string
  total: number
  public: number
  restricted: number
  optional: number
  projectScoped: number
  locationScoped: number
}

export default async function HolidaysIndexPage() {
  const supabase = await createClient()
  const { data } = await supabase.from('holidays').select('financial_year, type, project_id, location_id')
  const rows = (data ?? []) as unknown as HolidayMeta[]

  const byFy = new Map<string, FySummary>()
  for (const r of rows) {
    const s = byFy.get(r.financial_year) ?? {
      fy: r.financial_year, total: 0, public: 0, restricted: 0, optional: 0, projectScoped: 0, locationScoped: 0,
    }
    s.total++
    s[r.type]++
    if (r.project_id) s.projectScoped++
    if (r.location_id) s.locationScoped++
    byFy.set(r.financial_year, s)
  }

  const fyList = Array.from(byFy.values()).sort((a, b) => b.fy.localeCompare(a.fy))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Holiday calendar"
        back={{ href: '/settings', label: 'Settings' }}
        subtitle="Open a year to edit its holidays, mark weekends, or upload a CSV."
      />

      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-50">Start a new year</h3>
        <NewFyForm existing={fyList.map((f) => f.fy)} />
      </Card>

      {fyList.length === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-500">
          No holiday years configured yet. Create one above.
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {fyList.map((s) => (
            <Link
              key={s.fy}
              href={`/settings/holidays/${encodeURIComponent(s.fy)}`}
              className="group flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:border-brand-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-700"
            >
              <div className="flex items-center justify-between">
                <div className="text-base font-semibold text-slate-900 dark:text-slate-50">{s.fy}</div>
                <span className="text-slate-300 transition-colors group-hover:text-brand-600">→</span>
              </div>
              <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                {s.total}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {s.public} public · {s.restricted} restricted · {s.optional} optional
              </div>
              <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                {s.projectScoped > 0 && <span>{s.projectScoped} project-scoped · </span>}
                {s.locationScoped > 0 && <span>{s.locationScoped} location-scoped</span>}
                {s.projectScoped === 0 && s.locationScoped === 0 && <span>All global</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
