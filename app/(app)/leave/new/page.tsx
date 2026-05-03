import { createClient } from '@/lib/supabase/server'
import { getHolidaysInRange, getLeaveContext, getLeaveApplication } from '@/lib/leave/queries'
import { ApplyLeaveForm } from './_components/apply-leave-form'
import { PageHeader } from '@/components/ui/page-header'

export const metadata = { title: 'Apply for leave' }

type SP = Promise<{ from_application?: string }>

export default async function ApplyLeavePage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams
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

  // Optional pre-fill from a previous (rejected/cancelled) application — admin
  // side. Submitting still creates a brand-new application row.
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
    if (src) {
      prefill = {
        employee_id: src.employee_id as string,
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
          ? `Re-applying after rejection. Edit anything that needs to change before submitting — this creates a new application row.`
          : `Pre-filled from a previous application. Submitting creates a new row.`,
      }
    }
  }

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
        prefill={prefill}
        banner={banner}
      />
    </div>
  )
}
