import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/page-header'
import { HolidaysManager } from '../_components/holidays-manager'
import { WeekendSweeper } from '../_components/weekend-sweeper'
import { HolidayBulkUpload } from '../_components/holiday-bulk-upload'
import { ExternalImportCard } from '../_components/external-import'
import { listProviders } from '@/lib/holidays/external'

export async function generateMetadata({ params }: { params: Promise<{ fy: string }> }) {
  const { fy } = await params
  return { title: `Holidays — ${decodeURIComponent(fy)}` }
}

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

export default async function HolidayYearPage({ params }: { params: Promise<{ fy: string }> }) {
  const { fy: rawFy } = await params
  const fy = decodeURIComponent(rawFy)

  const supabase = await createClient()
  const [holidaysRes, projectsRes, locationsRes] = await Promise.all([
    supabase.from('holidays').select('*').eq('financial_year', fy).order('holiday_date'),
    supabase.from('projects').select('id, code, name').eq('is_active', true).order('name'),
    supabase.from('locations').select('id, code, name').eq('is_active', true).order('name'),
  ])

  const holidays = (holidaysRes.data ?? []) as unknown as Holiday[]
  const projects = (projectsRes.data ?? []) as unknown as Option[]
  const locations = (locationsRes.data ?? []) as unknown as Option[]

  const [startYear, endSuffix] = fy.split('-')
  const startYr = Number(startYear)
  const defaultFrom = Number.isFinite(startYr) ? `${startYr}-04-01` : ''
  const defaultTo = endSuffix && /^\d+$/.test(endSuffix)
    ? `${2000 + Number(endSuffix)}-03-31`
    : (Number.isFinite(startYr) ? `${startYr + 1}-03-31` : '')
  const defaultYear = Number.isFinite(startYr) ? startYr : new Date().getUTCFullYear()
  const providers = listProviders()

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Holidays — ${fy}`}
        back={{ href: '/settings/holidays', label: 'All years' }}
        subtitle={`${holidays.length} holiday(s). Add manually, mark weekends in bulk, or upload a CSV.`}
        actions={
          <>
            <HolidayBulkUpload defaultFy={fy} />
            <Link
              href="/api/templates/holidays"
              className="inline-flex h-9 items-center rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              Download template
            </Link>
          </>
        }
      />

      <ExternalImportCard
        fy={fy}
        providers={providers}
        projects={projects}
        locations={locations}
        defaultYear={defaultYear}
      />

      <WeekendSweeper
        fy={fy}
        projects={projects}
        locations={locations}
        defaultFrom={defaultFrom}
        defaultTo={defaultTo}
      />

      <HolidaysManager
        fy={fy}
        holidays={holidays}
        projects={projects}
        locations={locations}
      />
    </div>
  )
}
