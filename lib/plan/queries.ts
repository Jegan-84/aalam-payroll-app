import 'server-only'
import { createClient } from '@/lib/supabase/server'

export type PlanKind = 'WFH' | 'FIRST_HALF_LEAVE' | 'SECOND_HALF_LEAVE' | 'FULL_DAY_LEAVE'

export type PlanRow = {
  id: string
  date: string                  // YYYY-MM-DD
  kind: PlanKind
  leave_type_id: number | null
  leave_code: string | null     // SL / PL / EL / COMP_OFF / LOP — populated when kind is leave
  notes: string | null
}

export type LeaveTypeOption = {
  id: number
  code: string
  name: string
}

export async function getMonthPlan(
  employeeId: string,
  year: number,
  month: number,           // 1..12
): Promise<PlanRow[]> {
  const supabase = await createClient()
  const fromIso = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const toIso = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const { data, error } = await supabase
    .from('monthly_plans')
    .select(`
      id, plan_date, kind, leave_type_id, notes,
      leave_type:leave_types(code)
    `)
    .eq('employee_id', employeeId)
    .gte('plan_date', fromIso)
    .lte('plan_date', toIso)
    .order('plan_date')
  if (error) throw new Error(error.message)

  type Raw = {
    id: string; plan_date: string; kind: PlanKind; leave_type_id: number | null;
    notes: string | null;
    leave_type: { code: string } | { code: string }[] | null
  }
  return ((data ?? []) as unknown as Raw[]).map((r) => {
    const lt = Array.isArray(r.leave_type) ? r.leave_type[0] : r.leave_type
    return {
      id: r.id,
      date: r.plan_date,
      kind: r.kind,
      leave_type_id: r.leave_type_id,
      leave_code: lt?.code ?? null,
      notes: r.notes,
    }
  })
}

export async function getEligibleLeaveTypes(employeeId: string): Promise<LeaveTypeOption[]> {
  const supabase = await createClient()
  const { data: emp } = await supabase
    .from('employees')
    .select('employment_type')
    .eq('id', employeeId)
    .maybeSingle()
  const empType = (emp?.employment_type as string | undefined) ?? ''

  const { data, error } = await supabase
    .from('leave_types')
    .select('id, code, name, is_active, applicable_employment_types')
    .eq('is_active', true)
    .order('display_order')
    .order('name')
  if (error) throw new Error(error.message)

  type Raw = { id: number; code: string; name: string; is_active: boolean; applicable_employment_types: string[] | null }
  const rows = (data ?? []) as Raw[]
  // Return only types eligible for this employee's employment_type. NULL on the
  // applicable_employment_types column means "applies to everyone".
  return rows
    .filter((r) => {
      const allowed = r.applicable_employment_types
      if (!allowed || allowed.length === 0) return allowed === null
      return allowed.includes(empType)
    })
    .map((r) => ({ id: r.id, code: r.code, name: r.name }))
}
