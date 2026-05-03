import { notFound } from 'next/navigation'
import { getCurrentEmployee } from '@/lib/auth/dal'
import { getEmployee } from '@/lib/employees/queries'
import { getHolidaysForEmployeeInRange, getLeaveContext, getLeaveApplication } from '@/lib/leave/queries'
import { ApplyLeaveForm } from '@/app/(app)/leave/new/_components/apply-leave-form'
import { PageHeader } from '@/components/ui/page-header'

export const metadata = { title: 'Apply for leave' }

type SP = Promise<{ from_application?: string }>

export default async function ApplyLeavePage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams
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

  // Optional pre-fill from a previous (rejected/cancelled) application owned
  // by the same employee. Submitting still creates a brand-new row — this
  // just saves the typing.
  let prefill: undefined | {
    employee_id: string
    leave_type_id: number
    from_date: string
    to_date: string
    reason: string | null
    is_half_day: boolean
  }
  let banner: { kind: 'info' | 'warn'; text: string } | null = null
  if (sp.from_application) {
    const src = await getLeaveApplication(sp.from_application)
    if (src && src.employee_id === employeeId) {
      prefill = {
        employee_id: employeeId,
        leave_type_id: src.leave_type_id as number,
        from_date: src.from_date as string,
        to_date: src.to_date as string,
        reason: (src.reason as string | null) ?? null,
        is_half_day: !!src.is_half_day,
      }
      const wasRejected = src.status === 'rejected'
      banner = {
        kind: wasRejected ? 'warn' : 'info',
        text: wasRejected
          ? `Re-applying after rejection. Edit anything that needs to change before submitting — this creates a new application.`
          : `Pre-filled from a previous application. Submitting creates a new entry.`,
      }
    }
  }

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
        prefill={prefill}
        banner={banner}
      />
    </div>
  )
}
