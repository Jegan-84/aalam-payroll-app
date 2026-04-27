import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/auth/dal'

export type NotificationRow = {
  id: string
  kind: string
  title: string
  body: string | null
  href: string | null
  severity: 'info' | 'success' | 'warn' | 'error'
  read_at: string | null
  created_at: string
}

export async function listMyNotifications(opts?: {
  limit?: number
  unreadOnly?: boolean
}): Promise<NotificationRow[]> {
  const session = await verifySession()
  const supabase = await createClient()

  let query = supabase
    .from('notifications')
    .select('id, kind, title, body, href, severity, read_at, created_at')
    .eq('user_id', session.userId)
    .order('created_at', { ascending: false })
    .limit(Math.min(100, Math.max(1, opts?.limit ?? 50)))

  if (opts?.unreadOnly) query = query.is('read_at', null)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as NotificationRow[]
}

export async function countMyUnreadNotifications(): Promise<number> {
  const session = await verifySession()
  const supabase = await createClient()
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', session.userId)
    .is('read_at', null)
  if (error) throw new Error(error.message)
  return count ?? 0
}
