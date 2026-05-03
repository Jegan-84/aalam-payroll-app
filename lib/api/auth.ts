import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'

// =============================================================================
// API key auth — for /api/v1/* (machine-to-machine).
// =============================================================================
// Header format: `Authorization: Bearer pf_live_<random>` OR `X-API-Key: pf_live_<random>`.
// Keys are stored as SHA-256 hashes; the plain secret is only shown to the
// admin once at creation time.
//
// Scope strings follow `<resource>:<action>` (e.g. `projects:read`,
// `activity_types:write`). Routes call `requireApiScope(request, 'scope')`
// which throws an `ApiAuthError` (mapped to a JSON 401/403 by the route).
// =============================================================================

export type ApiKeyContext = {
  id: string
  name: string
  scopes: string[]
}

export class ApiAuthError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message)
    this.name = 'ApiAuthError'
  }
}

const KEY_PREFIX = 'pf_live_'

/** Generate a fresh API key (plain secret + prefix + hash). */
export function generateApiKey(): { secret: string; prefix: string; hash: string } {
  const random = randomBytes(32).toString('base64url')
  const secret = `${KEY_PREFIX}${random}`
  const prefix = secret.slice(0, 8)
  const hash = sha256Hex(secret)
  return { secret, prefix, hash }
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

function readKeyFromHeaders(req: Request): string | null {
  const auth = req.headers.get('authorization') ?? ''
  if (auth.toLowerCase().startsWith('bearer ')) {
    const token = auth.slice(7).trim()
    if (token) return token
  }
  const xKey = req.headers.get('x-api-key')
  if (xKey && xKey.trim()) return xKey.trim()
  return null
}

/**
 * Verify the bearer / x-api-key from `request`. Throws `ApiAuthError` on
 * failure. Returns context on success and bumps `last_used_at`.
 */
export async function verifyApiKey(request: Request): Promise<ApiKeyContext> {
  const secret = readKeyFromHeaders(request)
  if (!secret) {
    throw new ApiAuthError(401, 'missing_credentials', 'Provide an API key via Authorization: Bearer <key> or X-API-Key.')
  }
  if (!secret.startsWith(KEY_PREFIX)) {
    throw new ApiAuthError(401, 'invalid_credentials', 'Malformed API key.')
  }

  const hash = sha256Hex(secret)
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('api_keys')
    .select('id, name, scopes, is_active, revoked_at')
    .eq('key_hash', hash)
    .maybeSingle()
  if (error) throw new ApiAuthError(500, 'lookup_failed', error.message)
  if (!data) throw new ApiAuthError(401, 'invalid_credentials', 'API key not recognised.')
  if (!data.is_active || data.revoked_at) {
    throw new ApiAuthError(401, 'revoked', 'This API key has been revoked.')
  }

  // Best-effort timestamp bump; ignore errors so a stale Postgres connection
  // doesn't break the request.
  admin
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(() => undefined, () => undefined)

  return {
    id: data.id as string,
    name: data.name as string,
    scopes: (data.scopes as string[] | null) ?? [],
  }
}

/**
 * Verify the API key AND require a specific scope. Use as the first line of
 * any /api/v1 route handler.
 */
export async function requireApiScope(
  request: Request,
  scope: string,
): Promise<ApiKeyContext> {
  const ctx = await verifyApiKey(request)
  if (!ctx.scopes.includes(scope)) {
    throw new ApiAuthError(403, 'insufficient_scope', `This API key is missing the required scope: ${scope}`)
  }
  return ctx
}
