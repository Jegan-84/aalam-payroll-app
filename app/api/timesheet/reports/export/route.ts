import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/dal'
import {
  reportByProject,
  reportByEmployee,
  reportByActivity,
} from '@/lib/timesheet/report-queries'
import { toCsv, csvToBytes } from '@/lib/reports/csv'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  await requireRole('admin', 'hr', 'payroll')

  const url = new URL(request.url)
  const tab = url.searchParams.get('tab') ?? 'project'
  const from = url.searchParams.get('from') ?? ''
  const to = url.searchParams.get('to') ?? ''
  const includeSubmitted = url.searchParams.get('live') === '1'

  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: 'Invalid from/to' }, { status: 400 })
  }

  let csvText: string
  let filename: string

  if (tab === 'employee') {
    const rows = await reportByEmployee(from, to, { includeSubmitted })
    csvText = toCsv(
      rows.map((r) => [
        r.employee_code, r.employee_name,
        r.totalHours.toFixed(2),
        r.workingDays, r.capacityHours.toFixed(2),
        `${r.utilizationPct}%`,
        r.daysLogged, r.daysWithGaps,
      ]),
      { headers: [
        'Employee code', 'Employee name', 'Total hours',
        'Working days', 'Capacity', 'Utilization %', 'Days logged', 'Days with gaps',
      ] },
    )
    filename = `timesheet_by_employee_${from}_to_${to}.csv`
  } else if (tab === 'activity') {
    const rows = await reportByActivity(from, to, { includeSubmitted })
    csvText = toCsv(
      rows.map((r) => [
        r.activity_code, r.activity_name,
        r.totalHours.toFixed(2),
        r.projectCount, r.employeeCount,
      ]),
      { headers: [
        'Activity code', 'Activity name', 'Total hours', 'Projects', 'Employees',
      ] },
    )
    filename = `timesheet_by_activity_${from}_to_${to}.csv`
  } else {
    const rows = await reportByProject(from, to, { includeSubmitted })
    csvText = toCsv(
      rows.map((r) => [
        r.project_code, r.project_name,
        r.totalHours.toFixed(2),
        r.employeeCount,
      ]),
      { headers: [
        'Project code', 'Project name', 'Total hours', 'Employees',
      ] },
    )
    filename = `timesheet_by_project_${from}_to_${to}.csv`
  }

  return new NextResponse(csvToBytes(csvText), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
