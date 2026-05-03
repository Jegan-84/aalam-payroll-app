import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/dal'
import { getDailyTimesheetGrid, formatHHMM } from '@/lib/timesheet/grid-queries'
import { buildXlsx, type XlsxRow, type XlsxStyle } from '@/lib/reports/xlsx'

export const runtime = 'nodejs'

const MAX_EXPORT_DAYS = 366    // a full year — exports can be wider than the on-screen grid

export async function GET(request: Request) {
  await requireRole('admin', 'hr', 'payroll')

  const url = new URL(request.url)
  const from = url.searchParams.get('from') ?? ''
  const to = url.searchParams.get('to') ?? ''
  const employeeId = url.searchParams.get('employee') ?? undefined
  const includeSubmitted = url.searchParams.get('live') === '1'

  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: 'Invalid from/to' }, { status: 400 })
  }

  const dayCount = Math.floor((new Date(to + 'T00:00:00Z').getTime() - new Date(from + 'T00:00:00Z').getTime()) / 86_400_000) + 1
  if (dayCount > MAX_EXPORT_DAYS) {
    return NextResponse.json({ error: `Range too wide (${dayCount} days). Max ${MAX_EXPORT_DAYS}.` }, { status: 400 })
  }

  const grid = await getDailyTimesheetGrid(from, to, { employeeId, includeSubmitted })

  // Header row: Aalam ID, Employee Name, [each date], Total Working Hours, Total Leave Hours
  const headerRow: XlsxRow = [
    { value: 'Aalam ID', style: 'header' },
    { value: 'Employee Name', style: 'header' },
    ...grid.dates.map((d) => ({ value: formatDateHeader(d), style: 'header' as XlsxStyle })),
    { value: 'Total Working Hours', style: 'header' },
    { value: 'Total Leave Hours', style: 'header' },
  ]

  const dataRows: XlsxRow[] = grid.rows.map((r) => [
    { value: r.employeeCode },
    { value: r.employeeName },
    ...grid.dates.map((d): { value: string; style?: XlsxStyle } => {
      const c = r.cells[d]
      switch (c.state) {
        case 'full_leave':
          return { value: c.leaveCode ? `Leave (${c.leaveCode})` : 'Leave', style: 'full_leave' }
        case 'half_leave':
          return { value: formatHHMM(c.workedHours), style: 'half_leave' }
        case 'wfh':
          return { value: `${formatHHMM(c.workedHours)} (WFH)`, style: 'wfh' }
        case 'weekend':
          return { value: formatHHMM(c.workedHours), style: 'weekend' }
        default:
          return { value: formatHHMM(c.workedHours) }
      }
    }),
    { value: formatHHMM(r.totalWorkedHours), style: 'totals' },
    { value: formatHHMM(r.totalLeaveHours), style: 'totals' },
  ])

  // Column widths: ID narrow, Name wide, dates compact, totals medium.
  const cols = [
    { width: 12 },
    { width: 26 },
    ...grid.dates.map(() => ({ width: 11 })),
    { width: 20 },
    { width: 18 },
  ]

  const buffer = await buildXlsx({
    sheetName: 'Daily Grid',
    rows: [headerRow, ...dataRows],
    cols,
    freeze: { rows: 1, cols: 2 },   // keep header row + first two cols visible while scrolling
  })

  const filename = `timesheet_daily_grid_${from}_to_${to}.xlsx`
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}

function formatDateHeader(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z')
  const day = d.getUTCDate()
  const mon = d.toLocaleString('en-IN', { month: 'short', timeZone: 'UTC' })
  const yy = String(d.getUTCFullYear()).slice(-2)
  return `${day} ${mon} ${yy}`
}
