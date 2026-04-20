import { NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/dal'
import { buildPtCsv } from '@/lib/reports/pt'
import { csvToBytes } from '@/lib/reports/csv'

export const runtime = 'nodejs'

type PP = Promise<{ half: string; year: string }>

export async function GET(_req: Request, { params }: { params: PP }) {
  await verifySession()
  const { half, year } = await params
  if (half !== 'H1' && half !== 'H2') return new NextResponse('Bad half', { status: 400 })
  const yr = Number(year)
  if (!Number.isFinite(yr) || yr < 2000 || yr > 2100) return new NextResponse('Bad year', { status: 400 })

  const result = await buildPtCsv(half, yr)
  if (!result) return new NextResponse('No locked cycles in range', { status: 404 })

  return new NextResponse(csvToBytes(result.text), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${result.fileName}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
