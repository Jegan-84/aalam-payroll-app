import { NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/dal'
import {
  buildBankPayoutFile,
  buildPayoutExceptionsCsv,
  type PayoutFormat,
} from '@/lib/reports/bank-payout'
import { csvToBytes } from '@/lib/reports/csv'

export const runtime = 'nodejs'

const VALID: PayoutFormat[] = ['generic', 'icici', 'hdfc', 'sbi']

type PP = Promise<{ cycleId: string; format: string }>

export async function GET(_req: Request, { params }: { params: PP }) {
  await verifySession()
  const { cycleId, format } = await params
  if (!VALID.includes(format as PayoutFormat)) {
    return new NextResponse('Unsupported format', { status: 400 })
  }

  const result = await buildBankPayoutFile(cycleId, format as PayoutFormat)
  if (!result) return new NextResponse('Cycle not found', { status: 404 })

  const text = buildPayoutExceptionsCsv(result.exceptions)
  const fileName = `Payout_Exceptions_${cycleId.slice(0, 8)}.csv`
  return new NextResponse(csvToBytes(text), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
