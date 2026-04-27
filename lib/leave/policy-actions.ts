'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifySession, requireRole } from '@/lib/auth/dal'

// -----------------------------------------------------------------------------
// createLeaveTypePolicy — HR / admin defines a new leave type (Maternity,
// Paternity, Bereavement, Sabbatical, etc.). Existing policy fields apply
// (quota, accrual cadence, eligibility). Code is upper-snake and unique.
// -----------------------------------------------------------------------------
export async function createLeaveTypePolicyAction(
  formData: FormData,
): Promise<{ ok?: true; error?: string; id?: number }> {
  const session = await verifySession()
  await requireRole('admin', 'hr')

  const code = String(formData.get('code') ?? '').trim().toUpperCase()
  const name = String(formData.get('name') ?? '').trim()
  const annualQuota = Number(formData.get('annual_quota_days') ?? 0)
  const accrualType = String(formData.get('accrual_type') ?? 'annual')
  const monthlyAccrual = Number(formData.get('monthly_accrual_days') ?? 0)
  const carryMax = Number(formData.get('carry_forward_max_days') ?? 0)
  const maxBalance = formData.get('max_balance_days')
  const maxBalanceVal = maxBalance === null || String(maxBalance).trim() === '' ? null : Number(maxBalance)
  const encashable = formData.get('encashable_on_exit') === 'on'
  const isPaid = formData.get('is_paid') === 'on' || formData.get('is_paid') === 'true'

  if (!code) return { error: 'Code is required' }
  if (!/^[A-Z0-9_]+$/.test(code)) return { error: 'Code must be A-Z, 0-9, _' }
  if (!name) return { error: 'Name is required' }
  if (!['annual', 'monthly', 'half_yearly', 'none'].includes(accrualType)) return { error: 'Invalid accrual type' }
  if (annualQuota < 0 || monthlyAccrual < 0 || carryMax < 0) return { error: 'Values must be ≥ 0' }

  const EMP_TYPES = ['full_time', 'probation', 'contract', 'intern', 'consultant'] as const
  const selectedEmp = EMP_TYPES.filter((t) => formData.get(`emp_${t}`) === 'on')
  // Default behaviour for new types: if HR ticks none, treat as "none eligible
  // by default" so the type only applies via per-employee Special Grant. If HR
  // ticks all, store NULL (= everyone). Otherwise store the chosen subset.
  const applicableEmp: string[] | null =
    selectedEmp.length === EMP_TYPES.length ? null
      : selectedEmp.length === 0 ? []
      : selectedEmp

  const admin = createAdminClient()

  const { data: dupe } = await admin.from('leave_types').select('id').eq('code', code).maybeSingle()
  if (dupe) return { error: `Code "${code}" already exists` }

  const { data: maxOrder } = await admin
    .from('leave_types')
    .select('display_order')
    .order('display_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextOrder = ((maxOrder?.display_order as number | undefined) ?? 0) + 10

  const { data, error } = await admin
    .from('leave_types')
    .insert({
      code,
      name,
      is_paid: isPaid,
      annual_quota_days: annualQuota,
      accrual_type: accrualType,
      monthly_accrual_days: monthlyAccrual,
      carry_forward_max_days: carryMax,
      max_balance_days: maxBalanceVal,
      encashable_on_exit: encashable,
      is_active: true,
      display_order: nextOrder,
      applicable_employment_types: applicableEmp,
    })
    .select('id')
    .single()
  if (error) return { error: error.message }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'leave_type.create',
    entity_type: 'leave_type',
    entity_id: String(data.id),
    summary: `Created leave type ${code} — ${name} (quota ${annualQuota}, ${accrualType})`,
  })

  revalidatePath('/settings/leave-policies')
  revalidatePath('/leave/balances')
  return { ok: true, id: data.id as number }
}

