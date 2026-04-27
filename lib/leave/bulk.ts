'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifySession } from '@/lib/auth/dal'
import { countLeaveDays } from '@/lib/leave/engine'
import { getLeaveContext, getHolidaysForEmployeeInRange } from '@/lib/leave/queries'

export type LeaveBulkRow = {
  employee_code: string
  leave_type_code: string
  from_date: string
  to_date: string
  reason?: string
}

export type BulkResult = {
  created: number
  skipped: Array<{ row: number; employee_code: string; reason: string }>
}

export async function bulkCreateLeaveApplicationsAction(
  rows: LeaveBulkRow[],
): Promise<BulkResult> {
  const session = await verifySession()
  const admin = createAdminClient()

  const [{ data: employees }, { data: leaveTypes }] = await Promise.all([
    admin.from('employees').select('id, employee_code'),
    admin.from('leave_types').select('id, code, is_paid'),
  ])
  const empByCode = new Map((employees ?? []).map((e) => [String(e.employee_code).toUpperCase(), e.id as string]))
  const typeByCode = new Map(
    (leaveTypes ?? []).map((t) => [String(t.code).toUpperCase(), { id: t.id as number, is_paid: Boolean(t.is_paid) }]),
  )

  const { weeklyOffDays } = await getLeaveContext()

  const result: BulkResult = { created: 0, skipped: [] }

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    if (!r.employee_code || !r.leave_type_code || !r.from_date || !r.to_date) {
      result.skipped.push({ row: i + 1, employee_code: r.employee_code || '(none)', reason: 'Missing required field.' })
      continue
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.from_date) || !/^\d{4}-\d{2}-\d{2}$/.test(r.to_date)) {
      result.skipped.push({ row: i + 1, employee_code: r.employee_code, reason: 'Invalid date format (use YYYY-MM-DD).' })
      continue
    }
    if (r.to_date < r.from_date) {
      result.skipped.push({ row: i + 1, employee_code: r.employee_code, reason: 'to_date is before from_date.' })
      continue
    }

    const empId = empByCode.get(r.employee_code.toUpperCase())
    if (!empId) {
      result.skipped.push({ row: i + 1, employee_code: r.employee_code, reason: `Unknown employee_code "${r.employee_code}"` })
      continue
    }
    const lt = typeByCode.get(r.leave_type_code.toUpperCase())
    if (!lt) {
      result.skipped.push({ row: i + 1, employee_code: r.employee_code, reason: `Unknown leave_type_code "${r.leave_type_code}"` })
      continue
    }

    const holidays = await getHolidaysForEmployeeInRange(empId, r.from_date, r.to_date)
    const daysCount = countLeaveDays(r.from_date, r.to_date, { weeklyOffDays, holidayDates: holidays })
    if (daysCount <= 0) {
      result.skipped.push({ row: i + 1, employee_code: r.employee_code, reason: 'Range has no working days.' })
      continue
    }

    const { error } = await admin.from('leave_applications').insert({
      employee_id: empId,
      leave_type_id: lt.id,
      from_date: r.from_date,
      to_date: r.to_date,
      days_count: daysCount,
      reason: r.reason ?? null,
      status: 'submitted',
      applied_at: new Date().toISOString(),
      applied_by: session.userId,
    })
    if (error) {
      result.skipped.push({ row: i + 1, employee_code: r.employee_code, reason: error.message })
      continue
    }
    result.created += 1
  }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'leave.bulk_create',
    entity_type: 'leave_application',
    summary: `Bulk submitted ${result.created} leave request(s); ${result.skipped.length} skipped`,
    after_state: { skipped: result.skipped },
  })

  revalidatePath('/leave')
  return result
}
