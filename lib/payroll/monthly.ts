/**
 * Monthly payroll engine — pure.
 *
 * Given an employee's active salary structure + this month's attendance
 * summary, it produces the final payroll item with every component, honoring:
 *   - proration of earnings (Basic, HRA, Conveyance, Other) by paidDays / daysInMonth
 *   - statutory recomputation from prorated Basic / Gross
 *   - fixed benefits (MedIns, Internet, Training) NOT prorated
 *   - TDS divided over 12 months (not prorated — constant per annum)
 *
 * The pay_components master configures rates & caps; this engine does not
 * invent new formulas — it mirrors Module 3's logic, just with proration.
 */

import { computeAnnualTax, type TaxConfig, type TaxSlab, type TaxSurchargeSlab } from './tax'
import { professionalTaxMonthly } from './engine'
import type { EpfMode, PtSlab, StatutoryConfig } from './types'
import { computeDeductions, type RawDeclaration } from '@/lib/tax/declarations'
import { evalFormula } from './formula'

const r0 = (n: number): number => Math.round(n)
const r2 = (n: number): number => Math.round(n * 100) / 100

export type ExtraLineInput = {
  code: string
  name: string
  kind: 'earning' | 'deduction'
  amount: number
  prorate: boolean              // scale by paidDays/daysInMonth
  displayOrder?: number
}

export type AdjustmentInput = {
  code: string
  name: string
  kind: 'earning' | 'deduction'
  amount: number
  action: 'add' | 'override' | 'skip'
}

export type MonthlyPayrollInput = {
  daysInMonth: number
  paidDays: number
  lopDays: number
  leaveDays: number

  // structure
  annualFixedCtc: number
  variablePayPercent: number
  annualGross: number
  monthlyGross: number           // full-month (unprorated) gross from structure
  medicalInsuranceMonthly: number
  internetAnnual: number
  trainingAnnual: number
  epfMode: EpfMode

  // tax
  taxRegime: 'NEW' | 'OLD'

  // masters
  statutory: StatutoryConfig
  ptSlabs: PtSlab[]
  ptState: string
  taxSlabs: TaxSlab[]
  taxConfig: TaxConfig
  taxSurchargeSlabs: TaxSurchargeSlab[]

  /** Only consumed for OLD regime. Null/missing → no exemptions applied. */
  declaration?: RawDeclaration | null

  /** Recurring per-employee lines (shift, lunch, etc.) from employee_pay_components. */
  recurringLines?: ExtraLineInput[]

  /** Per-cycle overrides from payroll_item_adjustments. */
  adjustments?: AdjustmentInput[]

  /** When true, deduct the standard LUNCH amount (₹250) unless Skipped for the cycle. */
  lunchApplicable?: boolean

  /**
   * When true, credit a SHIFT earning of `shiftAllowanceMonthly` (prorated by
   * paid days / days in month, same as BASIC/HRA). HR can Skip / Override via
   * the Adjustments panel to knock it out for a single cycle.
   */
  shiftApplicable?: boolean
  /** Monthly shift allowance amount (₹). Ignored when `shiftApplicable` is false. */
  shiftAllowanceMonthly?: number

  /**
   * One-off Variable Pay payout for this cycle. When > 0:
   *   - Added as an un-prorated earning line (code 'VP'), boosting gross & net pay.
   *   - Incremental tax on VP is fully collected in this month's TDS (spike, not spread).
   */
  vpThisCycle?: number

  /**
   * Active loan EMIs to deduct this cycle. Each appears as a deduction line
   * (code `LOAN_<12-char hex prefix of loan.id>`). Amount is caller-capped at
   * `min(emi_amount, outstanding_balance)` — the engine does not re-derive it.
   */
  loanEmis?: Array<{ code: string; name: string; amount: number }>

  /**
   * Loan perquisite lines under s.17(2)(viii). Each is a NOTIONAL taxable
   * benefit — shown on the payslip for transparency, included in annualised
   * TDS projection, but NOT in net pay, PF, or ESI base. Caller pre-computes
   *   monthly_perq = outstanding_balance × (sbi_rate / 100) / 12
   * and only passes loans with `outstanding > ₹20,000`.
   */
  loanPerquisites?: Array<{ code: string; name: string; monthlyAmount: number }>

  /**
   * HR-defined custom components (from `pay_components WHERE is_custom AND is_active`).
   * Evaluated by the formula engine after the statutory components, so formulas
   * can reference `basic`, `hra`, `gross`, etc. Applied in `display_order`.
   */
  customComponents?: Array<{
    code: string
    name: string
    kind: 'earning' | 'deduction' | 'employer_retiral' | 'reimbursement'
    calculation_type: 'fixed' | 'percent_of_basic' | 'percent_of_gross' | 'formula'
    percent_value: number | null
    cap_amount: number | null
    formula: string | null
    prorate: boolean
    display_order: number
  }>
}

