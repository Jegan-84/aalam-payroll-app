// Client-safe constants + shared types for reimbursements.
// Must not import 'server-only' so client components (ESS submit form, HR
// review queue, etc.) can render category labels without pulling the DB layer.

export type ReimbursementStatus = 'pending' | 'approved' | 'rejected' | 'paid'
export type ReimbursementCategory =
  | 'fuel' | 'medical' | 'internet' | 'telephone' | 'travel' | 'books' | 'meals' | 'other'

export const CATEGORY_LABELS: Record<ReimbursementCategory, string> = {
  fuel:      'Fuel / conveyance',
  medical:   'Medical',
  internet:  'Internet / broadband',
  telephone: 'Telephone',
  travel:    'Travel (business)',
  books:     'Books / learning',
  meals:     'Meals',
  other:     'Other',
}
