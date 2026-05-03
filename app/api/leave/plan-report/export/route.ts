import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/dal'
import { getMonthPlanReport } from '@/lib/plan/report-queries'
import { toCsv, csvToBytes } from '@/lib/reports/csv'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  await requireRole('admin', 'hr', 'payroll')

  const url = new URL(request.url)
  const monthIso = url.searchParams.get('month') ?? ''
  const employeeId = url.searchParams.get('employee') ?? undefined

  if (!/^\d{4}-\d{2}$/.test(monthIso)) {
    return NextResponse.json({ error: 'Invalid month (expect YYYY-MM)' }, { status: 400 })
  }
  const [year, month] = monthIso.split('-').map(Number)
  if (year < 2020 || year > 2100 || month < 1 || month > 12) {
    return NextResponse.json({ error: 'Month out of range' }, { status: 400 })
  }

  const report = await getMonthPlanReport(year, month, { employeeId })

  const csv = toCsv(
    report.rows.map((r) => [
      r.employeeCode,
      r.employeeName,
      r.wfhDays,
      r.firstHalfLeaveDays,
      r.secondHalfLeaveDays,
      r.fullDayLeaveDays,
      r.totalLeaveDays.toFixed(1),
      r.plannedDays === 0 ? 'No plan' : 'Filed',
      Object.entries(r.leaveByType)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([code, d]) => `${code}:${d % 1 === 0 ? d : d.toFixed(1)}`)
        .join('; '),
    ]),
    {
      headers: [
        'Employee code', 'Employee name',
        'WFH days', '1st-half leave', '2nd-half leave', 'Full-day leave',
        'Total leave days', 'Status', 'Leave breakdown',
      ],
    },
  )

  const filename = `monthly_plan_report_${monthIso}.csv`
  return new NextResponse(csvToBytes(csv), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
