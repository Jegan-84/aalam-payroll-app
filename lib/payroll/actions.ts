'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifySession } from '@/lib/auth/dal'
import {
  MONTH_NAMES,
  daysInMonth,
  defaultStatusForDate,
  iterateMonthDates,
  summarizeMonth,
  type AttendanceCell,
} from '@/lib/attendance/engine'
import { bulkNotifyEmployees } from '@/lib/notifications/service'
import { computeMonthlyPayroll } from '@/lib/payroll/monthly'
import { getTaxSlabsForFy } from '@/lib/payroll/queries'
import { getOrgPtState, getPtSlabs, getStatutoryConfig } from '@/lib/salary/queries'
import { getFyContext } from '@/lib/leave/queries'
import { getHolidaysForMonth, getWeeklyOffDays } from '@/lib/attendance/queries'
import { resolveFy } from '@/lib/leave/engine'

type Admin = ReturnType<typeof createAdminClient>

// -----------------------------------------------------------------------------
// open
// -----------------------------------------------------------------------------
export async function openCycleAction(formData: FormData): Promise<{ ok?: true; error?: string; id?: string }> {
  const session = await verifySession()
  const year = Number(formData.get('year') ?? 0)
  const month = Number(formData.get('month') ?? 0)
  if (!year || !month || month < 1 || month > 12) return { error: 'Invalid year/month' }

  const admin = createAdminClient()
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const end = `${year}-${String(month).padStart(2, '0')}-${daysInMonth(year, month)}`

  const { data, error } = await admin
    .from('payroll_cycles')
    .upsert(
      {
        year,
        month,
        cycle_start: start,
        cycle_end: end,
        status: 'draft',
        opened_by: session.userId,
      },
      { onConflict: 'year,month', ignoreDuplicates: true },
    )
    .select('id')

  if (error) return { error: error.message }

  let cycleId: string | undefined = data?.[0]?.id
  if (!cycleId) {
    const { data: existing } = await admin
      .from('payroll_cycles')
      .select('id')
      .eq('year', year)
      .eq('month', month)
      .maybeSingle()
    cycleId = existing?.id
  }
  if (!cycleId) return { error: 'Could not resolve cycle id' }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'payroll.cycle.open',
    entity_type: 'payroll_cycle',
    entity_id: cycleId,
    summary: `Opened payroll cycle ${year}-${String(month).padStart(2,'0')}`,
  })

  revalidatePath('/payroll')
  return { ok: true, id: cycleId }
}