// -----------------------------------------------------------------------------
// updateLeaveTypePolicy — HR edits the policy fields on a leave type
// -----------------------------------------------------------------------------
export async function updateLeaveTypePolicyAction(
  formData: FormData,
): Promise<{ ok?: true; error?: string }> {
  const session = await verifySession()
  await requireRole('admin', 'hr', 'payroll')

  const id = Number(formData.get('id') ?? 0)
  if (!id) return { error: 'Missing id' }

  const annualQuota = Number(formData.get('annual_quota_days') ?? 0)
  const accrualType = String(formData.get('accrual_type') ?? 'annual')
  const monthlyAccrual = Number(formData.get('monthly_accrual_days') ?? 0)
  const carryMax = Number(formData.get('carry_forward_max_days') ?? 0)
  const maxBalance = formData.get('max_balance_days')
  const maxBalanceVal = maxBalance === null || String(maxBalance).trim() === '' ? null : Number(maxBalance)
  const encashable = formData.get('encashable_on_exit') === 'on'
  const isPaid = formData.get('is_paid') === 'on'
  const isActive = formData.get('is_active') === 'on'

  // Eligibility: which employment_types can claim this leave. Null = all.
  const EMP_TYPES = ['full_time', 'probation', 'contract', 'intern', 'consultant'] as const
  const selectedEmp = EMP_TYPES.filter((t) => formData.get(`emp_${t}`) === 'on')
  const applicableEmp: string[] | null =
    selectedEmp.length === EMP_TYPES.length || selectedEmp.length === 0 ? null : selectedEmp

  if (!['annual', 'monthly', 'half_yearly', 'none'].includes(accrualType)) return { error: 'Invalid accrual type' }
  if (annualQuota < 0 || monthlyAccrual < 0 || carryMax < 0) return { error: 'Values must be ≥ 0' }
  if (maxBalanceVal != null && maxBalanceVal < 0) return { error: 'Max balance must be ≥ 0' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('leave_types')
    .update({
      annual_quota_days: annualQuota,
      accrual_type: accrualType,
      monthly_accrual_days: monthlyAccrual,
      carry_forward_max_days: carryMax,
      max_balance_days: maxBalanceVal,
      encashable_on_exit: encashable,
      is_paid: isPaid,
      is_active: isActive,
      applicable_employment_types: applicableEmp,
    })
    .eq('id', id)
  if (error) return { error: error.message }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'leave_type.update_policy',
    entity_type: 'leave_type',
    entity_id: String(id),
    summary: `Updated leave policy — quota ${annualQuota}, ${accrualType}${accrualType === 'monthly' ? ` ×${monthlyAccrual}` : ''}, carry-fwd cap ${carryMax}`,
  })

  revalidatePath('/settings/leave-policies')
  return { ok: true }
}