const LUNCH_DEDUCTION = 250    // org-wide default

export type PayrollLine = {
  code: string
  name: string
  kind: 'earning' | 'deduction' | 'employer_retiral' | 'reimbursement' | 'variable' | 'perquisite'
  amount: number               // monthly amount for this cycle
  displayOrder: number
}

export type MonthlyPayrollOutput = {
  prorationFactor: number
  monthlyGrossProrated: number
  monthlyBasicProrated: number
  totalEarnings: number
  totalDeductions: number
  netPay: number
  employerRetirals: number
  monthlyTds: number
  annualTax: ReturnType<typeof computeAnnualTax>
  components: PayrollLine[]
}

function pfForMode(basicMonthly: number, statutory: StatutoryConfig, mode: EpfMode, isEmployee: boolean): number {
  const pct = (isEmployee ? statutory.epf_employee_percent : statutory.epf_employer_percent) / 100
  if (mode === 'fixed_max') return statutory.epf_max_monthly_contribution
  if (mode === 'actual')    return r0(pct * basicMonthly)
  const eligible = Math.min(basicMonthly, statutory.epf_wage_ceiling)
  return r0(pct * eligible)
}

export function computeMonthlyPayroll(input: MonthlyPayrollInput): MonthlyPayrollOutput {
  const proration = input.daysInMonth > 0 ? input.paidDays / input.daysInMonth : 0

  // CTC-structure percentages come from statutory_config (was hardcoded).
  const basicPct = input.statutory.basic_percent_of_gross / 100
  const hraPct   = input.statutory.hra_percent_of_basic / 100
  const convPct  = input.statutory.conv_percent_of_basic / 100
  const convCap  = input.statutory.conv_monthly_cap

  // Prorated earnings
  const grossProrated = r0(input.monthlyGross * proration)
  const basicProrated = r0(grossProrated * basicPct)
  const hraProrated   = r0(basicProrated * hraPct)
  const convProrated  = Math.min(r0(basicProrated * convPct), r0(convCap * proration))
  const otherProrated = grossProrated - basicProrated - hraProrated - convProrated

  // Employee deductions — from prorated figures
  const pfEe  = pfForMode(basicProrated, input.statutory, input.epfMode, true)
  const esiEe =
    grossProrated <= input.statutory.esi_wage_ceiling
      ? r0(grossProrated * (input.statutory.esi_employee_percent / 100))
      : 0
  const pt = professionalTaxMonthly(grossProrated, input.ptSlabs, input.ptState)

  // TDS: annual tax on full-year projected gross (not prorated), divided by 12.
  // This keeps monthly TDS stable across the FY even if attendance dips one month.
  const annualBasic = input.annualGross * basicPct
  const annualHra = annualBasic * hraPct
  const deductions =
    input.taxRegime === 'OLD'
      ? computeDeductions(input.declaration ?? null, {
          hraReceivedAnnual: annualHra,
          basicAnnual: annualBasic,
        })
      : null
  // Loan perquisite — notional taxable benefit folded into the annualised gross
  // for TDS only. Each line here reflects THIS month's figure (declining balance × rate / 12).
  // Using × 12 is conservative; the real figure declines as EMIs amortise.
  const perqLines = input.loanPerquisites ?? []
  const perquisiteAnnualised = perqLines.reduce((s, p) => s + Math.max(0, Math.round(p.monthlyAmount)) * 12, 0)

  const annualTax = computeAnnualTax({
    annualGross: input.annualGross + perquisiteAnnualised,
    slabs: input.taxSlabs,
    config: input.taxConfig,
    surchargeSlabs: input.taxSurchargeSlabs,
    totalDeductions: deductions?.total ?? 0,
    // Professional tax deduction u/s 16(iii) — use annualized from monthly slab
    professionalTax: input.taxRegime === 'OLD' ? 0 : 0,
  })
  // TDS: baseline monthly TDS + full incremental tax on VP (spiked in this month).
  const vpAmount = Math.max(0, Math.round(input.vpThisCycle ?? 0))
  let tds = annualTax.monthly
  if (vpAmount > 0) {
    const annualTaxWithVp = computeAnnualTax({
      annualGross: input.annualGross + perquisiteAnnualised + vpAmount,
      slabs: input.taxSlabs,
      config: input.taxConfig,
      surchargeSlabs: input.taxSurchargeSlabs,
      totalDeductions: deductions?.total ?? 0,
      professionalTax: input.taxRegime === 'OLD' ? 0 : 0,
    })
    tds = annualTax.monthly + Math.max(0, annualTaxWithVp.total - annualTax.total)
  }

  // Employer retirals
  const pfEr  = pfForMode(basicProrated, input.statutory, input.epfMode, false)
  const esiEr =
    grossProrated <= input.statutory.esi_wage_ceiling
      ? r0(grossProrated * (input.statutory.esi_employer_percent / 100))
      : 0
  const grat = r0(basicProrated * (input.statutory.gratuity_percent / 100))
  // Fixed employer benefits — NOT prorated
  const medIns = r0(input.medicalInsuranceMonthly)
  const internetMonthly = r0(input.internetAnnual / 12)
  const trainingMonthly = r0(input.trainingAnnual / 12)

  const lines: PayrollLine[] = [
    { code: 'BASIC',      name: 'Basic',           kind: 'earning',          amount: basicProrated, displayOrder: 10 },
    { code: 'HRA',        name: 'HRA',             kind: 'earning',          amount: hraProrated,   displayOrder: 20 },
    { code: 'CONV',       name: 'Conveyance',      kind: 'earning',          amount: convProrated,  displayOrder: 30 },
    { code: 'OTHERALLOW', name: 'Other Allowance', kind: 'earning',          amount: otherProrated, displayOrder: 40 },

    // Internet is paid monthly WITH salary (flows into net pay as an earning).
    { code: 'INTERNET',   name: 'Internet Reimbursement', kind: 'earning',   amount: internetMonthly, displayOrder: 50 },
    // Incentive is a standard earning defaulted to ₹0 — HR overrides per cycle in Adjustments.
    { code: 'INCENTIVE',  name: 'Incentive',       kind: 'earning',          amount: 0,             displayOrder: 60 },

    // Shift allowance — per-employee flag + amount on the employee record.
    //   amount = shiftAllowanceMonthly × (paidDays / daysInMonth)
    // HR can Skip or Override via the Adjustments panel for a single cycle.
    ...(input.shiftApplicable && (input.shiftAllowanceMonthly ?? 0) > 0
      ? [{
          code: 'SHIFT',
          name: 'Shift Allowance',
          kind: 'earning' as const,
          amount: r0((input.shiftAllowanceMonthly ?? 0) * proration),
          displayOrder: 65,
        }]
      : []),

    // Variable Pay — once-a-year payout triggered by cycle's include_vp switch.
    ...(vpAmount > 0
      ? [{ code: 'VP', name: 'Variable Pay', kind: 'earning' as const, amount: vpAmount, displayOrder: 70 }]
      : []),

    { code: 'PF_EE',      name: 'PF (Employee)',   kind: 'deduction',        amount: pfEe,  displayOrder: 110 },
    { code: 'ESI_EE',     name: 'ESI (Employee)',  kind: 'deduction',        amount: esiEe, displayOrder: 120 },
    { code: 'PT',         name: 'Professional Tax',kind: 'deduction',        amount: pt,    displayOrder: 130 },
    { code: 'TDS',        name: 'TDS',             kind: 'deduction',        amount: tds,   displayOrder: 140 },

    // Lunch deduction — only for employees marked lunch_applicable. HR can Skip per cycle.
    ...(input.lunchApplicable
      ? [{ code: 'LUNCH', name: 'Lunch Deduction', kind: 'deduction' as const, amount: LUNCH_DEDUCTION, displayOrder: 150 }]
      : []),

    { code: 'PF_ER',      name: 'PF (Employer)',   kind: 'employer_retiral', amount: pfEr,  displayOrder: 210 },
    { code: 'ESI_ER',     name: 'ESI (Employer)',  kind: 'employer_retiral', amount: esiEr, displayOrder: 220 },
    { code: 'GRATUITY',   name: 'Gratuity',        kind: 'employer_retiral', amount: grat,  displayOrder: 230 },
    { code: 'MEDINS',     name: 'Medical Insurance',kind: 'employer_retiral',amount: medIns, displayOrder: 240 },

    // Training is still a reimbursement (claim-based; not part of monthly net pay).
    { code: 'TRAINING',   name: 'Training / Certification', kind: 'reimbursement', amount: trainingMonthly, displayOrder: 320 },
  ]

  // --- Append recurring employee components + one-off add-ons ---
  const adjustments = input.adjustments ?? []
  const recurringOrder = 500
  for (const r of input.recurringLines ?? []) {
    lines.push({
      code: r.code,
      name: r.name,
      kind: r.kind,
      amount: r.prorate ? r0(r.amount * proration) : r0(r.amount),
      displayOrder: r.displayOrder ?? recurringOrder + lines.length,
    })
  }

  // --- Loan EMI deductions (not prorated — fixed amount per loan per cycle) ---
  let loanOrder = 600
  for (const l of input.loanEmis ?? []) {
    if (l.amount <= 0) continue
    lines.push({
      code: l.code,
      name: l.name,
      kind: 'deduction',
      amount: r0(l.amount),
      displayOrder: loanOrder++,
    })
  }

  // --- Loan perquisites (notional, informational — already folded into TDS above) ---
  let perqOrder = 680
  for (const p of perqLines) {
    const amt = Math.max(0, r0(p.monthlyAmount))
    if (amt <= 0) continue
    lines.push({
      code: p.code,
      name: p.name,
      kind: 'perquisite',
      amount: amt,
      displayOrder: perqOrder++,
    })
  }

  // --- HR-defined custom components ---------------------------------------
  // Evaluated against the already-computed statutory values (basic, hra, etc.).
  // Custom rows are applied in display_order. Later custom rows CANNOT see
  // earlier custom rows' output (V1 simplification — avoids ordering hazards).
  if ((input.customComponents ?? []).length > 0) {
    const vars: Record<string, number> = {
      gross: input.monthlyGross,
      grossProrated,
      basic: r0(input.monthlyGross * 0.5),
      basicProrated,
      hra: r0(input.monthlyGross * 0.5 * 0.5),
      hraProrated,
      conv: Math.min(r0(input.monthlyGross * 0.5 * 0.1), 800),
      convProrated,
      paidDays: input.paidDays,
      daysInMonth: input.daysInMonth,
      proration,
      annualCtc: input.annualFixedCtc,
      annualGross: input.annualGross,
    }

    const sortedCustom = [...(input.customComponents ?? [])].sort(
      (a, b) => a.display_order - b.display_order,
    )
    for (const cc of sortedCustom) {
      let raw = 0
      switch (cc.calculation_type) {
        case 'fixed':
          raw = Number(cc.cap_amount ?? 0)
          break
        case 'percent_of_basic':
          raw = (vars.basic * Number(cc.percent_value ?? 0)) / 100
          break
        case 'percent_of_gross':
          raw = (vars.gross * Number(cc.percent_value ?? 0)) / 100
          break
        case 'formula': {
          if (!cc.formula) continue
          const res = evalFormula(cc.formula, vars)
          if (!res.ok) continue   // bad formula — skip silently; UI validates on save
          raw = res.value
          break
        }
      }
      if (cc.prorate) raw = raw * proration
      if (cc.cap_amount != null && cc.calculation_type !== 'fixed' && raw > Number(cc.cap_amount)) {
        raw = Number(cc.cap_amount)
      }
      const amount = r0(raw)
      if (amount <= 0) continue
      lines.push({
        code: cc.code,
        name: cc.name,
        kind: cc.kind,
        amount,
        displayOrder: cc.display_order,
      })
    }
  }

  let addOrder = 700
  for (const a of adjustments) {
    if (a.action !== 'add') continue
    lines.push({
      code: a.code,
      name: a.name,
      kind: a.kind,
      amount: r0(a.amount),
      displayOrder: addOrder++,
    })
  }

  // --- Apply skips + overrides to EVERY line (static or recurring) ---
  const skipCodes = new Set(adjustments.filter((a) => a.action === 'skip').map((a) => a.code))
  const overrideByCode = new Map<string, AdjustmentInput>()
  for (const a of adjustments) if (a.action === 'override') overrideByCode.set(a.code, a)
  for (let i = lines.length - 1; i >= 0; i--) {
    if (skipCodes.has(lines[i].code)) { lines.splice(i, 1); continue }
    const ov = overrideByCode.get(lines[i].code)
    if (ov) lines[i] = { ...lines[i], amount: r0(ov.amount) }
  }

  const totalEarnings = lines.filter((l) => l.kind === 'earning').reduce((s, l) => s + l.amount, 0)
  const totalDeductions = lines.filter((l) => l.kind === 'deduction').reduce((s, l) => s + l.amount, 0)
  const employerRetirals = lines.filter((l) => l.kind === 'employer_retiral').reduce((s, l) => s + l.amount, 0)
  const netPay = totalEarnings - totalDeductions

  return {
    prorationFactor: r2(proration),
    monthlyGrossProrated: grossProrated,
    monthlyBasicProrated: basicProrated,
    totalEarnings: r0(totalEarnings),
    totalDeductions: r0(totalDeductions),
    netPay: r0(netPay),
    employerRetirals: r0(employerRetirals),
    monthlyTds: tds,
    annualTax,
    components: lines,
  }
}
