import Link from 'next/link'
import { getCurrentEmployee } from '@/lib/auth/dal'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { ImportClient } from './_components/import-client'

export const metadata = { title: 'Import timesheet entries' }

export default async function ImportPage() {
  await getCurrentEmployee()
  const supabase = await createClient()

  const [projectsRes, activitiesRes] = await Promise.all([
    supabase.from('projects').select('code, name').eq('is_active', true).order('code'),
    supabase.from('activity_types').select('code, name').eq('is_active', true).order('code'),
  ])
  const projects = (projectsRes.data ?? []) as Array<{ code: string; name: string }>
  const activities = (activitiesRes.data ?? []) as Array<{ code: string; name: string }>

  return (
    <div className="space-y-6">
      <PageHeader
        title="Import timesheet entries"
        back={{ href: '/me/timesheet', label: 'My timesheets' }}
        subtitle="Upload a CSV (or Excel saved as CSV) with one row per (date, project, activity). The preview groups your rows by week so you can see exactly which weeks will be touched before saving."
      />

      <Card className="space-y-3 p-5">
        <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">How it works</div>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-300">
          <li>Download the template, fill it offline, save as CSV.</li>
          <li>Upload the file. We&apos;ll parse and group rows by week (Mon → Sun).</li>
          <li>Review the preview. Rows with errors are flagged; weeks that are already submitted/approved are skipped automatically.</li>
          <li>Click <strong>Confirm &amp; save</strong> to create the entries. Multiple rows on the same (date, project, activity, task, mode) are <strong>summed</strong> into a single entry — and any existing entry on that same key is overwritten.</li>
        </ol>
        <div className="flex items-center gap-2 pt-1">
          <Link
            href="/api/templates/timesheet"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            ⬇ Download CSV template
          </Link>
          <span className="text-[11px] text-slate-500">
            Columns: <code>entry_date</code>, <code>project_code</code>, <code>activity_code</code>, <code>task</code>, <code>description</code>, <code>hours</code>, <code>start_time</code>, <code>end_time</code>, <code>work_mode</code>.
          </span>
        </div>
      </Card>

      <ImportClient projects={projects} activities={activities} />
    </div>
  )
}
