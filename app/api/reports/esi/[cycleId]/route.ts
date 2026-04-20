import { NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/dal'
import { buildEsiCsv } from '@/lib/reports/esi'
import { csvToBytes } from '@/lib/reports/csv'

export const runtime = 'nodejs'

type PP = Promise<{ cycleId: string }>

export async function GET(_req: Request, { params }: { params: PP }) {
  await verifySession()
  const { cycleId } = await params
  const result = await buildEsiCsv(cycleId)
  if (!result) return new NextResponse('Not found', { status: 404 })

  return new NextResponse(csvToBytes(result.text), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${result.fileName}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
