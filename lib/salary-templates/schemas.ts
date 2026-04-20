import { z } from 'zod'

const numStr = () =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.coerce.number().finite().nonnegative(),
  )

const optStr = () =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().optional(),
  )

export const SalaryTemplateSchema = z.object({
  code: z.string().trim().min(1, 'Code is required (e.g. CONS_A)').regex(/^[A-Z0-9_]+$/i, 'Letters, digits, underscore only.'),
  name: z.string().trim().min(1, 'Name is required'),
  description: optStr(),
  employment_type: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.enum(['full_time', 'contract', 'intern', 'consultant']).optional(),
  ),
  designation_id: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.coerce.number().int().positive().optional(),
  ),
  annual_fixed_ctc: numStr().refine((n) => n > 0, 'CTC must be positive.'),
  variable_pay_percent: numStr(),
  medical_insurance_monthly: numStr(),
  internet_annual: numStr(),
  training_annual: numStr(),
  epf_mode: z.enum(['ceiling', 'fixed_max', 'actual']),
  notes: optStr(),
  is_active: z.preprocess((v) => v === 'on' || v === true || v === 'true', z.boolean()),
  display_order: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.coerce.number().int().default(100),
  ),
})

export type SalaryTemplateInput = z.infer<typeof SalaryTemplateSchema>

export type TemplateFormErrors = Partial<Record<keyof SalaryTemplateInput | '_form', string[]>>
export type TemplateFormResult = { errors?: TemplateFormErrors; ok?: boolean; id?: string }
export type TemplateFormState = TemplateFormResult | undefined
