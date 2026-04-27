import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/auth/dal'
import type { ReimbursementStatus, ReimbursementCategory } from './constants'

// Re-export client-safe types/constants so existing `import { X } from './queries'`
// call sites in server components still work without a refactor.
export { CATEGORY_LABELS } from './constants'
export type { ReimbursementStatus, ReimbursementCategory } from './constants'

export type ReimbursementClaimRow = {
  id: string
  employee_id: string
  category: ReimbursementCategory
  sub_category: string | null
  claim_date: string
  amount: number
  file_path: string
  file_name: string
  file_size_bytes: number | null
  mime_type: string | null
  status: ReimbursementStatus
  review_notes: string | null
  submitted_at: string
  reviewed_at: string | null
  paid_in_cycle_id: string | null
  paid_at: string | null
}

export type ReimbursementWithEmployee = ReimbursementClaimRow & {
  employee: { id: string; employee_code: string; full_name_snapshot: string } | null
}

function rowToClaim(r: Record<string, unknown>): ReimbursementClaimRow {
  return {
    id: r.id as string,
    employee_id: r.employee_id as string,
    category: r.category as ReimbursementCategory,
    sub_category: (r.sub_category as string | null) ?? null,
    claim_date: r.claim_date as string,
    amount: Number(r.amount),
    file_path: r.file_path as string,
    file_name: r.file_name as string,
    file_size_bytes: r.file_size_bytes == null ? null : Number(r.file_size_bytes),
    mime_type: (r.mime_type as string | null) ?? null,
    status: r.status as ReimbursementStatus,
    review_notes: (r.review_notes as string | null) ?? null,
    submitted_at: r.submitted_at as string,
    reviewed_at: (r.reviewed_at as string | null) ?? null,
    paid_in_cycle_id: (r.paid_in_cycle_id as string | null) ?? null,
    paid_at: (r.paid_at as string | null) ?? null,
  }
}

export async function listEmployeeReimbursements(employeeId: string): Promise<ReimbursementClaimRow[]> {
  await verifySession()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('reimbursement_claims')
    .select('*')
    .eq('employee_id', employeeId)
    .order('submitted_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => rowToClaim(r as Record<string, unknown>))
}

export async function getReimbursement(id: string): Promise<ReimbursementClaimRow | null> {
  await verifySession()
  const supabase = await createClient()
  const { data } = await supabase.from('reimbursement_claims').select('*').eq('id', id).maybeSingle()
  return data ? rowToClaim(data as Record<string, unknown>) : null
}

export async function listReimbursementQueue(opts?: {
  status?: ReimbursementStatus
  page?: number
  pageSize?: number
}): Promise<{ rows: ReimbursementWithEmployee[]; total: number; page: number; totalPages: number }> {
  await verifySession()
  const supabase = await createClient()

  const pageSize = Math.max(1, Math.min(100, opts?.pageSize ?? 50))
  const page = Math.max(1, opts?.page ?? 1)
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('reimbursement_claims')
    .select(
      `
      *,
      employee:employees!inner ( id, employee_code, full_name_snapshot )
    `,
      { count: 'exact' },
    )
    .order('submitted_at', { ascending: false })
    .range(from, to)

  if (opts?.status) query = query.eq('status', opts.status)

  const { data, count, error } = await query
  if (error) throw new Error(error.message)

  type EmpEmbed = { id: string; employee_code: string; full_name_snapshot: string }
  const rows = (data ?? []).map((r) => {
    const claim = rowToClaim(r as Record<string, unknown>)
    const raw = (r as { employee: EmpEmbed | EmpEmbed[] | null }).employee
    const emp = Array.isArray(raw) ? raw[0] ?? null : raw
    return { ...claim, employee: emp }
  })
  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  return { rows, total, page: Math.min(page, totalPages), totalPages }
}

export async function countPendingReimbursements(): Promise<number> {
  await verifySession()
  const supabase = await createClient()
  const { count, error } = await supabase
    .from('reimbursement_claims')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
  if (error) throw new Error(error.message)
  return count ?? 0
}

