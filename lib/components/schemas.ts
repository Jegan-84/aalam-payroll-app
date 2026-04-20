import { z } from 'zod'

const n = () =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? 0 : v),
    z.coerce.number().finite().nonnegative(),
  )
const b = () => z.preprocess((v) => v === 'on' || v === true || v === 'true', z.boolean())
const optDate = () =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD').optional(),
  )
const optStr = () =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().optional(),
  )

export const EmployeeComponentSchema = z.object({
  employee_id:      z.string().uuid(),
  code:             z.string().trim().min(1).regex(/^[A-Z0-9_]+$/i, 'Letters, digits, underscore.'),
  name:             z.string().trim().min(1),
  kind:             z.enum(['earning', 'deduction']),
  monthly_amount:   n(),
  prorate:          b(),
  include_in_gross: b(),
  effective_from:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Effective from required.'),
  effective_to:     optDate(),
  is_active:        b(),
  notes:            optStr(),
})
export type EmployeeComponentInput = z.infer<typeof EmployeeComponentSchema>

export type ComponentFormErrors = Partial<Record<keyof EmployeeComponentInput | '_form', string[]>>
export type ComponentFormState = { errors?: ComponentFormErrors; ok?: boolean; id?: string } | undefined

export const AdjustmentSchema = z.object({
  cycle_id:    z.string().uuid(),
  employee_id: z.string().uuid(),
  code:        z.string().trim().min(1).regex(/^[A-Z0-9_]+$/i),
  name:        z.string().trim().min(1),
  kind:        z.enum(['earning', 'deduction']),
  amount:      n(),
  action:      z.enum(['add', 'override', 'skip']),
  notes:       optStr(),
})
export type AdjustmentInput = z.infer<typeof AdjustmentSchema>
