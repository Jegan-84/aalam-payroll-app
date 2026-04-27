import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/auth/dal'

export type LeaveTypePolicyRow = {
  id: number
  code: string
  name: string
  is_paid: boolean
  annual_quota_days: number
  accrual_type: 'annual' | 'monthly' | 'half_yearly' | 'none'
  monthly_accrual_days: number
  carry_forward_max_days: number
  max_balance_days: number | null
  encashable_on_exit: boolean
  includes_weekends: boolean
  is_active: boolean
  display_order: number
  applicable_employment_types: string[] | null
}

export async function listLeaveTypePolicies(): Promise<LeaveTypePolicyRow[]> {
  await verifySession()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('leave_types')
    .select(
      `id, code, name, is_paid, annual_quota_days, accrual_type, monthly_accrual_days,
       carry_forward_max_days, max_balance_days, encashable_on_exit, includes_weekends,
       is_active, display_order, applicable_employment_types`,
    )
    .order('display_order')
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => ({
    id: Number(r.id),
    code: r.code as string,
    name: r.name as string,
    is_paid: Boolean(r.is_paid),
    annual_quota_days: Number(r.annual_quota_days),
    accrual_type: r.accrual_type as LeaveTypePolicyRow['accrual_type'],
    monthly_accrual_days: Number(r.monthly_accrual_days ?? 0),
    carry_forward_max_days: Number(r.carry_forward_max_days),
    max_balance_days: r.max_balance_days == null ? null : Number(r.max_balance_days),
    encashable_on_exit: Boolean(r.encashable_on_exit),
    includes_weekends: Boolean(r.includes_weekends),
    is_active: Boolean(r.is_active),
    display_order: Number(r.display_order),
    applicable_employment_types: (r.applicable_employment_types as string[] | null) ?? null,
  }))
}
