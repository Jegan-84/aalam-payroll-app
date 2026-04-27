import { notFound } from 'next/navigation'
import { getCurrentEmployee } from '@/lib/auth/dal'
import { getEmployee } from '@/lib/employees/queries'
import { getHolidaysForEmployeeInRange, getLeaveContext } from '@/lib/leave/queries'
import { ApplyLeaveForm } from '@/app/(app)/leave/new/_components/apply-leave-form'
import { PageHeader } from '@/components/ui/page-header'

export const metadata = { title: 'Apply for leave' }

export default async function ApplyLeavePage() {
  const { employeeId } = await getCurrentEmployee()
  const today = new Date().toISOString().slice(0, 10)
  const oneYearFromNow = new Date()
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1)

  const [emp, { weeklyOffDays, leaveTypes }, holidays] = await Promise.all([
    getEmployee(employeeId),
    getLeaveContext(),
    getHolidaysForEmployeeInRange(employeeId, today, oneYearFromNow.toISOString().slice(0, 10)),
  ])
  if (!emp) notFound()

  const employees = [
    { id: emp.id as string, employee_code: emp.employee_code as string, full_name_snapshot: emp.full_name_snapshot as string },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Apply for leave"
        back={{ href: '/me/leave', label: 'Leave' }}
        subtitle="Submit a leave application. HR will review and approve or reject."
      />
      <ApplyLeaveForm
        employees={employees}
        leaveTypes={leaveTypes}
        weeklyOffDays={weeklyOffDays}
        holidayDates={Array.from(holidays)}
      />
    </div>
  )
}
