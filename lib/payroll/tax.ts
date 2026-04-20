/**
 * Income-tax engine — pure, framework-free.
 *
 *   computeAnnualTax({ annualGross, regime, slabs, config, surchargeSlabs })
 *     → { tax, cess, surcharge, rebate, total }
 *
 * Algorithm (applies to both OLD and NEW):
 *   1. taxableIncome = max(0, annualGross - standardDeduction)
 *   2. baseTax       = piecewise over slabs
 *   3. rebate87a     = if taxableIncome ≤ rebate limit → min(baseTax, rebate max)
 *   4. surcharge     = baseTax * (surcharge% for taxableIncome)
 *   5. cess          = (baseTax - rebate + surcharge) * cess%
 *   6. total         = baseTax - rebate + surcharge + cess
 *
 * Note: This is a first-pass implementation focused on correct slab math for
 * FY 2026-27. Chapter VI-A (80C/80D/HRA) deductions under the OLD regime are
 * not modelled here — they'd be fed in as a separate deduction input later.
 */

export type TaxSlab = {
  taxable_income_min: number
  taxable_income_max: number | null
  rate_percent: number
}

export type TaxSurchargeSlab = {
  taxable_income_min: number
  taxable_income_max: number | null
  surcharge_percent: number
}

export type TaxConfig = {
  standard_deduction: number
  rebate_87a_income_limit: number
  rebate_87a_max_amount: number
  cess_percent: number
  surcharge_enabled: boolean
}

const round0 = (n: number): number => Math.round(n)

export function computeBaseTaxFromSlabs(taxableIncome: number, slabs: TaxSlab[]): number {
  const sorted = [...slabs].sort((a, b) => a.taxable_income_min - b.taxable_income_min)
  let tax = 0
  for (const s of sorted) {
    if (taxableIncome <= s.taxable_income_min - 1) break
    const upper = s.taxable_income_max == null ? taxableIncome : Math.min(taxableIncome, s.taxable_income_max)
    const lower = s.taxable_income_min
    const taxableInSlab = Math.max(0, upper - (lower - 1))
    tax += (taxableInSlab * s.rate_percent) / 100
    if (s.taxable_income_max == null || taxableIncome <= s.taxable_income_max) break
  }
  return tax
}

export function computeSurcharge(
  baseTax: number,
  taxableIncome: number,
  surchargeSlabs: TaxSurchargeSlab[],
  enabled: boolean,
): number {
  if (!enabled || baseTax <= 0 || taxableIncome <= 0) return 0
  const sorted = [...surchargeSlabs].sort((a, b) => a.taxable_income_min - b.taxable_income_min)
  let rate = 0
  for (const s of sorted) {
    const upperOk = s.taxable_income_max == null || taxableIncome <= s.taxable_income_max
    if (taxableIncome >= s.taxable_income_min && upperOk) { rate = s.surcharge_percent; break }
    if (taxableIncome > (s.taxable_income_max ?? Infinity)) rate = s.surcharge_percent
  }
  return (baseTax * rate) / 100
}

export function computeAnnualTax(params: {
  annualGross: number
  slabs: TaxSlab[]
  config: TaxConfig
  surchargeSlabs: TaxSurchargeSlab[]
  /**
   * For OLD regime only: total exemptions + Chapter VI-A deductions
   * (HRA, 80C, 80D, 24b, etc.) already capped. Pass 0 for NEW regime.
   */
  totalDeductions?: number
  professionalTax?: number
}) {
  const { annualGross, slabs, config, surchargeSlabs, totalDeductions = 0, professionalTax = 0 } = params
  const taxableIncome = Math.max(
    0,
    annualGross - (config.standard_deduction ?? 0) - totalDeductions - professionalTax,
  )
  const baseTax = computeBaseTaxFromSlabs(taxableIncome, slabs)

  const rebate =
    taxableIncome <= config.rebate_87a_income_limit && config.rebate_87a_max_amount > 0
      ? Math.min(baseTax, config.rebate_87a_max_amount)
      : 0

  const taxAfterRebate = Math.max(0, baseTax - rebate)
  const surcharge = computeSurcharge(
    taxAfterRebate,
    taxableIncome,
    surchargeSlabs,
    config.surcharge_enabled ?? true,
  )
  const cess = ((taxAfterRebate + surcharge) * (config.cess_percent ?? 0)) / 100
  const total = taxAfterRebate + surcharge + cess

  return {
    taxableIncome: round0(taxableIncome),
    baseTax: round0(baseTax),
    rebate: round0(rebate),
    surcharge: round0(surcharge),
    cess: round0(cess),
    total: round0(total),
    monthly: round0(total / 12),
  }
}
