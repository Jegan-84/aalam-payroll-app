import { z } from 'zod'

const EMPTY_TO_UNDEF = (v: unknown) =>
  typeof v === 'string' && v.trim() === '' ? undefined : v

const optStr = () => z.preprocess(EMPTY_TO_UNDEF, z.string().trim().optional())
const optDate = () =>
  z.preprocess(
    EMPTY_TO_UNDEF,
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').optional(),
  )

// Indian identity validators (allow blank)
const pan = z
  .preprocess(
    EMPTY_TO_UNDEF,
    z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'PAN must be 10 chars like ABCDE1234F').optional(),
  )
const aadhaar = z
  .preprocess(
    EMPTY_TO_UNDEF,
    z.string().regex(/^\d{12}$/, 'Aadhaar must be 12 digits').optional(),
  )
const ifsc = z
  .preprocess(
    EMPTY_TO_UNDEF,
    z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'IFSC must be like HDFC0ABCDEF').optional(),
  )

export const EmployeeSchema = z
  .object({
    // identity
    employee_code: z.string().trim().min(1, 'Employee code is required.'),
    work_email:    z.preprocess(
      EMPTY_TO_UNDEF,
      z.string().trim().toLowerCase().email('Enter a valid email or leave blank.').optional(),
    ),

    // personal
    first_name: z.string().trim().min(1, 'First name is required.'),
    middle_name: optStr(),
    last_name:  z.string().trim().min(1, 'Last name is required.'),
    date_of_birth: optDate(),
    gender:        z.preprocess(EMPTY_TO_UNDEF, z.enum(['M', 'F', 'O']).optional()),
    marital_status: z.preprocess(
      EMPTY_TO_UNDEF,
      z.enum(['single', 'married', 'divorced', 'widowed']).optional(),
    ),
    blood_group: optStr(),
    personal_email: z.preprocess(EMPTY_TO_UNDEF, z.string().email('Invalid email').optional()),
    personal_phone: optStr(),
    emergency_contact_name: optStr(),
    emergency_contact_relation: optStr(),
    emergency_contact_phone: optStr(),

    // addresses
    current_address_line1: optStr(),
    current_address_line2: optStr(),
    current_address_city: optStr(),
    current_address_state: optStr(),
    current_address_pincode: optStr(),
    current_address_country: optStr(),

    permanent_same_as_current: z.preprocess(
      (v) => v === 'on' || v === 'true' || v === true,
      z.boolean(),
    ),
    permanent_address_line1: optStr(),
    permanent_address_line2: optStr(),
    permanent_address_city: optStr(),
    permanent_address_state: optStr(),
    permanent_address_pincode: optStr(),
    permanent_address_country: optStr(),

    // statutory ids
    pan_number: pan,
    aadhaar_number: aadhaar,
    uan_number: optStr(),
    esi_number: optStr(),
    passport_number: optStr(),
    biometric_id: optStr(),

    // employment
    company_id:     z.preprocess(EMPTY_TO_UNDEF, z.string().uuid().optional()),
    department_id:  z.preprocess(EMPTY_TO_UNDEF, z.coerce.number().int().positive().optional()),
    designation_id: z.preprocess(EMPTY_TO_UNDEF, z.coerce.number().int().positive().optional()),
    location_id:    z.preprocess(EMPTY_TO_UNDEF, z.coerce.number().int().positive().optional()),
    primary_project_id: z.preprocess(EMPTY_TO_UNDEF, z.coerce.number().int().positive().optional()),
    secondary_project_ids: z.preprocess(
      (v) => {
        if (v == null || v === '') return []
        if (Array.isArray(v)) return v.map(Number).filter((n) => Number.isFinite(n) && n > 0)
        if (typeof v === 'string') {
          return v.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0)
        }
        return []
      },
      z.array(z.number().int().positive()).default([]),
    ),
    reports_to:     z.preprocess(EMPTY_TO_UNDEF, z.string().uuid().optional()),
    employment_type: z.enum(['full_time', 'probation', 'contract', 'intern', 'consultant']),
    date_of_joining: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Joining date is required (YYYY-MM-DD).'),
    date_of_confirmation: optDate(),
    probation_end_date: optDate(),
    employment_status: z.enum(['active', 'on_notice', 'resigned', 'terminated', 'exited', 'on_hold']),
    date_of_exit: optDate(),
    exit_reason: optStr(),

    // bank
    bank_name: optStr(),
    bank_account_number: optStr(),
    bank_ifsc: ifsc,
    bank_account_type: z.preprocess(EMPTY_TO_UNDEF, z.enum(['savings', 'current']).optional()),
    bank_account_holder_name: optStr(),

    // tax
    tax_regime_code: z.enum(['NEW', 'OLD']),

    // lunch — when true, default ₹250/month deduction on the payslip
    lunch_applicable: z.preprocess(
      (v) => v === 'on' || v === 'true' || v === true,
      z.boolean(),
    ),

    // shift — when true, default ₹5,000/month earning (amount editable per employee)
    shift_applicable: z.preprocess(
      (v) => v === 'on' || v === 'true' || v === true,
      z.boolean(),
    ),
    shift_allowance_monthly: z.preprocess(
      (v) => {
        if (v === '' || v == null) return 5000
        const n = Number(v)
        return Number.isFinite(n) ? n : 5000
      },
      z.number().min(0),
    ),
  })
  .refine(
    (v) =>
      v.employment_status !== 'exited' || !!v.date_of_exit,
    { path: ['date_of_exit'], message: 'Exit date required when status is exited.' },
  )

export type EmployeeInput = z.infer<typeof EmployeeSchema>
export type EmployeeFormValues = z.input<typeof EmployeeSchema>

export type EmployeeFormErrors = Partial<Record<keyof EmployeeInput | '_form', string[]>>

export type EmployeeFormResult = {
  errors?: EmployeeFormErrors
  ok?: boolean
  redirectTo?: string
}

export type EmployeeFormState = EmployeeFormResult | undefined
