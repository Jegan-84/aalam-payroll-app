'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifySession } from '@/lib/auth/dal'
import { computeFnf, type FnfManualLine } from './engine'
import { getTaxSlabsForFy } from '@/lib/payroll/queries'
import { computeDeductions, type RawDeclaration } from '@/lib/tax/declarations'
import { resolveFy } from '@/lib/leave/engine'

// -----------------------------------------------------------------------------
// initiate — creates a draft settlement with employee + company snapshots
// -----------------------------------------------------------------------------
export async function initiateFnfAction(
  formData: FormData,
): Promise<{ ok?: true; error?: string; id?: string }> {
  const session = await verifySession()
  const employeeId = String(formData.get('employee_id') ?? '')
  const lastWorkingDay = String(formData.get('last_working_day') ?? '')
  const noticePeriodDays = Number(formData.get('notice_period_days') ?? 60)
  const noticeDaysServed = Number(formData.get('notice_days_served') ?? 0)

  if (!employeeId) return { error: 'Missing employee_id' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(lastWorkingDay)) return { error: 'Invalid last_working_day' }
  if (noticeDaysServed > noticePeriodDays) return { error: 'Days served cannot exceed the notice period.' }

  const admin = createAdminClient()

  // Block duplicate F&F for the same employee.
  const { data: existing } = await admin
    .from('fnf_settlements')
    .select('id')
    .eq('employee_id', employeeId)
    .maybeSingle()
  if (existing) return { error: 'This employee already has an F&F settlement. Open it from the F&F tab.' }

  // Employee + company snapshot
  const { data: emp, error: empErr } = await admin
    .from('employees')
    .select(
      `
      id, employee_code, full_name_snapshot, pan_number, date_of_joining, tax_regime_code,
      bank_name, bank_account_number, bank_ifsc,
      department:departments ( name ), designation:designations ( name ), location:locations ( name ),
      company:companies ( id, legal_name, display_name, pan, tan, gstin, logo_url, address_line1, address_line2, city, state, pincode )
    `,
    )
    .eq('id', employeeId)
    .maybeSingle()
  if (empErr) return { error: empErr.message }
  if (!emp) return { error: 'Employee not found' }

  // Salary snapshot
  const { data: structure } = await admin
    .from('salary_structures')
    .select('id, monthly_gross, annual_gross, annual_fixed_ctc')
    .eq('employee_id', employeeId)
    .is('effective_to', null)
    .eq('status', 'active')
    .maybeSingle()
  if (!structure) return { error: 'Employee has no active salary structure.' }

  type Depish = { name?: string } | { name?: string }[] | null
  const firstName = (v: Depish) => (Array.isArray(v) ? v[0]?.name : v?.name) ?? null

  type CoEmbed = {
    id: string; legal_name: string; display_name: string
    pan: string | null; tan: string | null; gstin: string | null; logo_url: string | null
    address_line1: string | null; address_line2: string | null
    city: string | null; state: string | null; pincode: string | null
  } | null
  const raw = emp.company as CoEmbed | CoEmbed[] | null
  const co = (Array.isArray(raw) ? raw[0] : raw) ?? null
  const addressParts = co
    ? [co.address_line1, co.address_line2, [co.city, co.state, co.pincode].filter(Boolean).join(' ')].filter(Boolean)
    : []

  const monthlyGross = Number(structure.monthly_gross)
  const lastBasic = Math.round(monthlyGross * 0.5)

  const fy = resolveFy(new Date(lastWorkingDay + 'T00:00:00Z'), 4)

  const { data, error } = await admin
    .from('fnf_settlements')
    .insert({
      employee_id: employeeId,
      last_working_day: lastWorkingDay,
      notice_period_days: noticePeriodDays,
      notice_days_served: noticeDaysServed,

      employee_code_snapshot: emp.employee_code as string,
      employee_name_snapshot: emp.full_name_snapshot as string,
      pan_snapshot: (emp.pan_number as string | null) ?? null,
      date_of_joining_snapshot: emp.date_of_joining as string,
      department_snapshot: firstName(emp.department as Depish),
      designation_snapshot: firstName(emp.designation as Depish),
      location_snapshot: firstName(emp.location as Depish),
      bank_name_snapshot: (emp.bank_name as string | null) ?? null,
      bank_account_snapshot: (emp.bank_account_number as string | null) ?? null,
      bank_ifsc_snapshot: (emp.bank_ifsc as string | null) ?? null,
      tax_regime_snapshot: (emp.tax_regime_code as string | null) ?? 'NEW',

      company_id: co?.id ?? null,
      company_legal_name_snapshot: co?.legal_name ?? null,
      company_display_name_snapshot: co?.display_name ?? null,
      company_address_snapshot: addressParts.join(', ') || null,
      company_pan_snapshot: co?.pan ?? null,
      company_tan_snapshot: co?.tan ?? null,
      company_gstin_snapshot: co?.gstin ?? null,
      company_logo_snapshot: co?.logo_url ?? null,

      salary_structure_id: structure.id,
      monthly_gross_snapshot: monthlyGross,
      annual_gross_snapshot: Number(structure.annual_gross),
      last_basic_snapshot: lastBasic,

      fy_start_snapshot: fy.fyStart,

      status: 'draft',
      initiated_by: session.userId,
    })
    .select('id')
    .single()
  if (error) return { error: error.message }

  // Seed a manual deduction line per active loan = outstanding balance.
  // HR can edit/remove these before computing.
  const { data: activeLoans } = await admin
    .from('employee_loans')
    .select('id, loan_type, outstanding_balance')
    .eq('employee_id', employeeId)
    .eq('status', 'active')
  const loanLines = (activeLoans ?? [])
    .filter((l) => Number(l.outstanding_balance) > 0)
    .map((l, i) => {
      const prefix = String(l.id).replace(/-/g, '').slice(0, 12).toUpperCase()
      return {
        settlement_id: data.id,
        code: `LOAN_${prefix}`,
        name: `Loan recovery (${l.loan_type})`,
        kind: 'deduction',
        amount: Number(l.outstanding_balance),
        source: 'manual',
        display_order: 600 + i,
        created_by: session.userId,
      }
    })
  if (loanLines.length > 0) {
    await admin.from('fnf_line_items').insert(loanLines)
  }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'fnf.initiate',
    entity_type: 'fnf_settlement',
    entity_id: data.id,
    summary: `Initiated F&F for ${emp.employee_code} (LWD ${lastWorkingDay})${loanLines.length > 0 ? `; seeded ${loanLines.length} loan recovery line(s)` : ''}`,
  })

  revalidatePath(`/employees/${employeeId}/fnf`)
  return { ok: true, id: data.id as string }
}

