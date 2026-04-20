import { NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/dal'
import { buildFnfBuffer } from '@/lib/pdf/build-fnf'

export const runtime = 'nodejs'

type PP = Promise<{ id: string }>

export async function GET(_req: Request, { params }: { params: PP }) {
  await verifySession()
  const { id } = await params

  const result = await buildFnfBuffer(id)
  if (!result) return new NextResponse('Not found', { status: 404 })

  return new NextResponse(new Uint8Array(result.buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${result.fileName}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
