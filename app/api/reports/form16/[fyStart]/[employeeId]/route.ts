import { NextResponse } from 'next/server'
import { verifySession, requireAdminOrOwnEmployee } from '@/lib/auth/dal'
import { buildForm16Buffer } from '@/lib/pdf/build-form16'

export const runtime = 'nodejs'

type PP = Promise<{ fyStart: string; employeeId: string }>

export async function GET(_req: Request, { params }: { params: PP }) {
  await verifySession()
  const { fyStart, employeeId } = await params
  await requireAdminOrOwnEmployee(employeeId)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fyStart)) return new NextResponse('Bad fy', { status: 400 })

  const result = await buildForm16Buffer(employeeId, fyStart)
  if (!result) return new NextResponse('No ledger entries for this FY', { status: 404 })

  return new NextResponse(new Uint8Array(result.buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${result.fileName}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