// -----------------------------------------------------------------------------
// compute — regenerate all auto lines + totals + final TDS
// -----------------------------------------------------------------------------
export async function computeFnfAction(
  formData: FormData,
): Promise<{ ok?: true; error?: string }> {
  const session = await verifySession()
  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'Missing id' }

  const admin = createAdminClient()

  const { data: settlement } = await admin
    .from('fnf_settlements')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (!settlement) return { error: 'Settlement not found' }
  if (settlement.status === 'approved' || settlement.status === 'paid') {
    return { error: `Settlement is ${settlement.status}; cannot recompute.` }
  }

  // Manual lines preserve across recomputes.
  const { data: existingLines } = await admin
    .from('fnf_line_items')
    .select('id, code, name, kind, amount, source')
    .eq('settlement_id', id)
  const manualLines: FnfManualLine[] = (existingLines ?? [])
    .filter((l) => l.source === 'manual')
    .map((l) => ({
      code: l.code as string,
      name: l.name as string,
      kind: l.kind as 'earning' | 'deduction',
      amount: Number(l.amount),
    }))

  // Leave balance — earned leave (EL)
  const { data: leaveTypes } = await admin
    .from('leave_types')
    .select('id, code, encashable_on_exit')
    .eq('is_active', true)
  const elType = (leaveTypes ?? []).find((t) => t.code === 'EL' && t.encashable_on_exit)
  let encashableDays = 0
  if (elType && settlement.fy_start_snapshot) {
    const { data: bal } = await admin
      .from('leave_balances')
      .select('current_balance')
      .eq('employee_id', settlement.employee_id as string)
      .eq('fy_start', settlement.fy_start_snapshot as string)
      .eq('leave_type_id', elType.id as number)
      .maybeSingle()
    if (bal) encashableDays = Math.max(0, Number(bal.current_balance))
  }

  // Tax slabs + config for the FY
  const regime = ((settlement.tax_regime_snapshot as string | null) ?? 'NEW') as 'NEW' | 'OLD'
  const fyStart = settlement.fy_start_snapshot as string
  const taxBundle = await getTaxSlabsForFy(fyStart, regime)

  // OLD regime declaration deductions
  let oldDeductionsTotal = 0
  if (regime === 'OLD') {
    const { data: decl } = await admin
      .from('employee_tax_declarations')
      .select('*')
      .eq('employee_id', settlement.employee_id as string)
      .eq('fy_start', fyStart)
      .eq('status', 'approved')
      .maybeSingle()
    if (decl) {
      const annualBasic = Number(settlement.annual_gross_snapshot) * 0.5
      const annualHra = annualBasic * 0.5
      const d = computeDeductions((decl as unknown) as RawDeclaration, {
        hraReceivedAnnual: annualHra,
        basicAnnual: annualBasic,
      })
      oldDeductionsTotal = d.total
    }
  }

  // YTD gross + TDS from the tds_ledger for this FY
  const { data: ledgerRows } = await admin
    .from('tds_ledger')
    .select('gross_earnings, tds_deducted')
    .eq('employee_id', settlement.employee_id as string)
    .eq('fy_start', fyStart)
  const fyGrossBeforeFnf = (ledgerRows ?? []).reduce((s, r) => s + Number(r.gross_earnings), 0)
  const fyTdsBeforeFnf = (ledgerRows ?? []).reduce((s, r) => s + Number(r.tds_deducted), 0)

  // Run engine
  const out = computeFnf({
    dateOfJoining: settlement.date_of_joining_snapshot as string,
    lastWorkingDay: settlement.last_working_day as string,
    noticePeriodDays: Number(settlement.notice_period_days),
    noticeDaysServed: Number(settlement.notice_days_served),

    monthlyGross: Number(settlement.monthly_gross_snapshot),
    annualGross: Number(settlement.annual_gross_snapshot),

    encashableDays,

    fyStart,
    fyGrossBeforeFnf,
    fyTdsBeforeFnf,
    taxRegime: regime,
    taxSlabs: taxBundle.slabs,
    taxConfig: taxBundle.config,
    taxSurchargeSlabs: taxBundle.surchargeSlabs,
    oldRegimeDeductionsTotal: oldDeductionsTotal,

    manualLines,
  })

  // Wipe existing auto lines, insert fresh.
  await admin.from('fnf_line_items').delete().eq('settlement_id', id).eq('source', 'auto')
  const autoInserts = out.autoLines.map((l) => ({
    settlement_id: id,
    code: l.code,
    name: l.name,
    kind: l.kind,
    amount: l.amount,
    source: 'auto',
    display_order: l.displayOrder,
    created_by: session.userId,
  }))
  if (autoInserts.length > 0) {
    const { error: insErr } = await admin.from('fnf_line_items').insert(autoInserts)
    if (insErr) return { error: insErr.message }
  }

  // Update settlement totals + tenure.
  const { error: updErr } = await admin
    .from('fnf_settlements')
    .update({
      service_years: out.serviceYears,
      service_days: out.serviceDays,
      gratuity_eligible: out.gratuityEligible,
      final_month_earnings: out.finalMonthEarnings,
      leave_encashment_days: out.leaveEncashmentDays,
      leave_encashment_amount: out.leaveEncashmentAmount,
      gratuity_amount: out.gratuityAmount,
      notice_pay_payout: out.noticePayPayout,
      notice_pay_recovery: out.noticePayRecovery,
      total_earnings: out.totalEarnings,
      total_deductions: out.totalDeductions,
      net_payout: out.netPayout,
      final_tds: out.finalTds,
      fy_gross_before_fnf: fyGrossBeforeFnf,
      fy_tds_before_fnf: fyTdsBeforeFnf,
      status: 'computed',
      computed_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (updErr) return { error: updErr.message }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'fnf.compute',
    entity_type: 'fnf_settlement',
    entity_id: id,
    summary: `Computed F&F (net ₹${out.netPayout}, TDS ₹${out.finalTds})`,
  })

  revalidatePath(`/fnf/${id}`)
  revalidatePath(`/employees/${settlement.employee_id}/fnf`)
  return { ok: true }
}

