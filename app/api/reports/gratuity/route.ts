import { NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/dal'
import { buildGratuityCsv } from '@/lib/reports/gratuity'
import { csvToBytes } from '@/lib/reports/csv'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  await verifySession()
  const url = new URL(req.url)
  const asOf = url.searchParams.get('as_of') ?? undefined

  const result = await buildGratuityCsv(asOf ?? undefined)

  return new NextResponse(csvToBytes(result.text), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${result.fileName}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