// -----------------------------------------------------------------------------
// compute / recompute (bulk)
// -----------------------------------------------------------------------------
export async function computeCycleAction(formData: FormData): Promise<{ ok?: true; error?: string; count?: number; skipped?: string[] }> {
  const session = await verifySession()
  const cycleId = String(formData.get('cycle_id') ?? '')
  if (!cycleId) return { error: 'Missing cycle_id' }

  const admin = createAdminClient()

  // cycle
  const { data: cycle } = await admin.from('payroll_cycles').select('*').eq('id', cycleId).maybeSingle()
  if (!cycle) return { error: 'Cycle not found' }
  if (cycle.status === 'locked' || cycle.status === 'paid') {
    return { error: `Cycle is ${cycle.status}; cannot recompute.` }
  }

  const year = cycle.year as number
  const month = cycle.month as number

  // fetch all context once
  const [statutory, ptState, weeklyOffDays, holidays, fy] = await Promise.all([
    getStatutoryConfig(),
    getOrgPtState(),
    getWeeklyOffDays(),
    getHolidaysForMonth(year, month),
    getFyContext(new Date(Date.UTC(year, month - 1, 15))),
  ])
  const ptSlabs = await getPtSlabs(ptState)
  const [newTax, oldTax] = await Promise.all([
    getTaxSlabsForFy(fy.fyStart, 'NEW'),
    getTaxSlabsForFy(fy.fyStart, 'OLD'),
  ])

  // active employees
  const { data: employees, error: empErr } = await admin
    .from('employees')
    .select(
      `
      id, employee_code, full_name_snapshot, work_email, employment_status,
      date_of_joining, date_of_exit, pan_number, tax_regime_code,
      lunch_applicable, shift_applicable, shift_allowance_monthly,
      company_id,
      bank_name, bank_account_number, bank_ifsc,
      department:departments ( name ), designation:designations ( name ), location:locations ( name ),
      company:companies ( id, legal_name, display_name, pan, tan, gstin, logo_url, address_line1, address_line2, city, state, pincode )
    `,
    )
    .in('employment_status', ['active', 'on_notice'])
  if (empErr) return { error: empErr.message }

  if (!employees || employees.length === 0) {
    return { error: 'No active employees found. Set employment_status to "active" or "on_notice" on at least one employee.' }
  }

  const first = `${year}-${String(month).padStart(2, '0')}-01`
  const last = `${year}-${String(month).padStart(2, '0')}-${daysInMonth(year, month)}`

  // attendance for all active employees in one go
  const { data: attRows } = await admin
    .from('attendance_days')
    .select('employee_id, attendance_date, status, leave_type_id, locked')
    .gte('attendance_date', first)
    .lte('attendance_date', last)
    .in('employee_id', (employees ?? []).map((e) => e.id as string))

  const attByEmp = new Map<string, AttendanceCell[]>()
  for (const r of attRows ?? []) {
    const list = attByEmp.get(r.employee_id as string) ?? []
    list.push({
      attendance_date: r.attendance_date as string,
      status: r.status as AttendanceCell['status'],
      leave_type_id: r.leave_type_id as number | null,
      locked: r.locked as boolean,
    })
    attByEmp.set(r.employee_id as string, list)
  }

  // active salary structures
  const empIds = (employees ?? []).map((e) => e.id as string)
  const { data: structs } = await admin
    .from('salary_structures')
    .select('*')
    .is('effective_to', null)
    .eq('status', 'active')
    .in('employee_id', empIds)

  type StructRow = NonNullable<typeof structs> extends (infer T)[] ? T : never
  const structByEmp = new Map<string, StructRow>()
  for (const s of structs ?? []) structByEmp.set(s.employee_id as string, s as StructRow)

  // wipe existing items for this cycle (only if not approved/locked)
  await admin.from('payroll_items').delete().eq('cycle_id', cycleId).neq('status', 'locked')

  // Pre-fetch approved OLD-regime tax declarations for all employees in this FY.
  const { data: declRows } = await admin
    .from('employee_tax_declarations')
    .select('*')
    .eq('fy_start', fy.fyStart)
    .eq('status', 'approved')
    .in('employee_id', empIds)
  type DeclRow = NonNullable<typeof declRows> extends (infer T)[] ? T : never
  const declByEmp = new Map<string, DeclRow>()
  for (const d of declRows ?? []) declByEmp.set(d.employee_id as string, d as DeclRow)

  // Pre-fetch recurring per-employee components effective in this month.
  const cycleEndIso = `${year}-${String(month).padStart(2, '0')}-${daysInMonth(year, month)}`
  const cycleStartIso = `${year}-${String(month).padStart(2, '0')}-01`
  const { data: recurringRows } = await admin
    .from('employee_pay_components')
    .select('employee_id, code, name, kind, monthly_amount, prorate, effective_from, effective_to, is_active')
    .in('employee_id', empIds)
    .eq('is_active', true)
    .lte('effective_from', cycleEndIso)
    .or(`effective_to.is.null,effective_to.gte.${cycleStartIso}`)
  type RecurRow = { employee_id: string; code: string; name: string; kind: 'earning' | 'deduction'; monthly_amount: number; prorate: boolean }
  const recurringByEmp = new Map<string, RecurRow[]>()
  for (const r of (recurringRows ?? []) as unknown as RecurRow[]) {
    const arr = recurringByEmp.get(r.employee_id) ?? []
    arr.push(r)
    recurringByEmp.set(r.employee_id, arr)
  }

  // Pre-fetch per-cycle adjustments.
  const { data: adjRows } = await admin
    .from('payroll_item_adjustments')
    .select('employee_id, code, name, kind, amount, action')
    .eq('cycle_id', cycleId)
  type AdjRow = { employee_id: string; code: string; name: string; kind: 'earning' | 'deduction'; amount: number; action: 'add' | 'override' | 'skip' }
  const adjByEmp = new Map<string, AdjRow[]>()
  for (const a of (adjRows ?? []) as unknown as AdjRow[]) {
    const arr = adjByEmp.get(a.employee_id) ?? []
    arr.push(a)
    adjByEmp.set(a.employee_id, arr)
  }

  // Pre-fetch pending year-end leave encashments — paid as LEAVE_ENC earning line.
  type LeaveEnc = { id: string; amount: number; year: number; days: number }
  const encashmentsByEmp = new Map<string, LeaveEnc>()
  const { data: pendingEnc } = await admin
    .from('leave_encashment_queue')
    .select('id, employee_id, leave_year, pl_days_encashed, encashment_amount')
    .in('employee_id', empIds)
    .eq('status', 'pending')
  for (const e of pendingEnc ?? []) {
    encashmentsByEmp.set(e.employee_id as string, {
      id: e.id as string,
      amount: Number(e.encashment_amount),
      year: Number(e.leave_year),
      days: Number(e.pl_days_encashed),
    })
  }

  // Pre-fetch approved-but-unpaid reimbursement claims — paid in this cycle.
  type ReimbLine = { code: string; name: string; amount: number; id: string }
  const reimbursementsByEmp = new Map<string, ReimbLine[]>()
  const { data: approvedClaims } = await admin
    .from('reimbursement_claims')
    .select('id, employee_id, category, sub_category, amount')
    .in('employee_id', empIds)
    .eq('status', 'approved')
  for (const c of approvedClaims ?? []) {
    const shortId = String(c.id).replace(/-/g, '').slice(0, 8).toUpperCase()
    const arr = reimbursementsByEmp.get(c.employee_id as string) ?? []
    arr.push({
      id: c.id as string,
      code: `REIMB_${shortId}`,
      name: `Reimbursement (${c.category}${c.sub_category ? ` · ${c.sub_category}` : ''})`,
      amount: Number(c.amount),
    })
    reimbursementsByEmp.set(c.employee_id as string, arr)
  }

  // Pre-fetch active custom pay components (org-wide formula/fixed rows
  // defined in /settings/components). Applied uniformly to every employee.
  const { data: customRows } = await admin
    .from('pay_components')
    .select('code, name, kind, calculation_type, percent_value, cap_amount, formula, prorate, display_order')
    .eq('is_custom', true)
    .eq('is_active', true)
    .order('display_order')
  type CustomRow = {
    code: string
    name: string
    kind: 'earning' | 'deduction' | 'employer_retiral' | 'reimbursement'
    calculation_type: 'fixed' | 'percent_of_basic' | 'percent_of_gross' | 'formula'
    percent_value: number | null
    cap_amount: number | null
    formula: string | null
    prorate: boolean
    display_order: number
  }
  const customComponents = ((customRows ?? []) as unknown as CustomRow[]).map((r) => ({
    ...r,
    percent_value: r.percent_value == null ? null : Number(r.percent_value),
    cap_amount: r.cap_amount == null ? null : Number(r.cap_amount),
    display_order: Number(r.display_order),
  }))

  // Pre-fetch VP allocations (only applied when cycle.include_vp is true).
  const vpByEmp = new Map<string, number>()
  if (cycle.include_vp) {
    const { data: vpRows } = await admin
      .from('payroll_cycle_vp_allocations')
      .select('employee_id, vp_amount')
      .eq('cycle_id', cycleId)
    for (const r of vpRows ?? []) {
      vpByEmp.set(r.employee_id as string, Number(r.vp_amount))
    }
  }

  // Pre-fetch active loans whose start (year, month) has arrived by this cycle.
  // Deduction = min(emi, outstanding_balance). Code = LOAN_<first 12 hex chars of id>.
  // Perquisite = outstanding × (sbi_rate − actual_rate)/100/12 when outstanding > ₹20,000 (s.17(2)(viii)).
  type LoanEmi = { code: string; name: string; amount: number }
  type LoanPerq = { code: string; name: string; monthlyAmount: number }
  const loanEmisByEmp = new Map<string, LoanEmi[]>()
  const loanPerqsByEmp = new Map<string, LoanPerq[]>()
  const { data: loans } = await admin
    .from('employee_loans')
    .select('id, employee_id, loan_type, emi_amount, outstanding_balance, interest_rate_percent, start_year, start_month')
    .eq('status', 'active')
    .in('employee_id', empIds)
    .or(
      `start_year.lt.${year},and(start_year.eq.${year},start_month.lte.${month})`,
    )

  const { data: orgRow } = await admin
    .from('organizations')
    .select('sbi_loan_perquisite_rate_percent')
    .limit(1)
    .maybeSingle()
  const sbiRate = Number(orgRow?.sbi_loan_perquisite_rate_percent ?? 9.25)
  const PERQUISITE_EXEMPT_THRESHOLD = 20000

  for (const l of loans ?? []) {
    const outstanding = Number(l.outstanding_balance)
    if (outstanding <= 0) continue
    const amount = Math.min(Number(l.emi_amount), outstanding)
    const id12 = String(l.id).replace(/-/g, '').slice(0, 12).toUpperCase()
    const arr = loanEmisByEmp.get(l.employee_id as string) ?? []
    arr.push({
      code: `LOAN_${id12}`,
      name: `Loan EMI (${l.loan_type})`,
      amount,
    })
    loanEmisByEmp.set(l.employee_id as string, arr)

    // Perquisite: only when outstanding > ₹20k AND there's a concessional rate spread.
    if (outstanding > PERQUISITE_EXEMPT_THRESHOLD) {
      const concessionalRate = Math.max(0, sbiRate - Number(l.interest_rate_percent ?? 0))
      if (concessionalRate > 0) {
        const monthlyPerq = Math.round((outstanding * (concessionalRate / 100)) / 12)
        if (monthlyPerq > 0) {
          const parr = loanPerqsByEmp.get(l.employee_id as string) ?? []
          parr.push({
            code: `PERQ_${id12}`,
            name: `Loan perquisite (${l.loan_type})`,
            monthlyAmount: monthlyPerq,
          })
          loanPerqsByEmp.set(l.employee_id as string, parr)
        }
      }
    }
  }

  type EmpRow = NonNullable<typeof employees>[number]
  type Depish = { name?: string } | { name?: string }[] | null
  const firstName = (v: Depish) => (Array.isArray(v) ? v[0]?.name : v?.name) ?? null

  let employeeCount = 0
  let totalGross = 0
  let totalDeductions = 0
  let totalNet = 0
  let totalEr = 0

  const skipped: string[] = []

  for (const e of (employees ?? []) as EmpRow[]) {
    const structure = structByEmp.get(e.id as string)
    if (!structure) {
      skipped.push(`${e.employee_code} (no salary structure)`)
      continue
    }

    const dates = iterateMonthDates(year, month)
    const stored = attByEmp.get(e.id as string) ?? []
    const storedByDate = new Map(stored.map((c) => [c.attendance_date, c]))
    const virtualCells: AttendanceCell[] = dates.map((iso) => {
      const existing = storedByDate.get(iso)
      if (existing) return existing
      return {
        attendance_date: iso,
        status: defaultStatusForDate(iso, {
          weeklyOffDays,
          holidayDates: holidays,
          joiningDate: e.date_of_joining as string,
          exitDate: (e.date_of_exit as string | null) ?? null,
        }),
      }
    })
    const summary = summarizeMonth(year, month, virtualCells)

    const regime = ((e.tax_regime_code as string | null) ?? 'NEW') as 'NEW' | 'OLD'
    const taxBundle = regime === 'NEW' ? newTax : oldTax
    if (!taxBundle.config) {
      skipped.push(`${e.employee_code} (no tax_config for ${regime} FY ${fy.label})`)
      continue
    }

    const output = computeMonthlyPayroll({
      daysInMonth: summary.daysInMonth,
      paidDays: summary.paidDays,
      lopDays: summary.lopDays,
      leaveDays: summary.paidLeaveDays,

      annualFixedCtc: Number(structure.annual_fixed_ctc),
      variablePayPercent: Number(structure.variable_pay_percent),
      annualGross: Number(structure.annual_gross),
      monthlyGross: Number(structure.monthly_gross),
      medicalInsuranceMonthly: Number(structure.medical_insurance_monthly),
      internetAnnual: Number(structure.internet_annual),
      trainingAnnual: Number(structure.training_annual),
      epfMode: structure.epf_mode as 'ceiling' | 'fixed_max' | 'actual',

      taxRegime: regime,

      statutory,
      ptSlabs,
      ptState,
      taxSlabs: taxBundle.slabs,
      taxConfig: taxBundle.config,
      taxSurchargeSlabs: taxBundle.surchargeSlabs,
      declaration:
        regime === 'OLD'
          ? (declByEmp.get(e.id as string) as unknown as import('@/lib/tax/declarations').RawDeclaration | undefined) ?? null
          : null,
      recurringLines: [
        ...(recurringByEmp.get(e.id as string) ?? []).map((r) => ({
          code: r.code,
          name: r.name,
          kind: r.kind,
          amount: Number(r.monthly_amount),
          prorate: Boolean(r.prorate),
        })),
        // Approved reimbursements ride through recurringLines so HR can still
        // Skip/Override them via the per-cycle Adjustments panel.
        ...(reimbursementsByEmp.get(e.id as string) ?? []).map((r) => ({
          code: r.code,
          name: r.name,
          kind: 'earning' as const,
          amount: r.amount,
          prorate: false,
        })),
        // Year-end leave encashment — flows as a one-off earning.
        ...((() => {
          const enc = encashmentsByEmp.get(e.id as string)
          if (!enc || enc.amount <= 0) return []
          return [{
            code: `LEAVE_ENC_${enc.year}`,
            name: `Leave encashment (${enc.days}d · ${enc.year})`,
            kind: 'earning' as const,
            amount: enc.amount,
            prorate: false,
          }]
        })()),
      ],
      adjustments: (adjByEmp.get(e.id as string) ?? []).map((a) => ({
        code: a.code,
        name: a.name,
        kind: a.kind,
        amount: Number(a.amount),
        action: a.action,
      })),
      lunchApplicable: Boolean(e.lunch_applicable),
      shiftApplicable: Boolean(e.shift_applicable),
      shiftAllowanceMonthly: Number(e.shift_allowance_monthly ?? 0),
      vpThisCycle: vpByEmp.get(e.id as string) ?? 0,
      loanEmis: loanEmisByEmp.get(e.id as string) ?? [],
      loanPerquisites: loanPerqsByEmp.get(e.id as string) ?? [],
      customComponents,
    })

    const { data: item, error: insertErr } = await admin
      .from('payroll_items')
      .insert({
        cycle_id: cycleId,
        employee_id: e.id as string,
        salary_structure_id: structure.id,
        employee_code_snapshot: e.employee_code as string,
        employee_name_snapshot: e.full_name_snapshot as string,
        pan_snapshot: (e.pan_number as string | null) ?? null,
        department_snapshot:  firstName(e.department as Depish),
        designation_snapshot: firstName(e.designation as Depish),
        location_snapshot:    firstName(e.location as Depish),
        bank_name_snapshot:   (e.bank_name as string | null) ?? null,
        bank_account_snapshot:(e.bank_account_number as string | null) ?? null,
        bank_ifsc_snapshot:   (e.bank_ifsc as string | null) ?? null,
        tax_regime_snapshot:  regime,
        ...(function () {
          type CoEmbed = {
            id: string; legal_name: string; display_name: string
            pan: string | null; tan: string | null; gstin: string | null
            logo_url: string | null
            address_line1: string | null; address_line2: string | null
            city: string | null; state: string | null; pincode: string | null
          } | null
          const raw = e.company as CoEmbed | CoEmbed[] | null
          const c = (Array.isArray(raw) ? raw[0] : raw) ?? null
          if (!c) return { company_id: (e.company_id as string | null) ?? null }
          const addressParts = [
            c.address_line1, c.address_line2,
            [c.city, c.state, c.pincode].filter(Boolean).join(' '),
          ].filter(Boolean) as string[]
          return {
            company_id:                     c.id,
            company_legal_name_snapshot:    c.legal_name,
            company_display_name_snapshot:  c.display_name,
            company_address_snapshot:       addressParts.join(', '),
            company_pan_snapshot:           c.pan,
            company_tan_snapshot:           c.tan,
            company_gstin_snapshot:         c.gstin,
            company_logo_snapshot:          c.logo_url,
          }
        })(),
        days_in_month: summary.daysInMonth,
        paid_days: summary.paidDays,
        lop_days: summary.lopDays,
        leave_days: summary.paidLeaveDays,
        proration_factor: output.prorationFactor,
        monthly_gross: output.monthlyGrossProrated,
        total_earnings: output.totalEarnings,
        total_deductions: output.totalDeductions,
        net_pay: output.netPay,
        employer_retirals: output.employerRetirals,
        monthly_tds: output.monthlyTds,
        annual_tax_estimate: output.annualTax.total,
        status: 'draft',
      })
      .select('id')
      .single()

    if (insertErr) {
      skipped.push(`${e.employee_code} (${insertErr.message})`)
      continue
    }

    const compRows = output.components.map((c) => ({
      item_id: item.id,
      code: c.code,
      name: c.name,
      kind: c.kind,
      amount: c.amount,
      display_order: c.displayOrder,
    }))
    await admin.from('payroll_item_components').insert(compRows)

    employeeCount += 1
    totalGross += output.monthlyGrossProrated
    totalDeductions += output.totalDeductions
    totalNet += output.netPay
    totalEr += output.employerRetirals
  }

  // update cycle totals
  await admin
    .from('payroll_cycles')
    .update({
      employee_count: employeeCount,
      total_gross: totalGross,
      total_deductions: totalDeductions,
      total_net_pay: totalNet,
      total_employer_cost: totalGross + totalEr,
      status: 'computed',
      computed_at: new Date().toISOString(),
    })
    .eq('id', cycleId)

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'payroll.cycle.compute',
    entity_type: 'payroll_cycle',
    entity_id: cycleId,
    summary: `Computed payroll for ${employeeCount} employee(s)${skipped.length ? `; skipped ${skipped.length}` : ''}`,
    after_state: { skipped },
  })

  revalidatePath('/payroll')
  revalidatePath(`/payroll/${cycleId}`)
  return { ok: true, count: employeeCount, skipped }
}