// -----------------------------------------------------------------------------
// saveManualLine — HR adds/edits a manual earning or deduction
// -----------------------------------------------------------------------------
export async function saveFnfManualLineAction(
  formData: FormData,
): Promise<{ ok?: true; error?: string }> {
  const session = await verifySession()
  const settlementId = String(formData.get('settlement_id') ?? '')
  const lineId = formData.get('line_id') ? String(formData.get('line_id')) : null
  const code = String(formData.get('code') ?? '').toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 32)
  const name = String(formData.get('name') ?? '').slice(0, 120)
  const kind = String(formData.get('kind') ?? 'earning')
  const amount = Number(formData.get('amount') ?? 0)
  if (!settlementId || !code || !name) return { error: 'Missing fields' }
  if (kind !== 'earning' && kind !== 'deduction') return { error: 'Invalid kind' }
  if (!Number.isFinite(amount) || amount < 0) return { error: 'Invalid amount' }

  const admin = createAdminClient()
  const { data: s } = await admin.from('fnf_settlements').select('status, employee_id').eq('id', settlementId).maybeSingle()
  if (!s) return { error: 'Settlement not found' }
  if (s.status === 'approved' || s.status === 'paid') return { error: `Settlement is ${s.status}; cannot edit.` }

  if (lineId) {
    const { error } = await admin
      .from('fnf_line_items')
      .update({ code, name, kind, amount })
      .eq('id', lineId)
      .eq('source', 'manual')
    if (error) return { error: error.message }
  } else {
    const { error } = await admin.from('fnf_line_items').insert({
      settlement_id: settlementId,
      code, name, kind, amount,
      source: 'manual',
      display_order: 500,
      created_by: session.userId,
    })
    if (error) return { error: error.message }
  }

  revalidatePath(`/fnf/${settlementId}`)
  return { ok: true }
}

