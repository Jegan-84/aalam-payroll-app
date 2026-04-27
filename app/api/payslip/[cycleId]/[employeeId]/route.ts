import { NextResponse } from 'next/server'
import { verifySession, requireAdminOrOwnEmployee } from '@/lib/auth/dal'
import { buildPayslipBuffer } from '@/lib/pdf/build-payslip'

export const runtime = 'nodejs'

type PP = Promise<{ cycleId: string; employeeId: string }>

export async function GET(_req: Request, { params }: { params: PP }) {
  await verifySession()
  const { cycleId, employeeId } = await params
  await requireAdminOrOwnEmployee(employeeId)

  const result = await buildPayslipBuffer(cycleId, employeeId)
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