// -----------------------------------------------------------------------------
// approve — freeze items + lock attendance cells
// -----------------------------------------------------------------------------
export async function approveCycleAction(formData: FormData): Promise<{ ok?: true; error?: string }> {
  const session = await verifySession()
  const cycleId = String(formData.get('cycle_id') ?? '')
  if (!cycleId) return { error: 'Missing cycle_id' }

  const admin = createAdminClient()
  const { data: cycle } = await admin.from('payroll_cycles').select('*').eq('id', cycleId).maybeSingle()
  if (!cycle) return { error: 'Cycle not found' }
  if (cycle.status !== 'computed') return { error: `Cycle must be 'computed' to approve (is '${cycle.status}').` }

  await admin.from('payroll_items').update({ status: 'approved' }).eq('cycle_id', cycleId)
  await admin
    .from('payroll_cycles')
    .update({ status: 'approved', approved_at: new Date().toISOString(), approved_by: session.userId })
    .eq('id', cycleId)

  await lockAttendanceForCycle(admin, cycle.year as number, cycle.month as number, cycleId)
  await writeTdsLedgerForCycle(admin, cycleId, cycle.year as number, cycle.month as number)
  await writeLoanRepaymentsForCycle(admin, cycleId, cycle.year as number, cycle.month as number)
  await markReimbursementsPaidForCycle(admin, cycleId)
  await markLeaveEncashmentPaidForCycle(admin, cycleId)

  // Notify each employee that their payslip is ready.
  const { data: itemsForNotify } = await admin
    .from('payroll_items')
    .select('employee_id')
    .eq('cycle_id', cycleId)
  const monthLabel = `${MONTH_NAMES[(cycle.month as number) - 1]} ${cycle.year}`
  const empIdsForNotify = (itemsForNotify ?? []).map((i) => i.employee_id as string)
  await bulkNotifyEmployees(empIdsForNotify, {
    kind: 'payslip.published',
    title: `Payslip ready — ${monthLabel}`,
    body: `Your payslip for ${monthLabel} is ready to download.`,
    href: `/me/payslips`,
    severity: 'success',
  })

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'payroll.cycle.approve',
    entity_type: 'payroll_cycle',
    entity_id: cycleId,
    summary: `Approved payroll cycle, locked attendance, wrote TDS + loan ledgers`,
  })

  revalidatePath('/payroll')
  revalidatePath(`/payroll/${cycleId}`)
  revalidatePath('/attendance')
  return { ok: true }
}

