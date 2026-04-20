/**
 * Declarations engine — pure. Converts an employee's tax declaration row
 * into capped deduction amounts, and computes HRA exemption from payslip
 * components.
 *
 * Only applicable to OLD regime. NEW regime ignores declarations (except
 * standard deduction) per current rules.
 */

export type RawDeclaration = {
  sec_80c_ppf: number
  sec_80c_lic: number
  sec_80c_elss: number
  sec_80c_nsc: number
  sec_80c_tuition_fees: number
  sec_80c_home_loan_principal: number
  sec_80c_epf: number
  sec_80c_other: number
  sec_80d_self_family: number
  sec_80d_parents: number
  sec_80d_parents_senior: boolean
  sec_80d_self_senior: boolean
  sec_80ccd_1b_nps: number
  sec_80e_education_loan: number
  sec_80g_donations: number
  sec_80tta_savings_interest: number
  home_loan_interest: number
  rent_paid_annual: number
  metro_city: boolean
  lta_claimed: number
}

export type ComputedDeductions = {
  sec80c: number
  sec80d: number
  sec80ccd1b: number
  sec80e: number
  sec80g: number
  sec80tta: number
  homeLoanInterest: number
  hraExemption: number
  ltaExemption: number
  total: number
  breakup: { label: string; amount: number; cap?: number }[]
}

const cap = (n: number, max: number): number => Math.min(Math.max(n, 0), max)

/**
 * HRA exemption = least of:
 *   1. Actual HRA received during the FY
 *   2. Rent paid − 10% of salary (Basic + DA)
 *   3. 50% of salary if metro, else 40%
 *
 * Returns 0 if rent_paid_annual ≤ 0 or hraReceived ≤ 0.
 */
export function computeHraExemption(params: {
  hraReceivedAnnual: number
  basicAnnual: number
  rentPaidAnnual: number
  metroCity: boolean
}): number {
  const { hraReceivedAnnual, basicAnnual, rentPaidAnnual, metroCity } = params
  if (rentPaidAnnual <= 0 || hraReceivedAnnual <= 0) return 0
  const option1 = hraReceivedAnnual
  const option2 = Math.max(0, rentPaidAnnual - 0.1 * basicAnnual)
  const option3 = (metroCity ? 0.5 : 0.4) * basicAnnual
  return Math.round(Math.min(option1, option2, option3))
}

/**
 * Apply statutory caps to an employee's raw declaration.
 * Returns per-section totals + grand total to deduct from taxable income.
 */
export function computeDeductions(
  d: RawDeclaration | null,
  ctx: { hraReceivedAnnual: number; basicAnnual: number },
): ComputedDeductions {
  if (!d) {
    return {
      sec80c: 0, sec80d: 0, sec80ccd1b: 0, sec80e: 0, sec80g: 0, sec80tta: 0,
      homeLoanInterest: 0, hraExemption: 0, ltaExemption: 0, total: 0, breakup: [],
    }
  }

  const rawSec80c =
    (d.sec_80c_ppf || 0) +
    (d.sec_80c_lic || 0) +
    (d.sec_80c_elss || 0) +
    (d.sec_80c_nsc || 0) +
    (d.sec_80c_tuition_fees || 0) +
    (d.sec_80c_home_loan_principal || 0) +
    (d.sec_80c_epf || 0) +
    (d.sec_80c_other || 0)
  const sec80c = cap(rawSec80c, 150000)

  // 80D: self/family cap 25k (50k if self senior); parents 25k (50k if senior)
  const sec80dSelf = cap(d.sec_80d_self_family || 0, d.sec_80d_self_senior ? 50000 : 25000)
  const sec80dParents = cap(d.sec_80d_parents || 0, d.sec_80d_parents_senior ? 50000 : 25000)
  const sec80d = sec80dSelf + sec80dParents

  const sec80ccd1b = cap(d.sec_80ccd_1b_nps || 0, 50000)
  const sec80e = Math.max(0, d.sec_80e_education_loan || 0)
  const sec80g = Math.max(0, d.sec_80g_donations || 0)      // simplified — 50%/100% qualifier not modelled
  const sec80tta = cap(d.sec_80tta_savings_interest || 0, 10000)
  const homeLoanInterest = cap(d.home_loan_interest || 0, 200000)   // sec 24(b)
  const ltaExemption = Math.max(0, d.lta_claimed || 0)

  const hraExemption = computeHraExemption({
    hraReceivedAnnual: ctx.hraReceivedAnnual,
    basicAnnual: ctx.basicAnnual,
    rentPaidAnnual: d.rent_paid_annual || 0,
    metroCity: Boolean(d.metro_city),
  })

  const total = sec80c + sec80d + sec80ccd1b + sec80e + sec80g + sec80tta + homeLoanInterest + hraExemption + ltaExemption

  return {
    sec80c, sec80d, sec80ccd1b, sec80e, sec80g, sec80tta, homeLoanInterest,
    hraExemption, ltaExemption, total,
    breakup: [
      { label: 'Section 80C (capped)', amount: sec80c, cap: 150000 },
      { label: 'Section 80D — self + family',    amount: sec80dSelf },
      { label: 'Section 80D — parents',          amount: sec80dParents },
      { label: 'Section 80CCD(1B) — NPS',        amount: sec80ccd1b, cap: 50000 },
      { label: 'Section 80E — education loan',   amount: sec80e },
      { label: 'Section 80G — donations',        amount: sec80g },
      { label: 'Section 80TTA — savings interest', amount: sec80tta, cap: 10000 },
      { label: 'Section 24(b) — home loan interest', amount: homeLoanInterest, cap: 200000 },
      { label: 'HRA exemption u/s 10(13A)',      amount: hraExemption },
      { label: 'LTA exemption',                  amount: ltaExemption },
    ],
  }
}
