/**
 * Full & Final Settlement engine — pure.
 *
 * Consolidates the exit-month prorated salary, leave encashment, gratuity,
 * notice-pay adjustments and HR-entered manual lines into a single statement,
 * and computes the final TDS as `tax(FY_to_date + taxable F&F) - TDS_already_deducted`.
 *
 * Statutory simplifications for V1:
 *   - PF uses the statutory ceiling (Basic capped at ₹15k, 12% flat).
 *   - ESI applied only if prorated gross ≤ ₹21k.
 *   - Professional Tax is not computed here (final month's regular cycle covers it).
 *   - Gratuity exempt u/s 10(10): ₹20 L. Leave encashment exempt u/s 10(10AA): ₹25 L.
 *   - Notice-pay recovery reduces taxable income; loan/asset deductions do not.
 */

import { computeAnnualTax, type TaxConfig, type TaxSlab, type TaxSurchargeSlab } from '@/lib/payroll/tax'

const r0 = (n: number): number => Math.round(n)
const r2 = (n: number): number => Math.round(n * 100) / 100

// Statutory exempt ceilings
const GRATUITY_EXEMPT_CAP = 2_000_000     // ₹20 L
const LEAVE_ENCASH_EXEMPT_CAP = 2_500_000 // ₹25 L
const EPF_BASIC_CEILING = 15_000
const EPF_EE_PCT = 12
const ESI_GROSS_CEILING = 21_000
const ESI_EE_PCT = 0.75
const CONV_MONTHLY_CAP = 800

export type FnfManualLine = {
  code: string
  name: string
  kind: 'earning' | 'deduction'
  amount: number
}

export type FnfLine = {
  code: string
  name: string
  kind: 'earning' | 'deduction'
  amount: number
  displayOrder: number
}

export type FnfEngineInput = {
  // Service
  dateOfJoining: string        // ISO YYYY-MM-DD
  lastWorkingDay: string       // ISO YYYY-MM-DD
  noticePeriodDays: number
  noticeDaysServed: number

  // Salary (from the employee's active structure at exit)
  monthlyGross: number
  annualGross: number

  // Leave encashment
  encashableDays: number       // unused EL days at exit

  // Tax context (for final TDS reconciliation)
  fyStart: string              // ISO YYYY-MM-DD
  fyGrossBeforeFnf: number     // sum of tds_ledger.gross_earnings for the FY up to exit
  fyTdsBeforeFnf: number       // sum of tds_ledger.tds_deducted for the FY up to exit
  taxRegime: 'NEW' | 'OLD'
  taxSlabs: TaxSlab[]
  taxConfig: TaxConfig | null
  taxSurchargeSlabs: TaxSurchargeSlab[]
  /** OLD regime allowable deductions (80C, HRA exemption, etc.). Ignored for NEW. */
  oldRegimeDeductionsTotal?: number

  /** HR-entered lines (bonus, loan recovery, asset recovery, ex-gratia, ...). */
  manualLines: FnfManualLine[]
}

export type FnfEngineOutput = {
  autoLines: FnfLine[]

  serviceYears: number
  serviceDays: number
  completedYears: number
  gratuityEligible: boolean

  finalMonthEarnings: number
  leaveEncashmentDays: number
  leaveEncashmentAmount: number
  gratuityAmount: number
  noticePayRecovery: number
  noticePayPayout: number
  finalTds: number

  totalEarnings: number
  totalDeductions: number
  netPayout: number
}

function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.UTC(
    Number(fromIso.slice(0, 4)),
    Number(fromIso.slice(5, 7)) - 1,
    Number(fromIso.slice(8, 10)),
  )
  const b = Date.UTC(
    Number(toIso.slice(0, 4)),
    Number(toIso.slice(5, 7)) - 1,
    Number(toIso.slice(8, 10)),
  )
  return Math.floor((b - a) / (86400 * 1000))
}

