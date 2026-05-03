'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/dal'
import { generateApiKey } from '@/lib/api/auth'

const KNOWN_SCOPES = [
  'projects:read',
  'projects:write',
  'activity_types:read',
  'activity_types:write',
  'timesheet:read',
  'timesheet:write',
] as const

const CreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  scopes: z.array(z.enum(KNOWN_SCOPES)).min(1, 'Pick at least one scope'),
})

export type CreateApiKeyResult = {
  ok?: true
  error?: string
  /** Plain secret — shown to the admin ONCE; never stored. */
  secret?: string
  /** First 8 chars of the secret, for matching against the list afterwards. */
  prefix?: string
}

export async function createApiKeyAction(formData: FormData): Promise<CreateApiKeyResult> {
  const session = await requireRole('admin')

  const name = String(formData.get('name') ?? '').trim()
  const scopes = formData.getAll('scopes').map((v) => String(v))

  const parsed = CreateSchema.safeParse({ name, scopes })
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join('; ') }
  }

  const { secret, prefix, hash } = generateApiKey()
  const admin = createAdminClient()
  const { error } = await admin.from('api_keys').insert({
    name: parsed.data.name,
    prefix,
    key_hash: hash,
    scopes: parsed.data.scopes,
    is_active: true,
    created_by: session.userId,
  })
  if (error) return { error: error.message }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'api_key.create',
    entity_type: 'api_key',
    entity_id: prefix,
    summary: `Created API key "${parsed.data.name}" (${prefix}…) with scopes: ${parsed.data.scopes.join(', ')}`,
  })

  revalidatePath('/settings/api-keys')
  return { ok: true, secret, prefix }
}

export async function revokeApiKeyAction(formData: FormData): Promise<{ ok?: true; error?: string }> {
  const session = await requireRole('admin')

  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'Missing id' }

  const admin = createAdminClient()
  const { data: key } = await admin
    .from('api_keys')
    .select('name, prefix, is_active, revoked_at')
    .eq('id', id)
    .maybeSingle()
  if (!key) return { error: 'API key not found' }
  if (!key.is_active || key.revoked_at) return { ok: true }   // already revoked

  const { error } = await admin
    .from('api_keys')
    .update({
      is_active: false,
      revoked_at: new Date().toISOString(),
      revoked_by: session.userId,
    })
    .eq('id', id)
  if (error) return { error: error.message }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'api_key.revoke',
    entity_type: 'api_key',
    entity_id: key.prefix as string,
    summary: `Revoked API key "${key.name}" (${key.prefix}…)`,
  })

  revalidatePath('/settings/api-keys')
  return { ok: true }
}
