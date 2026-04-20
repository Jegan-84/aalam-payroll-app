import { z } from 'zod'

const optStr = () =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().optional(),
  )

export const ApplyLeaveSchema = z
  .object({
    employee_id: z.string().uuid(),
    leave_type_id: z.coerce.number().int().positive(),
    from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'From date required.'),
    to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'To date required.'),
    reason: optStr(),
  })
  .refine((v) => v.to_date >= v.from_date, { path: ['to_date'], message: 'To date must be after From.' })

export type ApplyLeaveInput = z.infer<typeof ApplyLeaveSchema>

export type LeaveFormErrors = Partial<Record<keyof ApplyLeaveInput | '_form', string[]>>
export type LeaveFormResult = { errors?: LeaveFormErrors; ok?: boolean; id?: string }
export type LeaveFormState = LeaveFormResult | undefined

export const ReviewSchema = z.object({
  id: z.string().uuid(),
  notes: optStr(),
})
