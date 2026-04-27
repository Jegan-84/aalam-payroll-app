import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/dal'
import { toCsv, csvToBytes } from '@/lib/reports/csv'

export const runtime = 'nodejs'

const HEADERS = [
  'financial_year',  // '2026-27'
  'holiday_date',    // YYYY-MM-DD
  'name',
  'type',            // public / restricted / optional
  'project_code',    // optional — leave blank for "all projects"
  'location_code',   // optional — leave blank for "all locations"
]

const SAMPLE_ROWS: string[][] = [
  ['2026-27', '2026-04-14', 'Tamil New Year',   'public',     '',      'CHE'],
  ['2026-27', '2026-08-15', 'Independence Day', 'public',     '',      ''],
  ['2026-27', '2026-10-02', 'Gandhi Jayanti',   'restricted', 'ACME',  ''],
]

export async function GET() {
  await requireRole('admin', 'hr')
  const csv = toCsv(SAMPLE_ROWS, { headers: HEADERS })
  return new NextResponse(csvToBytes(csv), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="holidays_template.csv"',
      'Cache-Control': 'private, no-store',
    },
  })
}