// -----------------------------------------------------------------------------
// lock — finalize; from here on, payslips can be generated
// -----------------------------------------------------------------------------
export async function lockCycleAction(formData: FormData): Promise<{ ok?: true; error?: string }> {
  const session = await verifySession()
  const cycleId = String(formData.get('cycle_id') ?? '')
  if (!cycleId) return { error: 'Missing cycle_id' }

  const admin = createAdminClient()
  const { data: cycle } = await admin.from('payroll_cycles').select('*').eq('id', cycleId).maybeSingle()
  if (!cycle) return { error: 'Cycle not found' }
  if (cycle.status !== 'approved') return { error: `Cycle must be 'approved' to lock (is '${cycle.status}').` }

  await admin.from('payroll_items').update({ status: 'locked' }).eq('cycle_id', cycleId)
  await admin
    .from('payroll_cycles')
    .update({ status: 'locked', locked_at: new Date().toISOString(), locked_by: session.userId })
    .eq('id', cycleId)

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'payroll.cycle.lock',
    entity_type: 'payroll_cycle',
    entity_id: cycleId,
    summary: `Locked payroll cycle`,
  })

  revalidatePath('/payroll')
  revalidatePath(`/payroll/${cycleId}`)
  return { ok: true }
}

// -----------------------------------------------------------------------------
// reopen — admin escape hatch (back to 'computed'). Unlocks attendance.
// -----------------------------------------------------------------------------
export async function reopenCycleAction(formData: FormData): Promise<{ ok?: true; error?: string }> {
  const session = await verifySession()
  const cycleId = String(formData.get('cycle_id') ?? '')
  if (!cycleId) return { error: 'Missing cycle_id' }

  const admin = createAdminClient()
  const { data: cycle } = await admin.from('payroll_cycles').select('*').eq('id', cycleId).maybeSingle()
  if (!cycle) return { error: 'Cycle not found' }
  if (cycle.status === 'draft' || cycle.status === 'computed') return { error: 'Cycle is already open.' }
  if (cycle.status === 'paid') return { error: 'Cannot reopen a paid cycle.' }

  await admin.from('payroll_items').update({ status: 'draft' }).eq('cycle_id', cycleId)
  await admin
    .from('payroll_cycles')
    .update({ status: 'computed', approved_at: null, approved_by: null, locked_at: null, locked_by: null })
    .eq('id', cycleId)

  await unlockAttendanceForCycle(admin, cycle.year as number, cycle.month as number)
  await admin.from('tds_ledger').delete().eq('cycle_id', cycleId)
  await reverseLoanRepaymentsForCycle(admin, cycleId)
  await unmarkReimbursementsPaidForCycle(admin, cycleId)
  await unmarkLeaveEncashmentPaidForCycle(admin, cycleId)

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'payroll.cycle.reopen',
    entity_type: 'payroll_cycle',
    entity_id: cycleId,
    summary: `Reopened payroll cycle (was ${cycle.status})`,
  })

  revalidatePath('/payroll')
  revalidatePath(`/payroll/${cycleId}`)
  revalidatePath('/attendance')
  return { ok: true }
}

