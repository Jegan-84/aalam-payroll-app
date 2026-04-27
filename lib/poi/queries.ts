import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/auth/dal'

export type PoiStatus = 'pending' | 'approved' | 'rejected'
export type PoiSection =
  | '80C' | '80D' | '80CCD1B' | '80E' | '80G' | '80TTA'
  | 'HRA' | '24B' | 'LTA' | 'OTHER'

export type PoiDocumentRow = {
  id: string
  declaration_id: string | null
  employee_id: string
  fy_start: string
  section: PoiSection
  sub_category: string | null
  claimed_amount: number
  file_path: string
  file_name: string
  file_size_bytes: number | null
  mime_type: string | null
  status: PoiStatus
  review_notes: string | null
  uploaded_at: string
  reviewed_at: string | null
}

export type PoiWithEmployee = PoiDocumentRow & {
  employee: { id: string; employee_code: string; full_name_snapshot: string } | null
}

function rowToPoi(r: Record<string, unknown>): PoiDocumentRow {
  return {
    id: r.id as string,
    declaration_id: (r.declaration_id as string | null) ?? null,
    employee_id: r.employee_id as string,
    fy_start: r.fy_start as string,
    section: r.section as PoiSection,
    sub_category: (r.sub_category as string | null) ?? null,
    claimed_amount: Number(r.claimed_amount),
    file_path: r.file_path as string,
    file_name: r.file_name as string,
    file_size_bytes: r.file_size_bytes == null ? null : Number(r.file_size_bytes),
    mime_type: (r.mime_type as string | null) ?? null,
    status: r.status as PoiStatus,
    review_notes: (r.review_notes as string | null) ?? null,
    uploaded_at: r.uploaded_at as string,
    reviewed_at: (r.reviewed_at as string | null) ?? null,
  }
}

/** All POI docs for one employee + FY, newest first. */
export async function listEmployeePoi(employeeId: string, fyStart: string): Promise<PoiDocumentRow[]> {
  await verifySession()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('poi_documents')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('fy_start', fyStart)
    .order('uploaded_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => rowToPoi(r as Record<string, unknown>))
}

export async function getPoi(id: string): Promise<PoiDocumentRow | null> {
  await verifySession()
  const supabase = await createClient()
  const { data } = await supabase.from('poi_documents').select('*').eq('id', id).maybeSingle()
  return data ? rowToPoi(data as Record<string, unknown>) : null
}

/** HR review queue — pending docs across all employees. */
export async function listPoiReviewQueue(opts?: {
  fyStart?: string
  status?: PoiStatus
  page?: number
  pageSize?: number
}): Promise<{ rows: PoiWithEmployee[]; total: number; page: number; totalPages: number }> {
  await verifySession()
  const supabase = await createClient()

  const pageSize = Math.max(1, Math.min(100, opts?.pageSize ?? 50))
  const page = Math.max(1, opts?.page ?? 1)
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('poi_documents')
    .select(
      `
      *,
      employee:employees!inner ( id, employee_code, full_name_snapshot )
    `,
      { count: 'exact' },
    )
    .order('uploaded_at', { ascending: false })
    .range(from, to)

  if (opts?.fyStart) query = query.eq('fy_start', opts.fyStart)
  if (opts?.status) query = query.eq('status', opts.status)

  const { data, count, error } = await query
  if (error) throw new Error(error.message)

  type EmpEmbed = { id: string; employee_code: string; full_name_snapshot: string }
  const rows = (data ?? []).map((r) => {
    const poi = rowToPoi(r as Record<string, unknown>)
    const raw = (r as { employee: EmpEmbed | EmpEmbed[] | null }).employee
    const emp = Array.isArray(raw) ? raw[0] ?? null : raw
    return { ...poi, employee: emp }
  })
  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  return { rows, total, page: Math.min(page, totalPages), totalPages }
}

export async function countPendingPoi(): Promise<number> {
  await verifySession()
  const supabase = await createClient()
  const { count, error } = await supabase
    .from('poi_documents')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
  if (error) throw new Error(error.message)
  return count ?? 0
}

export const SECTION_LABELS: Record<PoiSection, string> = {
  '80C':     '80C — PPF / LIC / ELSS / Tuition / Home loan principal',
  '80D':     '80D — Health insurance premium',
  '80CCD1B': '80CCD(1B) — NPS additional',
  '80E':     '80E — Education loan interest',
  '80G':     '80G — Donations',
  '80TTA':   '80TTA — Savings-account interest',
  'HRA':     'HRA — Rent receipts + landlord details',
  '24B':     '24(b) — Home loan interest',
  'LTA':     'LTA — Leave Travel Concession',
  'OTHER':   'Other proof',
}
