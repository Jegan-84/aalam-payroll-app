import type {
  CalcComponent,
  CalcInput,
  CalcOutput,
  PtSlab,
  StatutoryConfig,
} from './types'

const round2 = (n: number): number => Math.round(n * 100) / 100
const round0 = (n: number): number => Math.round(n)

function pfEmployee(basicMonthly: number, cfg: StatutoryConfig, mode: CalcInput['epfMode']): number {
  switch (mode) {
    case 'fixed_max':
      return cfg.epf_max_monthly_contribution
    case 'actual':
      return round0((cfg.epf_employee_percent / 100) * basicMonthly)
    case 'ceiling':
    default: {
      const eligible = Math.min(basicMonthly, cfg.epf_wage_ceiling)
      return round0((cfg.epf_employee_percent / 100) * eligible)
    }
  }
}

function pfEmployer(basicMonthly: number, cfg: StatutoryConfig, mode: CalcInput['epfMode']): number {
  switch (mode) {
    case 'fixed_max':
      return cfg.epf_max_monthly_contribution
    case 'actual':
      return round0((cfg.epf_employer_percent / 100) * basicMonthly)
    case 'ceiling':
    default: {
      const eligible = Math.min(basicMonthly, cfg.epf_wage_ceiling)
      return round0((cfg.epf_employer_percent / 100) * eligible)
    }
  }
}

// ESI eligibility is always tested against monthly gross (the wage-ceiling
// rule). The contribution amount is then computed as a % of either gross or
// Basic, depending on the period's `esi_basis` setting.
function esiBaseAmount(
  grossMonthly: number,
  basicMonthly: number,
  cfg: StatutoryConfig,
): number {
  return cfg.esi_basis === 'basic' ? basicMonthly : grossMonthly
}

function esiEmployeeMonthly(grossMonthly: number, basicMonthly: number, cfg: StatutoryConfig): number {
  if (grossMonthly > cfg.esi_wage_ceiling) return 0
  return round0((cfg.esi_employee_percent / 100) * esiBaseAmount(grossMonthly, basicMonthly, cfg))
}

function esiEmployerMonthly(grossMonthly: number, basicMonthly: number, cfg: StatutoryConfig): number {
  if (grossMonthly > cfg.esi_wage_ceiling) return 0
  return round0((cfg.esi_employer_percent / 100) * esiBaseAmount(grossMonthly, basicMonthly, cfg))
}

function gratuityMonthly(basicMonthly: number, cfg: StatutoryConfig): number {
  return round0((cfg.gratuity_percent / 100) * basicMonthly)
}

/**
 * TN PT is a half-yearly slab. Monthly deduction = halfYearPt / 6, rounded.
 * For simplicity we pick the slab based on half-year gross = monthlyGross × 6.
 */
export function professionalTaxMonthly(
  monthlyGross: number,
  slabs: PtSlab[],
  ptState: string,
): number {
  const stateSlabs = slabs.filter((s) => s.state_code === ptState)
  if (stateSlabs.length === 0) return 0

  const halfYearGross = monthlyGross * 6
  const match = stateSlabs.find((s) => {
    const maxOk = s.half_year_gross_max == null || halfYearGross <= s.half_year_gross_max
    return halfYearGross >= s.half_year_gross_min && maxOk
  })
  if (!match) return 0
  return round0(match.half_year_pt_amount / 6)
}

/**
 * Solve for annual gross from annual fixed CTC.
 *
 *   CTC_fixed = Gross + EmployerRetirals
 *
 * EmployerRetirals include PF_ER, ESI_ER, Gratuity, Medical Insurance,
 * Internet, Training — some depend on Basic (which is 50% of Gross),
 * creating a circular dependency. Fixed-point iteration converges in 2–3
 * rounds for normal inputs.
 */
function solveGross(input: CalcInput): { annualGross: number; iterations: number; converged: boolean } {
  const { annualFixedCtc, medicalInsuranceMonthly, internetAnnual, trainingAnnual, statutory, epfMode } = input

  const fixedAnnualEmployer = medicalInsuranceMonthly * 12 + internetAnnual + trainingAnnual
  let annualGross = annualFixedCtc - fixedAnnualEmployer    // initial guess

  let converged = false
  let iterations = 0
  const MAX_ITER = 20
  const TOL = 1 // ₹1 tolerance

  for (let i = 0; i < MAX_ITER; i++) {
    iterations = i + 1
    const monthlyGross = annualGross / 12
    const basicMonthly = monthlyGross * (statutory.basic_percent_of_gross / 100)

    const pfEr = pfEmployer(basicMonthly, statutory, epfMode)
    const esiEr = esiEmployerMonthly(monthlyGross, basicMonthly, statutory)
    const grat  = gratuityMonthly(basicMonthly, statutory)

    const monthlyRetirals = pfEr + esiEr + grat + medicalInsuranceMonthly
    const annualRetirals  = monthlyRetirals * 12 + internetAnnual + trainingAnnual

    const newGross = annualFixedCtc - annualRetirals
    if (Math.abs(newGross - annualGross) < TOL) {
      annualGross = newGross
      converged = true
      break
    }
    annualGross = newGross
  }

  return { annualGross, iterations, converged }
}