// --- helpers ---

async function lockAttendanceForCycle(admin: Admin, year: number, month: number, cycleId: string): Promise<void> {
  const first = `${year}-${String(month).padStart(2, '0')}-01`
  const last = `${year}-${String(month).padStart(2, '0')}-${daysInMonth(year, month)}`

  // Ensure a row exists for every (employee in this cycle) × (day in month), then lock.
  const { data: items } = await admin
    .from('payroll_items')
    .select('employee_id')
    .eq('cycle_id', cycleId)
  const empIds = (items ?? []).map((i) => i.employee_id as string)
  if (empIds.length === 0) return

  // Materialize default rows for anything missing (best-effort; we don't know defaults without fetching).
  // Simpler: just lock all existing rows in range. Any un-materialized days stay virtual but never editable
  // post-approval because the parent cycle.status will block writes via attendance action guard.
  await admin
    .from('attendance_days')
    .update({ locked: true })
    .in('employee_id', empIds)
    .gte('attendance_date', first)
    .lte('attendance_date', last)
}

async function writeTdsLedgerForCycle(admin: Admin, cycleId: string, year: number, month: number): Promise<void> {
  const { data: org } = await admin
    .from('organizations')
    .select('financial_year_start_month')
    .limit(1)
    .maybeSingle()
  const fyStartMonth = (org?.financial_year_start_month as number | undefined) ?? 4
  const fy = resolveFy(new Date(Date.UTC(year, month - 1, 15)), fyStartMonth)

  const { data: items } = await admin
    .from('payroll_items')
    .select(
      `
      id, employee_id, employee_code_snapshot, employee_name_snapshot,
      pan_snapshot, tax_regime_snapshot, monthly_tds, annual_tax_estimate,
      total_earnings, total_deductions
    `,
    )
    .eq('cycle_id', cycleId)
  if (!items || items.length === 0) return

  const { data: comps } = await admin
    .from('payroll_item_components')
    .select('code, amount, item:payroll_items!inner ( id, cycle_id )')
    .eq('item.cycle_id', cycleId)
    .in('code', ['BASIC', 'HRA', 'CONV', 'OTHERALLOW', 'PT', 'PF_EE'])

  type CompRow = { code: string; amount: number; item: { id: string } }
  const byItem = new Map<string, Map<string, number>>()
  for (const c of (comps ?? []) as unknown as CompRow[]) {
    const m = byItem.get(c.item.id) ?? new Map<string, number>()
    m.set(c.code, Number(c.amount))
    byItem.set(c.item.id, m)
  }

  const rows = items.map((i) => {
    const cm = byItem.get(i.id as string) ?? new Map<string, number>()
    return {
      employee_id: i.employee_id as string,
      cycle_id: cycleId,
      payroll_item_id: i.id as string,
      fy_start: fy.fyStart,
      fy_end: fy.fyEnd,
      year,
      month,
      employee_code_snapshot: i.employee_code_snapshot as string,
      employee_name_snapshot: i.employee_name_snapshot as string,
      pan_snapshot: (i.pan_snapshot as string | null) ?? null,
      tax_regime_snapshot: (i.tax_regime_snapshot as string) ?? 'NEW',
      gross_earnings:         Number(i.total_earnings),
      basic_month:            cm.get('BASIC') ?? 0,
      hra_month:              cm.get('HRA') ?? 0,
      conveyance_month:       cm.get('CONV') ?? 0,
      other_allowance_month:  cm.get('OTHERALLOW') ?? 0,
      professional_tax_month: cm.get('PT') ?? 0,
      pf_employee_month:      cm.get('PF_EE') ?? 0,
      tds_deducted:           Number(i.monthly_tds),
      annual_gross_estimate:  Number(i.total_earnings) * 12,
      annual_tax_estimate:    Number(i.annual_tax_estimate),
    }
  })

  await admin.from('tds_ledger').upsert(rows, { onConflict: 'employee_id,year,month' })
}

