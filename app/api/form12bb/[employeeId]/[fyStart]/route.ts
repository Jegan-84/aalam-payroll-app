import { NextResponse } from 'next/server'
import { verifySession, requireAdminOrOwnEmployee } from '@/lib/auth/dal'
import { buildForm12BBBuffer } from '@/lib/pdf/build-form12bb'

export const runtime = 'nodejs'

type PP = Promise<{ employeeId: string; fyStart: string }>

export async function GET(_req: Request, { params }: { params: PP }) {
  await verifySession()
  const { employeeId, fyStart } = await params
  await requireAdminOrOwnEmployee(employeeId)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fyStart)) return new NextResponse('Invalid fyStart', { status: 400 })

  const result = await buildForm12BBBuffer(employeeId, fyStart)
  if (!result) return new NextResponse('Declaration not found for this FY', { status: 404 })

  return new NextResponse(new Uint8Array(result.buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${result.fileName}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
