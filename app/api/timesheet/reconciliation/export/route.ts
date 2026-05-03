import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/dal'
import { getTimesheetLeaveReconciliation } from '@/lib/timesheet/reconciliation-queries'
import { toCsv, csvToBytes } from '@/lib/reports/csv'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  await requireRole('admin', 'hr', 'payroll')

  const url = new URL(request.url)
  const from = url.searchParams.get('from') ?? ''
  const to = url.searchParams.get('to') ?? ''
  const employeeId = url.searchParams.get('employee') ?? undefined

  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: 'Invalid from/to' }, { status: 400 })
  }

  const summary = await getTimesheetLeaveReconciliation(from, to, { employeeId })

  const KIND_LABEL: Record<string, string> = {
    leave_no_timesheet: 'Leave only — no timesheet',
    timesheet_no_leave: 'Timesheet only — no leave',
    mismatch:           'Type mismatch',
  }

  const csv = toCsv(
    summary.rows.map((r) => [
      r.date,
      r.employeeCode,
      r.employeeName,
      KIND_LABEL[r.kind],
      r.leaveType ?? '',
      r.leaveStatus ?? '',
      r.timesheetActivity ?? '',
      r.timesheetHours > 0 ? r.timesheetHours.toFixed(2) : '',
      r.detail,
    ]),
    {
      headers: [
        'Date', 'Employee code', 'Employee name', 'Issue',
        'Leave type (application)', 'Leave status', 'Activity (timesheet)', 'Hours', 'Detail',
      ],
    },
  )

  const filename = `timesheet_leave_reconciliation_${from}_to_${to}.csv`
  return new NextResponse(csvToBytes(csv), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