async function unlockAttendanceForCycle(admin: Admin, year: number, month: number): Promise<void> {
  const first = `${year}-${String(month).padStart(2, '0')}-01`
  const last = `${year}-${String(month).padStart(2, '0')}-${daysInMonth(year, month)}`
  await admin
    .from('attendance_days')
    .update({ locked: false })
    .gte('attendance_date', first)
    .lte('attendance_date', last)
}

// -----------------------------------------------------------------------------
// Loan repayments — write a ledger row per LOAN_<prefix> deduction on this
// cycle's payslips and decrement the outstanding balance. Called from approve.
// -----------------------------------------------------------------------------
async function writeLoanRepaymentsForCycle(
  admin: Admin,
  cycleId: string,
  year: number,
  month: number,
): Promise<void> {
  const { data: comps } = await admin
    .from('payroll_item_components')
    .select('code, amount, item:payroll_items!inner ( cycle_id, employee_id )')
    .eq('item.cycle_id', cycleId)
    .like('code', 'LOAN_%')
    .eq('kind', 'deduction')
  type Row = { code: string; amount: number; item: { cycle_id: string; employee_id: string } | { cycle_id: string; employee_id: string }[] }
  const pairs: Array<{ prefix: string; amount: number; employee_id: string }> = []
  for (const c of (comps ?? []) as unknown as Row[]) {
    const item = Array.isArray(c.item) ? c.item[0] : c.item
    const prefix = c.code.slice(5).toLowerCase() // strip 'LOAN_'
    const amt = Math.round(Number(c.amount))
    if (!prefix || amt <= 0) continue
    pairs.push({ prefix, amount: amt, employee_id: item.employee_id })
  }
  if (pairs.length === 0) return

  // Resolve each prefix to a loan id. Fetch loans for the involved employees only.
  const empIds = Array.from(new Set(pairs.map((p) => p.employee_id)))
  const { data: loans } = await admin
    .from('employee_loans')
    .select('id, employee_id, principal, outstanding_balance, status')
    .in('employee_id', empIds)
  const byPrefix = new Map<string, { id: string; employee_id: string; outstanding_balance: number; status: string }>()
  for (const l of loans ?? []) {
    const prefix = String(l.id).replace(/-/g, '').slice(0, 12).toLowerCase()
    byPrefix.set(`${l.employee_id}:${prefix}`, {
      id: l.id as string,
      employee_id: l.employee_id as string,
      outstanding_balance: Number(l.outstanding_balance),
      status: l.status as string,
    })
  }

  for (const p of pairs) {
    const loan = byPrefix.get(`${p.employee_id}:${p.prefix}`)
    if (!loan) continue // orphaned LOAN_ code; ignore

    const newOutstanding = Math.max(0, loan.outstanding_balance - p.amount)
    await admin.from('loan_repayments').upsert(
      {
        loan_id: loan.id,
        cycle_id: cycleId,
        employee_id: loan.employee_id,
        amount_paid: p.amount,
        running_balance: newOutstanding,
        cycle_year: year,
        cycle_month: month,
      },
      { onConflict: 'loan_id,cycle_id' },
    )

    const patch: Record<string, unknown> = {
      outstanding_balance: newOutstanding,
      total_paid: loan.outstanding_balance > 0
        ? (loan.status === 'active' ? loan.outstanding_balance : 0) // best-effort; accurate path below
        : 0,
    }
    // Accurate total_paid from sum of repayments (authoritative):
    const { data: allReps } = await admin
      .from('loan_repayments')
      .select('amount_paid')
      .eq('loan_id', loan.id)
    patch.total_paid = (allReps ?? []).reduce((s, r) => s + Number(r.amount_paid), 0)

    if (newOutstanding <= 0 && loan.status === 'active') {
      patch.status = 'closed'
      patch.closed_at = new Date().toISOString()
    }
    await admin.from('employee_loans').update(patch).eq('id', loan.id)

    // Update the in-memory snapshot so subsequent pairs for the same loan chain correctly.
    loan.outstanding_balance = newOutstanding
    if (newOutstanding <= 0) loan.status = 'closed'
  }
}

