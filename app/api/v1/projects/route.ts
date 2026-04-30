import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireApiScope } from '@/lib/api/auth'
import { jsonOk, jsonError, errorResponse } from '@/lib/api/responses'

export const runtime = 'nodejs'

// =============================================================================
// /api/v1/projects
// =============================================================================
//   GET   ?active=true&limit=50&offset=0   — list (scope: projects:read)
//   POST                                    — create (scope: projects:write)
// =============================================================================

const ProjectShape = (row: Record<string, unknown>) => ({
  id:         row.id,
  code:       row.code,
  name:       row.name,
  client:     row.client ?? null,
  is_active:  row.is_active,
  created_at: row.created_at,
})

// -----------------------------------------------------------------------------
// GET — list projects
// -----------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    await requireApiScope(request, 'projects:read')

    const url = new URL(request.url)
    const activeRaw = url.searchParams.get('active')
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') ?? 100)))
    const offset = Math.max(0, Number(url.searchParams.get('offset') ?? 0))

    const admin = createAdminClient()
    let q = admin
      .from('projects')
      .select('id, code, name, client, is_active, created_at', { count: 'exact' })
      .order('code')
      .range(offset, offset + limit - 1)
    if (activeRaw === 'true')  q = q.eq('is_active', true)
    if (activeRaw === 'false') q = q.eq('is_active', false)

    const { data, count, error } = await q
    if (error) return jsonError(500, 'db_error', error.message)

    return jsonOk(
      (data ?? []).map(ProjectShape),
      { meta: { total: count ?? 0, limit, offset } },
    )
  } catch (err) {
    return errorResponse(err)
  }
}

// -----------------------------------------------------------------------------
// POST — create project
// -----------------------------------------------------------------------------
const CreateSchema = z.object({
  code:      z.string().trim().min(1).regex(/^[A-Z0-9_-]+$/i, 'Letters, digits, - and _ only'),
  name:      z.string().trim().min(1),
  client:    z.string().trim().optional().nullable(),
  is_active: z.boolean().optional(),
})

export async function POST(request: NextRequest) {
  try {
    await requireApiScope(request, 'projects:write')

    let body: unknown
    try { body = await request.json() } catch { return jsonError(400, 'invalid_json', 'Body must be JSON.') }

    const parsed = CreateSchema.safeParse(body)
    if (!parsed.success) {
      return jsonError(400, 'validation_failed', parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '))
    }
    const input = parsed.data
    const code = input.code.toUpperCase()

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('projects')
      .insert({
        code,
        name: input.name,
        client: input.client?.trim() || null,
        is_active: input.is_active ?? true,
      })
      .select('id, code, name, client, is_active, created_at')
      .single()
    if (error) {
      if (error.code === '23505' || /duplicate key value/i.test(error.message)) {
        return jsonError(409, 'duplicate_code', `A project with code "${code}" already exists.`)
      }
      return jsonError(500, 'db_error', error.message)
    }

    return jsonOk(ProjectShape(data as Record<string, unknown>), { status: 201 })
  } catch (err) {
    return errorResponse(err)
  }
}
