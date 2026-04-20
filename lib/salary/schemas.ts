import { z } from 'zod'

const numStr = () =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.coerce.number().finite().nonnegative(),
  )

export const SalaryStructureSchema = z.object({
  employee_id: z.string().uuid(),
  effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Effective date required (YYYY-MM-DD).'),
  annual_fixed_ctc: numStr().refine((n) => n > 0, 'CTC must be positive.'),
  variable_pay_percent: numStr(),
  medical_insurance_monthly: numStr(),
  internet_annual: numStr(),
  training_annual: numStr(),
  epf_mode: z.enum(['ceiling', 'fixed_max', 'actual']),
  tax_regime_code: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.enum(['NEW', 'OLD']).optional(),
  ),
  template_id: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().uuid().optional(),
  ),
  notes: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().optional(),
  ),
})

export type SalaryStructureInput = z.infer<typeof SalaryStructureSchema>

export type SalaryFormErrors = Partial<
  Record<keyof SalaryStructureInput | '_form', string[]>
>

export type SalaryFormResult = {
  errors?: SalaryFormErrors
  ok?: boolean
  id?: string
}

export type SalaryFormState = SalaryFormResult | undefined
