import { NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/dal'
import { buildBankPayoutFile, type PayoutFormat } from '@/lib/reports/bank-payout'
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
  if (result.included === 0) {
    return new NextResponse(
      `No payable rows in this cycle. ${result.excluded} employee(s) had missing bank details or zero net pay.`,
      { status: 404 },
    )
  }

  return new NextResponse(csvToBytes(result.text), {
    status: 200,
    headers: {
      'Content-Type': result.mime,
      'Content-Disposition': `attachment; filename="${result.fileName}"`,
      'X-Payout-Included': String(result.included),
      'X-Payout-Excluded': String(result.excluded),
      'X-Payout-Total': String(result.totalAmount),
      'Cache-Control': 'private, no-store',
    },
  })
}
