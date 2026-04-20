import { NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/dal'
import { toCsv, csvToBytes } from '@/lib/reports/csv'

export const runtime = 'nodejs'

// The fields HR is expected to fill. Additional Employee columns are optional
// and can be filled on the profile later. Keep order stable — we match by header.
const HEADERS = [
  'employee_code',
  'work_email',
  'first_name',
  'middle_name',
  'last_name',
  'gender',                 // M / F / O
  'date_of_birth',          // YYYY-MM-DD
  'personal_email',
  'personal_phone',
  'pan_number',
  'aadhaar_number',
  'uan_number',
  'esi_number',
  'department_code',        // must exist in Departments master
  'designation_code',       // must exist in Designations master
  'location_code',          // optional
  'company_code',           // must exist in Companies master
  'employment_type',        // full_time / contract / intern / consultant
  'date_of_joining',        // YYYY-MM-DD
  'employment_status',      // active / on_notice / ...
  'bank_name',
  'bank_account_number',
  'bank_ifsc',
  'bank_account_type',      // savings / current
  'tax_regime_code',          // NEW / OLD
  'lunch_applicable',         // TRUE / FALSE
  'shift_applicable',         // TRUE / FALSE — when TRUE, credits a monthly shift allowance
  'shift_allowance_monthly',  // ₹/month, default 5000 when blank
]

const SAMPLE_ROWS: string[][] = [
  [
    'AAL002', 'jane.doe@aalam.com', 'Jane', '', 'Doe', 'F', '1995-06-15',
    'jane@example.com', '9876543210', 'ABCDE1234F', '123456789012',
    '101234567890', '', 'ENG', 'SE', 'CHN-HO', 'AALAM',
    'full_time', '2026-04-01', 'active',
    'HDFC Bank', '50100123456789', 'HDFC0000001', 'savings',
    'NEW', 'FALSE', 'FALSE', '5000',
  ],
  [
    'AAL003', 'raj.k@aalam.com', 'Raj', 'Kumar', 'Iyer', 'M', '1990-11-02',
    'raj@example.com', '9123456780', 'XYZAB9876K', '987654321098',
    '', '', 'ENG', 'SSE', '', 'AALAM',
    'full_time', '2026-04-10', 'active',
    'ICICI Bank', '000123456789', 'ICIC0000002', 'savings',
    'OLD', 'TRUE', 'TRUE', '7500',
  ],
]

export async function GET() {
  await verifySession()
  const csv = toCsv(SAMPLE_ROWS, { headers: HEADERS })
  return new NextResponse(csvToBytes(csv), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="employees_template.csv"',
      'Cache-Control': 'private, no-store',
    },
  })
}
