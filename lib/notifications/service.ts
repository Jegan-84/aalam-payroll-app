import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

export type Severity = 'info' | 'success' | 'warn' | 'error'

type AdminClient = ReturnType<typeof createAdminClient>

export type NotificationInput = {
  userId?: string
  /** Alternative to userId — looks up employee.user_id; falls back to users.email = employee.work_email. */
  employeeId?: string
  kind: string
  title: string
  body?: string | null
  href?: string | null
  severity?: Severity
}

async function resolveUserIdForEmployee(admin: AdminClient, employeeId: string): Promise<string | null> {
  const { data: emp } = await admin
    .from('employees')
    .select('user_id, work_email')
    .eq('id', employeeId)
    .maybeSingle()
  if (!emp) return null
  if (emp.user_id) return emp.user_id as string
  if (emp.work_email) {
    const { data: u } = await admin
      .from('users')
      .select('id')
      .eq('email', emp.work_email)
      .maybeSingle()
    if (u?.id) return u.id as string
  }
  return null
}

/**
 * Create a notification for a single user (or employee → user).
 * Silently no-ops when we can't resolve a recipient — we never want a
 * notification failure to block the underlying domain action.
 */
export async function createNotification(input: NotificationInput): Promise<void> {
  const admin = createAdminClient()

  let userId = input.userId ?? null
  if (!userId && input.employeeId) {
    userId = await resolveUserIdForEmployee(admin, input.employeeId)
  }
  if (!userId) return

  await admin.from('notifications').insert({
    user_id: userId,
    kind: input.kind,
    title: input.title,
    body: input.body ?? null,
    href: input.href ?? null,
    severity: input.severity ?? 'info',
  })
}

/** Notify every user that holds any of the given role codes (e.g. ['hr','admin']). */
export async function notifyByRoles(
  roles: string[],
  input: Omit<NotificationInput, 'userId' | 'employeeId'>,
): Promise<number> {
  if (roles.length === 0) return 0
  const admin = createAdminClient()

  const { data: junctions } = await admin
    .from('user_roles')
    .select('user_id, role:roles!inner ( code )')
    .in('role.code', roles)

  type RoleEmbed = { code: string }
  type J = { user_id: string; role: RoleEmbed | RoleEmbed[] | null }
  const userIds = new Set<string>()
  for (const j of (junctions ?? []) as unknown as J[]) {
    const r = Array.isArray(j.role) ? j.role[0] : j.role
    if (r && roles.includes(r.code)) userIds.add(j.user_id)
  }
  if (userIds.size === 0) return 0

  const rows = Array.from(userIds).map((uid) => ({
    user_id: uid,
    kind: input.kind,
    title: input.title,
    body: input.body ?? null,
    href: input.href ?? null,
    severity: input.severity ?? 'info',
  }))
  await admin.from('notifications').insert(rows)
  return rows.length
}

/** Insert many notifications in one batch — for cycle-wide broadcasts. */
export async function bulkNotifyEmployees(
  employeeIds: string[],
  template: Omit<NotificationInput, 'userId' | 'employeeId'>,
): Promise<number> {
  if (employeeIds.length === 0) return 0
  const admin = createAdminClient()

  const { data: emps } = await admin
    .from('employees')
    .select('id, user_id, work_email')
    .in('id', employeeIds)
  if (!emps || emps.length === 0) return 0

  // For employees without user_id yet, look up by work_email.
  const needEmail = emps.filter((e) => !e.user_id).map((e) => e.work_email).filter(Boolean) as string[]
  let emailToUserId = new Map<string, string>()
  if (needEmail.length > 0) {
    const { data: users } = await admin.from('users').select('id, email').in('email', needEmail)
    emailToUserId = new Map((users ?? []).map((u) => [u.email as string, u.id as string]))
  }

  const rows: Array<Record<string, unknown>> = []
  for (const e of emps) {
    const uid = (e.user_id as string | null) ?? (e.work_email ? emailToUserId.get(e.work_email as string) ?? null : null)
    if (!uid) continue
    rows.push({
      user_id: uid,
      kind: template.kind,
      title: template.title,
      body: template.body ?? null,
      href: template.href ?? null,
      severity: template.severity ?? 'info',
    })
  }
  if (rows.length === 0) return 0
  await admin.from('notifications').insert(rows)
  return rows.length
}
