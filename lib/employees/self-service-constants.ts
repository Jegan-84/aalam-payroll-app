// =============================================================================
// Constants + types for the employee self-service module.
// =============================================================================
// Kept in a separate file because `lib/employees/self-service.ts` is a
// `'use server'` module — and a 'use server' module may only export async
// functions. Putting these here keeps that file pure-actions and lets client
// components import the constants directly without pulling server code into
// the bundle.
// =============================================================================

export const STORAGE_BUCKET = 'employee-docs'
export const MAX_FILE_BYTES = 5 * 1024 * 1024  // 5 MB

export const DOC_TYPES = [
  'aadhaar',
  'pan',
  'passport',
  'marksheet_10',
  'marksheet_12',
  'degree',
  'pg_degree',
  'experience_letter',
  'relieving_letter',
  'offer_letter',
  'appointment_letter',
  'bank_proof',
  'other',
] as const
export type DocType = (typeof DOC_TYPES)[number]

export const DOC_TYPE_LABEL: Record<DocType, string> = {
  aadhaar:            'Aadhaar card',
  pan:                'PAN card',
  passport:           'Passport',
  marksheet_10:       '10th marksheet',
  marksheet_12:       '12th marksheet',
  degree:             'Degree certificate',
  pg_degree:          'PG / Master’s degree',
  experience_letter:  'Experience letter',
  relieving_letter:   'Relieving letter',
  offer_letter:       'Offer letter',
  appointment_letter: 'Appointment letter',
  bank_proof:         'Bank proof (cheque / passbook)',
  other:              'Other',
}

export type EmployeeDocumentRow = {
  id: string
  doc_type: DocType
  title: string | null
  storage_path: string
  file_name: string
  mime_type: string | null
  size_bytes: number | null
  uploaded_at: string
  verified_at: string | null
}

export type SelfProfileErrors = Partial<
  Record<
    | 'first_name'
    | 'middle_name'
    | 'last_name'
    | 'date_of_birth'
    | 'gender'
    | 'marital_status'
    | 'blood_group'
    | 'personal_email'
    | 'personal_phone'
    | 'emergency_contact_name'
    | 'emergency_contact_relation'
    | 'emergency_contact_phone'
    | 'current_address_line1'
    | 'current_address_line2'
    | 'current_address_city'
    | 'current_address_state'
    | 'current_address_pincode'
    | 'current_address_country'
    | 'permanent_same_as_current'
    | 'permanent_address_line1'
    | 'permanent_address_line2'
    | 'permanent_address_city'
    | 'permanent_address_state'
    | 'permanent_address_pincode'
    | 'permanent_address_country'
    | 'pan_number'
    | 'aadhaar_number'
    | 'uan_number'
    | 'esi_number'
    | 'passport_number'
    | 'bank_name'
    | 'bank_account_number'
    | 'bank_ifsc'
    | 'bank_account_type'
    | 'bank_account_holder_name'
    | '_form',
    string[]
  >
>

export type SelfProfileState = { errors?: SelfProfileErrors; ok?: boolean } | undefined
