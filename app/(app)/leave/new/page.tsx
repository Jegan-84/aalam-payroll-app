import { createClient } from '@/lib/supabase/server'
import { getHolidaysInRange, getLeaveContext } from '@/lib/leave/queries'
import { ApplyLeaveForm } from './_components/apply-leave-form'
import { PageHeader } from '@/components/ui/page-header'

export const metadata = { title: 'Apply for leave' }

export default async function ApplyLeavePage() {
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)
  const oneYearFromNow = new Date()
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1)

  const [{ weeklyOffDays, leaveTypes }, { data: employees }, holidays] = await Promise.all([
    getLeaveContext(),
    supabase
      .from('employees')
      .select('id, employee_code, full_name_snapshot')
      .eq('employment_status', 'active')
      .order('full_name_snapshot'),
    getHolidaysInRange(today, oneYearFromNow.toISOString().slice(0, 10)),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Apply for leave"
        back={{ href: '/leave', label: 'Leave' }}
      />
      <ApplyLeaveForm
        employees={(employees ?? []) as { id: string; employee_code: string; full_name_snapshot: string }[]}
        leaveTypes={leaveTypes}
        weeklyOffDays={weeklyOffDays}
        holidayDates={Array.from(holidays)}
      />
    </div>
  )
}
