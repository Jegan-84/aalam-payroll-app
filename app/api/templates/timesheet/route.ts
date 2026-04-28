import { NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/dal'
import { toCsv, csvToBytes } from '@/lib/reports/csv'

export const runtime = 'nodejs'

const HEADERS = [
  'entry_date',     // YYYY-MM-DD
  'project_code',   // must exist in Projects master
  'activity_code',  // must exist in Activity types master (DEV / BUG / PL / SL …)
  'task',           // free text, optional
  'description',    // optional
  'hours',          // 0.25 step. Required if start_time + end_time aren't both filled.
  'start_time',     // HH:MM (24h, IST). Optional unless using time-range entry.
  'end_time',       // HH:MM (24h, IST). Required when start_time is filled to derive hours.
  'work_mode',      // WFH / WFO. Default WFO.
]

const SAMPLE_ROWS: string[][] = [
  ['2026-04-21', 'ACME', 'DEV',     'Frontend',      'API integration', '4',   '09:00', '13:00', 'WFO'],
  ['2026-04-21', 'ACME', 'MEETING', 'Standup',       '',                '0.5', '13:30', '14:00', 'WFO'],
  ['2026-04-21', 'INTERNAL', 'PL',  '',              'Half-day leave',  '4',   '',      '',      'WFO'],
  ['2026-04-22', 'ACME', 'DEV',     'Frontend',      '',                '8',   '',      '',      'WFH'],
]

export async function GET() {
  await verifySession()
  const csv = toCsv(SAMPLE_ROWS, { headers: HEADERS })
  return new NextResponse(csvToBytes(csv), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="timesheet_template.csv"',
      'Cache-Control': 'private, no-store',
    },
  })
}
