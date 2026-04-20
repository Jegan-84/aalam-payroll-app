'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifySession } from '@/lib/auth/dal'
import type { AttendanceStatus } from '@/lib/attendance/engine'

type CellUpdate = {
  attendance_date: string
  status: AttendanceStatus
  leave_type_id?: number | null
  note?: string | null
}

const ALLOWED: AttendanceStatus[] = ['P','A','H','HOL','WO','LEAVE','LOP','NA']

export async function saveAttendanceCells(
  employeeId: string,
  cells: CellUpdate[],
): Promise<{ ok?: true; error?: string }> {
  const session = await verifySession()
  if (!employeeId) return { error: 'Missing employee.' }
  if (!Array.isArray(cells) || cells.length === 0) return { ok: true }

  for (const c of cells) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(c.attendance_date)) return { error: `Invalid date: ${c.attendance_date}` }
    if (!ALLOWED.includes(c.status)) return { error: `Invalid status: ${c.status}` }
    if (c.status === 'LEAVE' && !c.leave_type_id) return { error: 'Leave type required for LEAVE cells.' }
  }

  const admin = createAdminClient()

  // Block writes to locked cells
  const dates = cells.map((c) => c.attendance_date)
  const { data: locked } = await admin
    .from('attendance_days')
    .select('attendance_date, locked')
    .eq('employee_id', employeeId)
    .in('attendance_date', dates)
    .eq('locked', true)
  if (locked && locked.length > 0) {
    return { error: `Cells are locked by payroll: ${locked.map((l) => l.attendance_date).join(', ')}` }
  }

  const rows = cells.map((c) => ({
    employee_id: employeeId,
    attendance_date: c.attendance_date,
    status: c.status,
    leave_type_id: c.status === 'LEAVE' ? c.leave_type_id ?? null : null,
    note: c.note ?? null,
    updated_by: session.userId,
  }))

  const { error } = await admin
    .from('attendance_days')
    .upsert(rows, { onConflict: 'employee_id,attendance_date' })
  if (error) return { error: error.message }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'attendance.save',
    entity_type: 'employee',
    entity_id: employeeId,
    summary: `Saved ${cells.length} attendance cell(s)`,
    after_state: { cells },
  })

  revalidatePath('/attendance')
  revalidatePath(`/attendance/${employeeId}`)
  return { ok: true }
}
