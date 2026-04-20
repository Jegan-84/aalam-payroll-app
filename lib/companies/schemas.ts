import { z } from 'zod'

const optStr = () =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().optional(),
  )

const codeStr = () =>
  z
    .string()
    .trim()
    .min(1, 'Code is required')
    .regex(/^[A-Z0-9_-]+$/i, 'Letters, digits, - and _ only')

const pan = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'Invalid PAN format').optional(),
)
const tan = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.string().regex(/^[A-Z]{4}[0-9]{5}[A-Z]$/, 'Invalid TAN format').optional(),
)

export const CompanySchema = z.object({
  id: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().uuid().optional(),
  ),
  code: codeStr(),
  legal_name: z.string().trim().min(1, 'Legal name is required'),
  display_name: z.string().trim().min(1, 'Display name is required'),

  pan,
  tan,
  gstin: optStr(),
  cin: optStr(),
  epf_establishment_id: optStr(),
  esi_establishment_id: optStr(),
  pt_registration_no: optStr(),

  address_line1: optStr(),
  address_line2: optStr(),
  city: optStr(),
  state: optStr(),
  pincode: optStr(),
  country: optStr(),

  logo_url: optStr(),

  is_active: z.preprocess((v) => v === 'on' || v === 'true' || v === true, z.boolean()),
  display_order: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.coerce.number().int().default(100),
  ),
})

export type CompanyInput = z.infer<typeof CompanySchema>

export type CompanyFormErrors = Partial<Record<keyof CompanyInput | '_form', string[]>>
export type CompanyFormState = { errors?: CompanyFormErrors; ok?: boolean; id?: string } | undefined
