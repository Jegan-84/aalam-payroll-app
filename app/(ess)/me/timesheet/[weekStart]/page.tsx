import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentEmployee } from '@/lib/auth/dal'
import { listProjects, listActivityTypes } from '@/lib/masters/queries'
import { getMyWeek, getActiveTimer, mondayAnchorOf } from '@/lib/timesheet/queries'
import { prefillLeaveAndHolidays } from '@/lib/timesheet/prefill'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TimerBar } from '../_components/timer-bar'
import { CopyLastWeekButton } from '../_components/copy-last-week-button'
import { TimesheetImport } from '../_components/timesheet-import'
import { WeekClient, type ClientRow } from '../_components/week-client'

export const metadata = { title: 'My timesheet — week' }

type PP = Promise<{ weekStart: string }>

const STATUS_TONE: Record<string, 'brand' | 'warn' | 'danger' | 'neutral'> = {
  draft: 'neutral',
  submitted: 'warn',
  approved: 'brand',
  rejected: 'danger',
}

export default async function MyTimesheetWeekPage({ params }: { params: PP }) {
  const { weekStart: rawWeekStart } = await params
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rawWeekStart)) redirect('/me/timesheet')

  const weekStart = mondayAnchorOf(rawWeekStart)
  if (weekStart !== rawWeekStart) redirect(`/me/timesheet/${weekStart}`)

  const { employeeId } = await getCurrentEmployee()

  let week = await getMyWeek(employeeId, weekStart)
  const { inserted } = await prefillLeaveAndHolidays(employeeId, week.weekStart)
  if (inserted > 0) week = await getMyWeek(employeeId, weekStart)

  const [projects, activityTypes, timer] = await Promise.all([
    listProjects({ activeOnly: true }),
    listActivityTypes({ activeOnly: true }),
    getActiveTimer(employeeId),
  ])

  // Map server rows → client rows. We hydrate one stable clientId per row,
  // so the React keys are stable on first render. After that the client owns
  // identity.
  const initialRows: ClientRow[] = week.rows.map((r, idx) => ({
    clientId: `${r.project_id}-${r.activity_type_id}-${r.task ?? ''}-${r.work_mode}-${idx}`,
    project_id: r.project_id,
    project_code: r.project_code,
    project_name: r.project_name,
    activity_type_id: r.activity_type_id,
    activity_code: r.activity_code,
    activity_name: r.activity_name,
    task: r.task,
    description: r.description,
    work_mode: r.work_mode,
    source: r.source,
    hoursByDate: { ...r.hoursByDate },
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title={week.rangeLabel}
        back={{ href: '/me/timesheet', label: 'My timesheets' }}
        subtitle="Add rows freely. Press Ctrl+S to save changes — once saved, the button becomes Submit for approval."
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={STATUS_TONE[week.status]}>{week.status}</Badge>
            {week.status === 'draft' || week.status === 'rejected' ? <TimesheetImport /> : null}
          </div>
        }
      />

      <TimerBar
        timer={timer}
        projects={projects}
        activityTypes={activityTypes}
      />

      {/* Week navigator */}
      <div className="flex items-center justify-center gap-4 rounded-lg border border-slate-200 bg-white py-2 dark:border-slate-800 dark:bg-slate-900">
        <Link
          href={`/me/timesheet/${week.prevWeek}`}
          className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800"
          aria-label="Previous week"
        >‹</Link>
        <div className="text-sm font-medium tabular-nums text-slate-900 dark:text-slate-50">
          {week.rangeLabel}
        </div>
        <Link
          href={`/me/timesheet/${week.nextWeek}`}
          className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800"
          aria-label="Next week"
        >›</Link>
        {(week.weekStart > week.todayIso || week.weekEnd < week.todayIso) && (
          <Link href={`/me/timesheet/${mondayAnchorOf()}`} className="ml-2 text-xs font-medium text-brand-700 hover:underline dark:text-brand-400">
            This week
          </Link>
        )}
      </div>

      {week.status === 'rejected' && week.decisionNote && (
        <Card className="border-red-300 dark:border-red-900">
          <div className="px-4 py-3">
            <div className="text-sm font-semibold text-red-900 dark:text-red-200">Rejected</div>
            <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">{week.decisionNote}</div>
          </div>
        </Card>
      )}

      <WeekClient
        weekStart={week.weekStart}
        weekStatus={week.status}
        todayIso={week.todayIso}
        days={week.days}
        initialRows={initialRows}
        projects={projects}
        activityTypes={activityTypes}
      />

      {(week.status === 'draft' || week.status === 'rejected') && (
        <div className="flex flex-wrap items-center gap-3">
          <CopyLastWeekButton weekStart={week.weekStart} />
          <p className="text-[11px] text-slate-500">
            Note: <span className="font-medium">Copy last week</span> and <span className="font-medium">Import CSV</span> save directly. If you have unsaved changes, save those first or they&apos;ll be discarded by the import / copy.
          </p>
        </div>
      )}
    </div>
  )
}
