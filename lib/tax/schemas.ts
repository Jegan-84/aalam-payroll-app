import { z } from 'zod'

const n = () =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? 0 : v),
    z.coerce.number().finite().nonnegative(),
  )
const b = () => z.preprocess((v) => v === 'on' || v === true || v === 'true', z.boolean())

export const DeclarationSchema = z.object({
  employee_id: z.string().uuid(),
  fy_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fy_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  regime: z.enum(['NEW', 'OLD']),

  sec_80c_ppf: n(),
  sec_80c_lic: n(),
  sec_80c_elss: n(),
  sec_80c_nsc: n(),
  sec_80c_tuition_fees: n(),
  sec_80c_home_loan_principal: n(),
  sec_80c_epf: n(),
  sec_80c_other: n(),

  sec_80d_self_family: n(),
  sec_80d_parents: n(),
  sec_80d_parents_senior: b(),
  sec_80d_self_senior: b(),

  sec_80ccd_1b_nps: n(),
  sec_80e_education_loan: n(),
  sec_80g_donations: n(),
  sec_80tta_savings_interest: n(),

  home_loan_interest: n(),
  rent_paid_annual: n(),
  metro_city: b(),
  lta_claimed: n(),
})

export type DeclarationInput = z.infer<typeof DeclarationSchema>
export type DeclarationFormErrors = Partial<Record<keyof DeclarationInput | '_form', string[]>>
export type DeclarationFormState = { errors?: DeclarationFormErrors; ok?: boolean } | undefined