// -----------------------------------------------------------------------------
// deleteManualLine
// -----------------------------------------------------------------------------
export async function deleteFnfLineAction(formData: FormData): Promise<{ ok?: true; error?: string }> {
  await verifySession()
  const id = String(formData.get('id') ?? '')
  const settlementId = String(formData.get('settlement_id') ?? '')
  if (!id || !settlementId) return { error: 'Missing id' }
  const admin = createAdminClient()
  const { data: s } = await admin.from('fnf_settlements').select('status').eq('id', settlementId).maybeSingle()
  if (!s) return { error: 'Settlement not found' }
  if (s.status === 'approved' || s.status === 'paid') return { error: `Settlement is ${s.status}; cannot edit.` }

  const { error } = await admin
    .from('fnf_line_items')
    .delete()
    .eq('id', id)
    .eq('source', 'manual')
  if (error) return { error: error.message }
  revalidatePath(`/fnf/${settlementId}`)
  return { ok: true }
}

// -----------------------------------------------------------------------------
// approve — flip employee to exited, close structure, lock settlement
// -----------------------------------------------------------------------------
export async function approveFnfAction(formData: FormData): Promise<{ ok?: true; error?: string }> {
  const session = await verifySession()
  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'Missing id' }

  const admin = createAdminClient()
  const { data: s } = await admin.from('fnf_settlements').select('*').eq('id', id).maybeSingle()
  if (!s) return { error: 'Settlement not found' }
  if (s.status !== 'computed') return { error: `Settlement must be 'computed' to approve (is '${s.status}').` }

  const lwd = s.last_working_day as string

  // 1. Mark employee exited + set date_of_exit
  const { error: empErr } = await admin
    .from('employees')
    .update({ employment_status: 'exited', date_of_exit: lwd })
    .eq('id', s.employee_id as string)
  if (empErr) return { error: empErr.message }

  // 2. Close the active salary structure (set effective_to = LWD, mark superseded)
  await admin
    .from('salary_structures')
    .update({ effective_to: lwd, status: 'superseded' })
    .eq('employee_id', s.employee_id as string)
    .is('effective_to', null)
    .eq('status', 'active')

  // 3. Close any active loans for the employee. For each LOAN_<prefix> line in
  //    the settlement, deduct the recovered amount from outstanding_balance; if
  //    the loan still has an unrecovered balance after F&F, mark it written_off.
  const { data: loanLines } = await admin
    .from('fnf_line_items')
    .select('code, amount')
    .eq('settlement_id', id)
    .like('code', 'LOAN_%')
    .eq('kind', 'deduction')
  const { data: activeLoans } = await admin
    .from('employee_loans')
    .select('id, outstanding_balance, principal, status')
    .eq('employee_id', s.employee_id as string)
    .in('status', ['active'])
  const loanByPrefix = new Map<string, { id: string; outstanding: number; principal: number }>()
  for (const l of activeLoans ?? []) {
    const prefix = String(l.id).replace(/-/g, '').slice(0, 12).toLowerCase()
    loanByPrefix.set(prefix, {
      id: l.id as string,
      outstanding: Number(l.outstanding_balance),
      principal: Number(l.principal),
    })
  }
  for (const line of loanLines ?? []) {
    const prefix = String(line.code).slice(5).toLowerCase()
    const loan = loanByPrefix.get(prefix)
    if (!loan) continue
    const recovered = Math.min(loan.outstanding, Number(line.amount))
    const newOutstanding = Math.max(0, loan.outstanding - recovered)
    const newStatus = newOutstanding === 0 ? 'closed' : 'written_off'
    await admin
      .from('employee_loans')
      .update({
        outstanding_balance: newOutstanding,
        total_paid: loan.principal - newOutstanding,
        status: newStatus,
        closed_at: new Date().toISOString(),
        closed_by: session.userId,
      })
      .eq('id', loan.id)
  }
  // Any remaining active loans (no recovery line provided) → written_off on exit.
  const recoveredPrefixes = new Set(
    (loanLines ?? []).map((l) => String(l.code).slice(5).toLowerCase()),
  )
  for (const [prefix, loan] of loanByPrefix) {
    if (recoveredPrefixes.has(prefix)) continue
    if (loan.outstanding <= 0) continue
    await admin
      .from('employee_loans')
      .update({
        status: 'written_off',
        closed_at: new Date().toISOString(),
        closed_by: session.userId,
      })
      .eq('id', loan.id)
  }

  // 4. Lock the settlement
  await admin
    .from('fnf_settlements')
    .update({ status: 'approved', approved_at: new Date().toISOString(), approved_by: session.userId })
    .eq('id', id)

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'fnf.approve',
    entity_type: 'fnf_settlement',
    entity_id: id,
    summary: `Approved F&F — employee marked exited on ${lwd}`,
  })

  revalidatePath(`/fnf/${id}`)
  revalidatePath(`/employees/${s.employee_id}`)
  revalidatePath(`/employees/${s.employee_id}/fnf`)
  return { ok: true }
}

