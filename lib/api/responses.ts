import { NextResponse } from 'next/server'
import { ApiAuthError } from './auth'

// =============================================================================
// Standard JSON envelope for /api/v1/*
// =============================================================================
//   Success → { data: <payload>, meta?: <pagination> }   (status 200/201)
//   Error   → { error: { code, message } }               (status 4xx/5xx)
// =============================================================================

const COMMON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'private, no-store',
}

export function jsonOk<T>(data: T, init?: { status?: number; meta?: Record<string, unknown> }): NextResponse {
  const body: Record<string, unknown> = { data }
  if (init?.meta) body.meta = init.meta
  return new NextResponse(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: COMMON_HEADERS,
  })
}

export function jsonError(status: number, code: string, message: string): NextResponse {
  return new NextResponse(JSON.stringify({ error: { code, message } }), {
    status,
    headers: COMMON_HEADERS,
  })
}

/** Map an `ApiAuthError` (or any unknown error) to a JSON response. */
export function errorResponse(err: unknown): NextResponse {
  if (err instanceof ApiAuthError) {
    return jsonError(err.status, err.code, err.message)
  }
  const message = err instanceof Error ? err.message : 'Internal server error'
  return jsonError(500, 'internal_error', message)
}