function daysInIsoMonth(iso: string): number {
  const y = Number(iso.slice(0, 4))
  const m = Number(iso.slice(5, 7))
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

export function computeFnf(input: FnfEngineInput): FnfEngineOutput {
  // ---- Service tenure ----
  const serviceDays = Math.max(0, daysBetween(input.dateOfJoining, input.lastWorkingDay))
  const serviceYears = r2(serviceDays / 365.25)
  const completedYears = Math.floor(serviceYears)
  const gratuityEligible = completedYears >= 5

  // ---- Final month prorated earnings ----
  const daysInMonth = daysInIsoMonth(input.lastWorkingDay)
  const dayOfMonth = Number(input.lastWorkingDay.slice(8, 10))
  const proration = dayOfMonth / daysInMonth

  const grossFinal = r0(input.monthlyGross * proration)
  const basicFinal = r0(grossFinal * 0.5)
  const hraFinal = r0(basicFinal * 0.5)
  const convFinal = Math.min(r0(basicFinal * 0.1), r0(CONV_MONTHLY_CAP * proration))
  const otherFinal = grossFinal - basicFinal - hraFinal - convFinal

  // ---- Leave encashment — at last-drawn Basic per-day rate ----
  const monthlyBasicFull = r0(input.monthlyGross * 0.5)
  const perDayBasic = monthlyBasicFull / 30
  const encDays = Math.max(0, input.encashableDays)
  const leaveEncashmentAmount = r0(encDays * perDayBasic)

  // ---- Gratuity — only if >= 5 completed years ----
  const gratuityAmount = gratuityEligible
    ? r0((15 / 26) * monthlyBasicFull * completedYears)
    : 0

  // ---- Notice pay ----
  const shortfall = Math.max(0, input.noticePeriodDays - input.noticeDaysServed)
  const noticePayRecovery = r0(shortfall * perDayBasic)
  const noticePayPayout = 0 // V1: handled as a manual line if needed

  // ---- Standard monthly statutory deductions (prorated gross basis) ----
  const pfEligibleBasic = Math.min(basicFinal, r0(EPF_BASIC_CEILING * proration))
  const pfEe = r0(pfEligibleBasic * (EPF_EE_PCT / 100))
  const esiEe = grossFinal <= ESI_GROSS_CEILING ? r0(grossFinal * (ESI_EE_PCT / 100)) : 0

  // ---- Build auto lines ----
  const autoLines: FnfLine[] = []
  autoLines.push({ code: 'BASIC', name: 'Basic', kind: 'earning', amount: basicFinal, displayOrder: 10 })
  autoLines.push({ code: 'HRA', name: 'HRA', kind: 'earning', amount: hraFinal, displayOrder: 20 })
  if (convFinal > 0) autoLines.push({ code: 'CONV', name: 'Conveyance', kind: 'earning', amount: convFinal, displayOrder: 30 })
  if (otherFinal > 0) autoLines.push({ code: 'OTHERALLOW', name: 'Other Allowance', kind: 'earning', amount: otherFinal, displayOrder: 40 })

  if (leaveEncashmentAmount > 0) {
    autoLines.push({ code: 'LEAVE_ENC', name: `Leave Encashment (${encDays} days)`, kind: 'earning', amount: leaveEncashmentAmount, displayOrder: 50 })
  }
  if (gratuityAmount > 0) {
    autoLines.push({ code: 'GRATUITY', name: `Gratuity (${completedYears} yrs)`, kind: 'earning', amount: gratuityAmount, displayOrder: 60 })
  }

  if (pfEe > 0) autoLines.push({ code: 'PF_EE', name: 'PF (Employee)', kind: 'deduction', amount: pfEe, displayOrder: 110 })
  if (esiEe > 0) autoLines.push({ code: 'ESI_EE', name: 'ESI (Employee)', kind: 'deduction', amount: esiEe, displayOrder: 120 })
  if (noticePayRecovery > 0) {
    autoLines.push({ code: 'NOTICE_RECOVERY', name: `Notice Pay Recovery (${shortfall} days)`, kind: 'deduction', amount: noticePayRecovery, displayOrder: 130 })
  }

  // ---- TDS — only if we have a tax config ----
  const gratuityExempt = Math.min(gratuityAmount, GRATUITY_EXEMPT_CAP)
  const leaveExempt = Math.min(leaveEncashmentAmount, LEAVE_ENCASH_EXEMPT_CAP)

  const earningsTaxable =
    basicFinal + hraFinal + convFinal + otherFinal +
    (leaveEncashmentAmount - leaveExempt) +
    (gratuityAmount - gratuityExempt) +
    noticePayPayout

  const manualEarningsTaxable = input.manualLines
    .filter((l) => l.kind === 'earning')
    .reduce((s, l) => s + Number(l.amount), 0)

  // Only notice recovery reduces taxable income; loan/asset recoveries are neutral.
  const taxReducingDeductions = noticePayRecovery
  const taxableFnf = Math.max(0, earningsTaxable + manualEarningsTaxable - taxReducingDeductions)

  let finalTds = 0
  if (input.taxConfig) {
    const newFyGross = Math.max(0, input.fyGrossBeforeFnf + taxableFnf)
    const tax = computeAnnualTax({
      annualGross: newFyGross,
      slabs: input.taxSlabs,
      config: input.taxConfig,
      surchargeSlabs: input.taxSurchargeSlabs,
      totalDeductions: input.taxRegime === 'OLD' ? (input.oldRegimeDeductionsTotal ?? 0) : 0,
      professionalTax: 0,
    })
    finalTds = Math.max(0, r0(tax.total - input.fyTdsBeforeFnf))
  }

  if (finalTds > 0) {
    autoLines.push({ code: 'TDS', name: 'TDS (Final)', kind: 'deduction', amount: finalTds, displayOrder: 140 })
  }

  // ---- Totals (auto + manual) ----
  const manualOrdered = input.manualLines.map((m, i) => ({ ...m, displayOrder: 500 + i }))
  const allLines = [...autoLines, ...manualOrdered]
  const totalEarnings = r0(allLines.filter((l) => l.kind === 'earning').reduce((s, l) => s + l.amount, 0))
  const totalDeductions = r0(allLines.filter((l) => l.kind === 'deduction').reduce((s, l) => s + l.amount, 0))
  const netPayout = totalEarnings - totalDeductions

  const finalMonthEarnings = basicFinal + hraFinal + convFinal + otherFinal

  return {
    autoLines,
    serviceYears,
    serviceDays,
    completedYears,
    gratuityEligible,
    finalMonthEarnings,
    leaveEncashmentDays: encDays,
    leaveEncashmentAmount,
    gratuityAmount,
    noticePayRecovery,
    noticePayPayout,
    finalTds,
    totalEarnings,
    totalDeductions,
    netPayout,
  }
}