export function computeSalaryStructure(input: CalcInput): CalcOutput {
  const { annualFixedCtc, variablePayPercent, statutory, ptSlabs, ptState } = input

  const { annualGross, iterations, converged } = solveGross(input)
  const monthlyGross = annualGross / 12

  // CTC-structure percentages (from statutory_config).
  const basicPct = statutory.basic_percent_of_gross / 100
  const hraPct   = statutory.hra_percent_of_basic / 100
  const convPct  = statutory.conv_percent_of_basic / 100
  const convCap  = statutory.conv_monthly_cap

  // Earnings
  const basicMonthly = monthlyGross * basicPct
  const hraMonthly   = basicMonthly * hraPct
  const convMonthly  = Math.min(basicMonthly * convPct, convCap)
  const otherAllowMonthly = monthlyGross - basicMonthly - hraMonthly - convMonthly

  // Employee deductions
  const pfEeMonthly  = pfEmployee(basicMonthly, statutory, input.epfMode)
  const esiEeMonthly = esiEmployeeMonthly(monthlyGross, basicMonthly, statutory)
  const ptMonthly    = professionalTaxMonthly(monthlyGross, ptSlabs, ptState)

  // Employer retirals
  const pfErMonthly  = pfEmployer(basicMonthly, statutory, input.epfMode)
  const esiErMonthly = esiEmployerMonthly(monthlyGross, basicMonthly, statutory)
  const gratMonthly  = gratuityMonthly(basicMonthly, statutory)

  // Variable pay is annual, typically paid separately
  const annualVariablePay = round0((variablePayPercent / 100) * annualGross)

  const monthlyTakeHome = round2(monthlyGross - pfEeMonthly - esiEeMonthly - ptMonthly)
  const annualTotalCtc = round2(annualFixedCtc + annualVariablePay)

  const components: CalcComponent[] = [
    mk('BASIC',       'Basic',                  'earning',          basicMonthly,      10),
    mk('HRA',         'HRA',                    'earning',          hraMonthly,        20),
    mk('CONV',        'Conveyance',             'earning',          convMonthly,       30),
    mk('OTHERALLOW',  'Other Allowance',        'earning',          otherAllowMonthly, 40),

    mk('PF_EE',       'PF (Employee)',          'deduction',        pfEeMonthly,       110),
    mk('ESI_EE',      'ESI (Employee)',         'deduction',        esiEeMonthly,      120),
    mk('PT',          'Professional Tax',       'deduction',        ptMonthly,         130),

    mk('PF_ER',       'PF (Employer)',          'employer_retiral', pfErMonthly,       210),
    mk('ESI_ER',      'ESI (Employer)',         'employer_retiral', esiErMonthly,      220),
    mk('GRATUITY',    'Gratuity',               'employer_retiral', gratMonthly,       230),
    mk('MEDINS',      'Medical Insurance',      'employer_retiral', input.medicalInsuranceMonthly, 240),

    mkAnnual('INTERNET',  'Internet Reimbursement',  'reimbursement', input.internetAnnual, 310),
    mkAnnual('TRAINING',  'Training / Certification','reimbursement', input.trainingAnnual, 320),

    mkAnnual('VP',        'Variable Pay',            'variable',      annualVariablePay,    410),
  ]

  return {
    input,
    annualGross: round2(annualGross),
    monthlyGross: round2(monthlyGross),
    annualFixedCtc: round2(annualFixedCtc),
    annualVariablePay: round2(annualVariablePay),
    annualTotalCtc,
    monthlyTakeHome,
    components,
    diagnostics: {
      iterations,
      converged,
      basicMonthly: round2(basicMonthly),
      pfEmployeeMonthly: pfEeMonthly,
      pfEmployerMonthly: pfErMonthly,
      esiEmployeeMonthly: esiEeMonthly,
      esiEmployerMonthly: esiErMonthly,
      gratuityMonthly: gratMonthly,
      ptMonthly,
      monthlyEmployerRetirals: pfErMonthly + esiErMonthly + gratMonthly + input.medicalInsuranceMonthly,
    },
  }
}

function mk(
  code: string,
  name: string,
  kind: CalcComponent['kind'],
  monthly: number,
  displayOrder: number,
): CalcComponent {
  const m = round0(monthly)
  return { code, name, kind, monthly: m, annual: m * 12, displayOrder }
}

function mkAnnual(
  code: string,
  name: string,
  kind: CalcComponent['kind'],
  annual: number,
  displayOrder: number,
): CalcComponent {
  return { code, name, kind, monthly: round0(annual / 12), annual: round0(annual), displayOrder }
}
