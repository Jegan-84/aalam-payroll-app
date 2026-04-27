import { getCurrentEmployee } from '@/lib/auth/dal'
import { getHolidaysForEmployeeInRange } from '@/lib/leave/queries'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const metadata = { title: 'My holidays' }

type HolidayRow = {
  holiday_date: string
  name: string
  type: 'public' | 'restricted' | 'optional'
}

export default async function MyHolidaysPage() {
  const { employeeId } = await getCurrentEmployee()
  const year = new Date().getUTCFullYear()
  const from = `${year}-01-01`
  const to = `${year}-12-31`

  const supabase = await createClient()
  const [dateSet, emp] = await Promise.all([
    getHolidaysForEmployeeInRange(employeeId, from, to),
    supabase
      .from('employees')
      .select('primary_project_id, location_id, projects:primary_project_id(code, name)')
      .eq('id', employeeId)
      .maybeSingle(),
  ])

  const { data: rows } = await supabase
    .from('holidays')
    .select('holiday_date, name, type')
    .gte('holiday_date', from)
    .lte('holiday_date', to)
    .in('holiday_date', Array.from(dateSet))
    .order('holiday_date')

  const holidays = (rows ?? []) as unknown as HolidayRow[]
  const unique = dedupeByDate(holidays)

  const project = (emp.data as unknown as { projects?: { code: string; name: string } | null } | null)?.projects ?? null

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Holidays — ${year}`}
        subtitle={project
          ? `Your calendar is based on project ${project.name} (${project.code}).`
          : 'You are not assigned to a project — this is the common holiday list.'}
      />

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Day</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {unique.length === 0 && (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-sm text-slate-500">No holidays in this year.</td></tr>
              )}
              {unique.map((h) => (
                <tr key={h.holiday_date} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-950">
                  <td className="px-4 py-3 tabular-nums">{h.holiday_date}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {new Date(h.holiday_date + 'T00:00:00Z').toLocaleDateString('en-IN', { weekday: 'long', timeZone: 'UTC' })}
                  </td>
                  <td className="px-4 py-3">{h.name}</td>
                  <td className="px-4 py-3">
                    <Badge tone={h.type === 'public' ? 'brand' : h.type === 'restricted' ? 'warn' : 'neutral'}>
                      {h.type}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function dedupeByDate(rows: HolidayRow[]): HolidayRow[] {
  const seen = new Map<string, HolidayRow>()
  for (const r of rows) if (!seen.has(r.holiday_date)) seen.set(r.holiday_date, r)
  return Array.from(seen.values())
}