// -----------------------------------------------------------------------------
// markPaid
// -----------------------------------------------------------------------------
export async function markFnfPaidAction(formData: FormData): Promise<{ ok?: true; error?: string }> {
  const session = await verifySession()
  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'Missing id' }
  const admin = createAdminClient()
  const { data: s } = await admin.from('fnf_settlements').select('status').eq('id', id).maybeSingle()
  if (!s) return { error: 'Settlement not found' }
  if (s.status !== 'approved') return { error: `Settlement must be 'approved' to mark paid (is '${s.status}').` }

  await admin
    .from('fnf_settlements')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', id)

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'fnf.pay',
    entity_type: 'fnf_settlement',
    entity_id: id,
    summary: 'F&F marked as paid',
  })

  revalidatePath(`/fnf/${id}`)
  return { ok: true }
}

// -----------------------------------------------------------------------------
// reopen — admin escape back to draft (for mistakes pre-payout)
// -----------------------------------------------------------------------------
export async function reopenFnfAction(formData: FormData): Promise<{ ok?: true; error?: string }> {
  const session = await verifySession()
  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'Missing id' }
  const admin = createAdminClient()
  const { data: s } = await admin.from('fnf_settlements').select('*').eq('id', id).maybeSingle()
  if (!s) return { error: 'Settlement not found' }
  if (s.status === 'draft') return { error: 'Already in draft.' }
  if (s.status === 'paid') return { error: 'Cannot reopen a paid settlement.' }

  await admin
    .from('fnf_settlements')
    .update({ status: 'draft', computed_at: null, approved_at: null, approved_by: null })
    .eq('id', id)

  // If we had approved, restore employee status (best-effort: revert to on_notice).
  if (s.status === 'approved') {
    await admin
      .from('employees')
      .update({ employment_status: 'on_notice', date_of_exit: null })
      .eq('id', s.employee_id as string)
  }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'fnf.reopen',
    entity_type: 'fnf_settlement',
    entity_id: id,
    summary: `Reopened F&F (was ${s.status})`,
  })

  revalidatePath(`/fnf/${id}`)
  revalidatePath(`/employees/${s.employee_id}`)
  return { ok: true }
}