// -----------------------------------------------------------------------------
// runLeaveAccrual — idempotent accrual for a given (year, month).
// -----------------------------------------------------------------------------
// Handles BOTH:
//   - 'monthly'     — credits `monthly_accrual_days` for the target month
//   - 'half_yearly' — credits `annual_quota_days / 2` at the start of the
//                     half. H1 marker 'YYYY-01', H2 marker 'YYYY-07'. Safe
//                     to run any month in the half — credits once then skips.
//
// `last_accrued_yearmonth` on each balance row guards against double-credit.
// Running for month=2 when H1 wasn't credited still applies H1 retroactively.
// -----------------------------------------------------------------------------
export async function runMonthlyAccrualAction(
  formData: FormData,
): Promise<{ ok?: true; error?: string; accrued?: number; skipped?: number }> {
  const session = await verifySession()
  await requireRole('admin', 'hr', 'payroll')

  const year = Number(formData.get('year') ?? 0)
  const month = Number(formData.get('month') ?? 0)
  if (!year || month < 1 || month > 12) return { error: 'Invalid year/month' }

  const admin = createAdminClient()
  const fyStart = `${year}-01-01`

  const { data: types } = await admin
    .from('leave_types')
    .select('id, code, accrual_type, monthly_accrual_days, annual_quota_days, max_balance_days')
    .in('accrual_type', ['monthly', 'half_yearly'])
    .eq('is_active', true)
  if (!types || types.length === 0) return { ok: true, accrued: 0, skipped: 0 }

  type Policy = {
    code: string
    mode: 'monthly' | 'half_yearly'
    monthly: number
    halfly: number
    cap: number | null
  }
  const byType = new Map<number, Policy>()
  for (const t of types) {
    byType.set(t.id as number, {
      code: t.code as string,
      mode: t.accrual_type as 'monthly' | 'half_yearly',
      monthly: Number(t.monthly_accrual_days ?? 0),
      halfly: Number(t.annual_quota_days ?? 0) / 2,
      cap: t.max_balance_days == null ? null : Number(t.max_balance_days),
    })
  }

  const { data: balances } = await admin
    .from('leave_balances')
    .select('id, leave_type_id, accrued, opening_balance, carried_forward, used, encashed, adjustment, last_accrued_yearmonth')
    .eq('fy_start', fyStart)
    .in('leave_type_id', Array.from(byType.keys()))

  // Target markers for each mode / month.
  const monthMarker = `${year}-${String(month).padStart(2, '0')}`
  const h1Marker    = `${year}-01`
  const h2Marker    = `${year}-07`

  let accruedCount = 0
  let skippedCount = 0
  const diffs: string[] = []

  for (const b of balances ?? []) {
    const policy = byType.get(b.leave_type_id as number)
    if (!policy) continue
    const already = (b.last_accrued_yearmonth as string | null) ?? ''

    // Figure out which markers should be applied given (mode, month).
    const toApply: Array<{ marker: string; days: number }> = []
    if (policy.mode === 'monthly') {
      if (policy.monthly > 0 && (!already || already < monthMarker)) {
        toApply.push({ marker: monthMarker, days: policy.monthly })
      }
    } else {
      // half_yearly — apply H1 if reached, then H2 if month >= 7.
      if (policy.halfly > 0 && (!already || already < h1Marker)) {
        toApply.push({ marker: h1Marker, days: policy.halfly })
      }
      if (month >= 7 && policy.halfly > 0 && (!already || already < h2Marker) && !toApply.find((a) => a.marker === h2Marker)) {
        // Push H2 regardless of whether H1 was in this run — we want both credited.
        toApply.push({ marker: h2Marker, days: policy.halfly })
      }
    }
    if (toApply.length === 0) { skippedCount++; continue }

    // Compute running balance and apply each half in order, respecting cap.
    let runningAccrued = Number(b.accrued ?? 0)
    const carriedFwd = Number(b.carried_forward ?? 0)
    const used = Number(b.used ?? 0)
    const encashed = Number(b.encashed ?? 0)
    const adjustment = Number(b.adjustment ?? 0)
    const opening = Number(b.opening_balance ?? 0)

    let lastMarker = already
    let addedThisRun = 0

    for (const step of toApply) {
      const currentBal = opening + runningAccrued + carriedFwd - used - encashed + adjustment
      let addable = step.days
      if (policy.cap != null) {
        const headroom = policy.cap - currentBal
        if (headroom <= 0) continue
        addable = Math.min(addable, headroom)
      }
      if (addable <= 0) continue
      runningAccrued += addable
      addedThisRun += addable
      lastMarker = step.marker
    }

    if (addedThisRun <= 0 || lastMarker === already) { skippedCount++; continue }

    const { error: uErr } = await admin
      .from('leave_balances')
      .update({ accrued: runningAccrued, last_accrued_yearmonth: lastMarker })
      .eq('id', b.id)
    if (!uErr) {
      accruedCount++
      diffs.push(`${policy.code}+${addedThisRun}`)
    }
  }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'leave.accrue',
    entity_type: 'leave_balances',
    entity_id: monthMarker,
    summary: `Accrual run ${monthMarker} — credited ${accruedCount} rows, skipped ${skippedCount}`,
  })

  revalidatePath('/leave/balances')
  revalidatePath('/settings/leave-policies')
  return { ok: true, accrued: accruedCount, skipped: skippedCount }
}
