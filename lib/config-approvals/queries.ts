import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/auth/dal'

export type PendingChangeStatus = 'submitted' | 'approved' | 'rejected'

export type PendingChangeRow = {
  id: string
  target_table: string
  action: string
  target_id: string | null
  payload: unknown
  description: string | null
  status: PendingChangeStatus
  submitted_at: string
  submitted_by: string | null
  submitted_by_email: string | null
  decided_at: string | null
  decided_by: string | null
  decided_by_email: string | null
  decision_note: string | null
}

export async function listPendingConfigChanges(opts: {
  status?: PendingChangeStatus
  limit?: number
} = {}): Promise<PendingChangeRow[]> {
  await verifySession()
  const supabase = await createClient()

  let q = supabase
    .from('config_pending_changes')
    .select(`
      id, target_table, action, target_id, payload, description, status,
      submitted_at, submitted_by, decided_at, decided_by, decision_note,
      submitter:users!config_pending_changes_submitted_by_fkey ( email ),
      decider:users!config_pending_changes_decided_by_fkey ( email )
    `)
    .order('submitted_at', { ascending: false })
    .limit(opts.limit ?? 50)
  if (opts.status) q = q.eq('status', opts.status)

  const { data, error } = await q
  if (error) throw new Error(error.message)

  type EmbedUser = { email: string } | { email: string }[] | null
  const unwrap = (v: EmbedUser): string | null => {
    if (!v) return null
    const u = Array.isArray(v) ? v[0] : v
    return u?.email ?? null
  }

  type Row = Omit<PendingChangeRow, 'submitted_by_email' | 'decided_by_email'> & {
    submitter: EmbedUser
    decider: EmbedUser
  }
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    target_table: r.target_table,
    action: r.action,
    target_id: r.target_id,
    payload: r.payload,
    description: r.description,
    status: r.status,
    submitted_at: r.submitted_at,
    submitted_by: r.submitted_by,
    submitted_by_email: unwrap(r.submitter),
    decided_at: r.decided_at,
    decided_by: r.decided_by,
    decided_by_email: unwrap(r.decider),
    decision_note: r.decision_note,
  }))
}
