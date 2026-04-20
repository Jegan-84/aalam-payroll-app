import Link from 'next/link'
import { getMonthSummaryForAllEmployees } from '@/lib/attendance/queries'
import { MonthPicker } from './_components/month-picker'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const metadata = { title: 'Attendance' }

type SP = Promise<{ year?: string; month?: string }>

export default async function AttendancePage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams
  const now = new Date()
  const year = sp.year ? Number(sp.year) : now.getFullYear()
  const month = sp.month ? Number(sp.month) : now.getMonth() + 1

  const rows = await getMonthSummaryForAllEmployees(year, month)
  const anyLocked = rows.some((r) => r.summary.anyLocked)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance"
        subtitle={
          anyLocked
            ? 'Click any row to edit day-by-day attendance. Some cells are locked by payroll.'
            : 'Click any row to edit day-by-day attendance.'
        }
        actions={<MonthPicker year={year} month={month} basePath="/attendance" />}
      />

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
              <tr>
                <Th>Employee</Th>
                <Th className="text-right">Days</Th>
                <Th className="text-right">Working</Th>
                <Th className="text-right">Present</Th>
                <Th className="text-right">Leave</Th>
                <Th className="text-right">LOP</Th>
                <Th className="text-right">Holidays</Th>
                <Th className="text-right">Weekly off</Th>
                <Th className="text-right">Paid days</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {rows.length === 0 && (
                <tr><td colSpan={10} className="px-6 py-12 text-center text-sm text-slate-500">No employees yet.</td></tr>
              )}
              {rows.map(({ employee, summary }) => (
                <tr key={employee.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-950">
                  <Td>
                    <Link href={`/attendance/${employee.id}?year=${year}&month=${month}`} className="font-medium text-slate-900 hover:text-brand-700 hover:underline dark:text-slate-100">
                      {employee.full_name_snapshot}{' '}
                      <span className="text-slate-500">({employee.employee_code})</span>
                    </Link>
                  </Td>
                  <Td className="text-right tabular-nums">{summary.daysInMonth}</Td>
                  <Td className="text-right tabular-nums">{summary.workingDays}</Td>
                  <Td className="text-right tabular-nums">{summary.presentDays}</Td>
                  <Td className="text-right tabular-nums">{summary.paidLeaveDays}</Td>
                  <Td className={`text-right tabular-nums ${summary.lopDays > 0 ? 'text-red-700 dark:text-red-400' : ''}`}>
                    {summary.lopDays}
                  </Td>
                  <Td className="text-right tabular-nums">{summary.holidayDays}</Td>
                  <Td className="text-right tabular-nums">{summary.weeklyOffDays}</Td>
                  <Td className="text-right font-semibold tabular-nums">{summary.paidDays}</Td>
                  <Td>
                    {summary.anyLocked ? <Badge tone="warn">locked</Badge> : <span className="text-xs text-slate-500">open</span>}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 ${className}`}>{children}</th>
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-slate-900 dark:text-slate-100 ${className}`}>{children}</td>
}
