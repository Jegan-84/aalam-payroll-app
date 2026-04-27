import { NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/dal'
import { buildPayrollJournalCsv } from '@/lib/reports/journal'
import { csvToBytes } from '@/lib/reports/csv'

export const runtime = 'nodejs'

type PP = Promise<{ cycleId: string }>

export async function GET(_req: Request, { params }: { params: PP }) {
  await verifySession()
  const { cycleId } = await params
  const result = await buildPayrollJournalCsv(cycleId)
  if (!result) return new NextResponse('Cycle has no components or does not exist', { status: 404 })
  return new NextResponse(csvToBytes(result.text), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${result.fileName}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
