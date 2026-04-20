import { NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/dal'
import { buildForm24QCsv } from '@/lib/reports/form24q'
import { csvToBytes } from '@/lib/reports/csv'

export const runtime = 'nodejs'

type PP = Promise<{ fyStart: string; quarter: string }>

export async function GET(_req: Request, { params }: { params: PP }) {
  await verifySession()
  const { fyStart, quarter } = await params
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fyStart)) return new NextResponse('Bad fy', { status: 400 })
  if (!['Q1', 'Q2', 'Q3', 'Q4'].includes(quarter)) return new NextResponse('Bad quarter', { status: 400 })

  const result = await buildForm24QCsv(fyStart, quarter as 'Q1' | 'Q2' | 'Q3' | 'Q4')
  if (!result) return new NextResponse('No ledger data for quarter', { status: 404 })

  return new NextResponse(csvToBytes(result.text), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${result.fileName}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
