import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getEmployeeMonthGrid } from '@/lib/attendance/queries'
import { MONTH_NAMES } from '@/lib/attendance/engine'
import { MonthPicker } from '../_components/month-picker'
import { AttendanceGrid } from './_components/attendance-grid'

type PP = Promise<{ employeeId: string }>
type SP = Promise<{ year?: string; month?: string }>

export async function generateMetadata({ params, searchParams }: { params: PP; searchParams: SP }) {
  const { employeeId } = await params
  const sp = await searchParams
  const now = new Date()
  const year = sp.year ? Number(sp.year) : now.getFullYear()
  const month = sp.month ? Number(sp.month) : now.getMonth() + 1
  const grid = await getEmployeeMonthGrid(employeeId, year, month)
  return { title: grid ? `Attendance — ${grid.employee.employee_code} ${MONTH_NAMES[month - 1]} ${year}` : 'Attendance' }
}

export default async function AttendanceDetailPage({
  params, searchParams,
}: {
  params: PP
  searchParams: SP
}) {
  const { employeeId } = await params
  const sp = await searchParams
  const now = new Date()
  const year = sp.year ? Number(sp.year) : now.getFullYear()
  const month = sp.month ? Number(sp.month) : now.getMonth() + 1

  const grid = await getEmployeeMonthGrid(employeeId, year, month)
  if (!grid) notFound()

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href={`/attendance?year=${year}&month=${month}`} className="text-sm text-slate-500 hover:underline">
            ← Attendance
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            {grid.employee.full_name_snapshot}{' '}
            <span className="text-base font-normal text-slate-500">({grid.employee.employee_code})</span>
          </h1>
        </div>
        <MonthPicker
          year={year}
          month={month}
          basePath={`/attendance/${employeeId}`}
          buildQuery={(y, m) => `?year=${y}&month=${m}`}
        />
      </div>

      <AttendanceGrid
        employeeId={employeeId}
        year={year}
        month={month}
        initialCells={grid.cells}
        leaveTypes={grid.leaveTypes}
      />
    </div>
  )
}