// -----------------------------------------------------------------------------
// Reverse loan repayments for a cycle — called from reopen.
// Adds back each repayment amount to outstanding_balance; flips 'closed' loans
// back to 'active' when their balance becomes positive again.
// -----------------------------------------------------------------------------
async function reverseLoanRepaymentsForCycle(admin: Admin, cycleId: string): Promise<void> {
  const { data: reps } = await admin
    .from('loan_repayments')
    .select('id, loan_id, amount_paid')
    .eq('cycle_id', cycleId)
  if (!reps || reps.length === 0) return

  const loanIds = Array.from(new Set(reps.map((r) => r.loan_id as string)))
  const { data: loans } = await admin
    .from('employee_loans')
    .select('id, outstanding_balance, status')
    .in('id', loanIds)
  const loanMap = new Map(
    (loans ?? []).map((l) => [l.id as string, { outstanding: Number(l.outstanding_balance), status: l.status as string }]),
  )

  // Delete first to avoid double-counting if anything errors midway.
  await admin.from('loan_repayments').delete().eq('cycle_id', cycleId)

  for (const loanId of loanIds) {
    const { data: remaining } = await admin
      .from('loan_repayments')
      .select('amount_paid')
      .eq('loan_id', loanId)
    const totalPaid = (remaining ?? []).reduce((s, r) => s + Number(r.amount_paid), 0)

    const loan = loanMap.get(loanId)
    if (!loan) continue
    // Fetch principal to recompute outstanding from scratch (accurate even if there were manual writes).
    const { data: loanFull } = await admin.from('employee_loans').select('principal, status').eq('id', loanId).maybeSingle()
    if (!loanFull) continue
    const principal = Number(loanFull.principal)
    const newOutstanding = Math.max(0, principal - totalPaid)

    const patch: Record<string, unknown> = {
      outstanding_balance: newOutstanding,
      total_paid: totalPaid,
    }
    // If was auto-closed and now has balance, reopen it.
    if (loanFull.status === 'closed' && newOutstanding > 0) {
      patch.status = 'active'
      patch.closed_at = null
    }
    await admin.from('employee_loans').update(patch).eq('id', loanId)
  }
}

