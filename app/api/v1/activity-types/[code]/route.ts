import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireApiScope } from '@/lib/api/auth'
import { jsonOk, jsonError, errorResponse } from '@/lib/api/responses'

export const runtime = 'nodejs'

// GET /api/v1/activity-types/:code — get one by code (scope: activity_types:read).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    await requireApiScope(request, 'activity_types:read')
    const { code: rawCode } = await params
    const code = decodeURIComponent(rawCode).toUpperCase()
    if (!code) return jsonError(400, 'missing_code', 'Activity code is required.')

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('activity_types')
      .select('id, code, name, is_active, created_at')
      .eq('code', code)
      .maybeSingle()
    if (error) return jsonError(500, 'db_error', error.message)
    if (!data) return jsonError(404, 'not_found', `No activity type with code "${code}".`)

    return jsonOk({
      id: data.id,
      code: data.code,
      name: data.name,
      is_active: data.is_active,
      created_at: data.created_at ?? null,
    })
  } catch (err) {
    return errorResponse(err)
  }
}
