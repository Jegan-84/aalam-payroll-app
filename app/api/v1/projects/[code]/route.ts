import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireApiScope } from '@/lib/api/auth'
import { jsonOk, jsonError, errorResponse } from '@/lib/api/responses'

export const runtime = 'nodejs'

// GET /api/v1/projects/:code — get one by code (scope: projects:read).
// `code` is matched case-insensitively because we always store upper-cased.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    await requireApiScope(request, 'projects:read')
    const { code: rawCode } = await params
    const code = decodeURIComponent(rawCode).toUpperCase()
    if (!code) return jsonError(400, 'missing_code', 'Project code is required.')

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('projects')
      .select('id, code, name, client, is_active, created_at')
      .eq('code', code)
      .maybeSingle()
    if (error) return jsonError(500, 'db_error', error.message)
    if (!data) return jsonError(404, 'not_found', `No project with code "${code}".`)

    return jsonOk({
      id: data.id,
      code: data.code,
      name: data.name,
      client: data.client ?? null,
      is_active: data.is_active,
      created_at: data.created_at,
    })
  } catch (err) {
    return errorResponse(err)
  }
}