// -----------------------------------------------------------------------------
// Reimbursements — mark approved claims as paid when cycle is approved, and
// reverse them back to 'approved' when the cycle is reopened.
// Matches claims by REIMB_<id-prefix> component codes emitted during compute.
// -----------------------------------------------------------------------------
async function markReimbursementsPaidForCycle(admin: Admin, cycleId: string): Promise<void> {
  const { data: comps } = await admin
    .from('payroll_item_components')
    .select('code, item:payroll_items!inner ( cycle_id )')
    .eq('item.cycle_id', cycleId)
    .like('code', 'REIMB_%')
    .eq('kind', 'earning')
  const prefixes = new Set<string>()
  for (const c of comps ?? []) {
    const prefix = String(c.code).slice(6).toLowerCase()
    if (prefix) prefixes.add(prefix)
  }
  if (prefixes.size === 0) return

  const { data: claims } = await admin
    .from('reimbursement_claims')
    .select('id')
    .eq('status', 'approved')
  for (const cl of claims ?? []) {
    const cid = String(cl.id).replace(/-/g, '').slice(0, 8).toLowerCase()
    if (!prefixes.has(cid)) continue
    await admin
      .from('reimbursement_claims')
      .update({
        status: 'paid',
        paid_in_cycle_id: cycleId,
        paid_at: new Date().toISOString(),
      })
      .eq('id', cl.id)
  }
}

async function unmarkReimbursementsPaidForCycle(admin: Admin, cycleId: string): Promise<void> {
  await admin
    .from('reimbursement_claims')
    .update({ status: 'approved', paid_in_cycle_id: null, paid_at: null })
    .eq('paid_in_cycle_id', cycleId)
    .eq('status', 'paid')
}

// -----------------------------------------------------------------------------
// Leave encashment — mark pending rows paid when cycle approves, unmark on reopen.
// Matched by LEAVE_ENC_<year> component codes emitted during compute.
// -----------------------------------------------------------------------------
async function markLeaveEncashmentPaidForCycle(admin: Admin, cycleId: string): Promise<void> {
  const { data: comps } = await admin
    .from('payroll_item_components')
    .select('code, item:payroll_items!inner ( cycle_id, employee_id )')
    .eq('item.cycle_id', cycleId)
    .like('code', 'LEAVE_ENC_%')
    .eq('kind', 'earning')
  type Row = { code: string; item: { cycle_id: string; employee_id: string } | { cycle_id: string; employee_id: string }[] }
  const pairs: Array<{ employee_id: string; leave_year: number }> = []
  for (const c of (comps ?? []) as unknown as Row[]) {
    const item = Array.isArray(c.item) ? c.item[0] : c.item
    const year = Number(String(c.code).slice('LEAVE_ENC_'.length))
    if (!Number.isFinite(year)) continue
    pairs.push({ employee_id: item.employee_id, leave_year: year })
  }
  if (pairs.length === 0) return

  const paidAt = new Date().toISOString()
  for (const p of pairs) {
    await admin
      .from('leave_encashment_queue')
      .update({ status: 'paid', paid_in_cycle_id: cycleId, paid_at: paidAt })
      .eq('employee_id', p.employee_id)
      .eq('leave_year', p.leave_year)
      .eq('status', 'pending')
  }
}

async function unmarkLeaveEncashmentPaidForCycle(admin: Admin, cycleId: string): Promise<void> {
  await admin
    .from('leave_encashment_queue')
    .update({ status: 'pending', paid_in_cycle_id: null, paid_at: null })
    .eq('paid_in_cycle_id', cycleId)
    .eq('status', 'paid')
}
