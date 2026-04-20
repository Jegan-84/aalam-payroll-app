import Link from 'next/link'
import { listConfiguredFys } from '@/lib/settings/tax-queries'
import { cloneFyAction } from '@/lib/settings/tax-actions'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card'

export const metadata = { title: 'Tax settings' }

export default async function TaxSettingsPage() {
  const fys = await listConfiguredFys()
  const defaultNewStart = nextFy(fys[0]?.fyStart ?? '2026-04-01')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tax settings"
        back={{ href: '/settings', label: 'Settings' }}
        subtitle="One row per financial year × regime. Clone an existing FY to start a new one, then edit the slabs."
      />

      <Card>
        <CardHeader><CardTitle>Configured FYs</CardTitle></CardHeader>
        <CardBody>
          {fys.length === 0 ? (
            <p className="text-sm text-slate-500">No tax rows yet. Apply the initial seed first (<code>supabase/seed.sql</code>).</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-sm dark:divide-slate-800">
                <thead className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="py-2 pr-4">FY</th>
                    <th className="py-2 pr-4">Range</th>
                    <th className="py-2 pr-4">{' '}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {fys.map((f) => (
                    <tr key={f.fyStart}>
                      <td className="py-2 pr-4 font-medium">FY {f.label}</td>
                      <td className="py-2 pr-4 tabular-nums">{f.fyStart} → {f.fyEnd}</td>
                      <td className="py-2 pr-4">
                        <Link href={`/settings/tax/${f.fyStart}`} className="text-xs font-medium text-brand-700 hover:underline">Edit slabs &amp; config →</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Start a new FY</CardTitle></CardHeader>
        <CardBody>
          <p className="mb-3 text-xs text-slate-500">Copies slabs, config, and surcharge rows from the source FY. You can then edit.</p>
          <form action={cloneFyAction} className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Clone from</label>
              <select name="source_fy_start" defaultValue={fys[0]?.fyStart ?? ''} required className="mt-1 block h-9 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950">
                {fys.map((f) => <option key={f.fyStart} value={f.fyStart}>FY {f.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wide text-slate-500">New FY start</label>
              <input name="new_fy_start" type="date" defaultValue={defaultNewStart.start} required className="mt-1 block h-9 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
            </div>
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wide text-slate-500">New FY end</label>
              <input name="new_fy_end" type="date" defaultValue={defaultNewStart.end} required className="mt-1 block h-9 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
            </div>
            <button className="h-9 rounded-md bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700">
              Clone
            </button>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}

function nextFy(lastFyStartIso: string): { start: string; end: string } {
  const d = new Date(lastFyStartIso + 'T00:00:00Z')
  d.setUTCFullYear(d.getUTCFullYear() + 1)
  const start = d.toISOString().slice(0, 10)
  const endDate = new Date(d.getTime())
  endDate.setUTCFullYear(endDate.getUTCFullYear() + 1)
  endDate.setUTCDate(endDate.getUTCDate() - 1)
  return { start, end: endDate.toISOString().slice(0, 10) }
}
