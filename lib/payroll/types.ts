export type EpfMode = 'ceiling' | 'fixed_max' | 'actual'

export type PtSlab = {
  state_code: string
  half_year_gross_min: number
  half_year_gross_max: number | null
  half_year_pt_amount: number
}

export type StatutoryConfig = {
  epf_employee_percent: number          // 12
  epf_employer_percent: number          // 12
  epf_wage_ceiling: number              // 15000 (monthly Basic ceiling)
  epf_max_monthly_contribution: number  // 1800
  esi_employee_percent: number          // 0.75
  esi_employer_percent: number          // 3.25
  esi_wage_ceiling: number              // 21000 (monthly gross threshold)
  gratuity_percent: number              // 4.81
}

export type CalcInput = {
  annualFixedCtc: number
  variablePayPercent: number
  /** Fixed annual amounts for benefits that count toward CTC. */
  medicalInsuranceMonthly: number
  internetAnnual: number
  trainingAnnual: number
  epfMode: EpfMode
  ptState: string
  statutory: StatutoryConfig
  ptSlabs: PtSlab[]
}

export type CalcComponent = {
  code: string
  name: string
  kind: 'earning' | 'deduction' | 'employer_retiral' | 'reimbursement' | 'variable'
  monthly: number
  annual: number
  displayOrder: number
}

export type CalcOutput = {
  input: CalcInput
  annualGross: number
  monthlyGross: number
  annualFixedCtc: number
  annualVariablePay: number
  annualTotalCtc: number
  monthlyTakeHome: number   // gross - (PF_EE + ESI_EE + PT). TDS excluded.
  components: CalcComponent[]
  diagnostics: {
    iterations: number
    converged: boolean
    basicMonthly: number
    pfEmployeeMonthly: number
    pfEmployerMonthly: number
    esiEmployeeMonthly: number
    esiEmployerMonthly: number
    gratuityMonthly: number
    ptMonthly: number
    monthlyEmployerRetirals: number
  }
}
