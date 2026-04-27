import { NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/dal'
import { toCsv, csvToBytes } from '@/lib/reports/csv'

export const runtime = 'nodejs'

const HEADERS = [
  'employee_code',      // must exist
  'leave_type_code',    // CL / SL / EL / LOP
  'from_date',          // YYYY-MM-DD
  'to_date',            // YYYY-MM-DD
  'reason',             // optional
]

const SAMPLE_ROWS: string[][] = [
  ['AAL001', 'PL', '2026-05-04', '2026-05-05', 'Family function'],
  ['AAL002', 'SL', '2026-05-12', '2026-05-12', 'Fever'],
  ['AAL003', 'EL', '2026-06-15', '2026-06-20', 'Vacation'],
]

export async function GET() {
  await verifySession()
  const csv = toCsv(SAMPLE_ROWS, { headers: HEADERS })
  return new NextResponse(csvToBytes(csv), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="leave_template.csv"',
      'Cache-Control': 'private, no-store',
    },
  })
}
