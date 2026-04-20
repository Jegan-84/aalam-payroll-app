import { NextResponse } from 'next/server'
import JSZip from 'jszip'
import { verifySession } from '@/lib/auth/dal'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildPayslipBuffer } from '@/lib/pdf/build-payslip'
import { MONTH_NAMES } from '@/lib/attendance/engine'

export const runtime = 'nodejs'
export const maxDuration = 60

type PP = Promise<{ cycleId: string }>

export async function GET(_req: Request, { params }: { params: PP }) {
  await verifySession()
  const { cycleId } = await params

  const admin = createAdminClient()
  const [{ data: cycle }, { data: items }] = await Promise.all([
    admin.from('payroll_cycles').select('id, year, month').eq('id', cycleId).maybeSingle(),
    admin.from('payroll_items').select('employee_id, employee_code_snapshot').eq('cycle_id', cycleId),
  ])
  if (!cycle) return new NextResponse('Cycle not found', { status: 404 })
  if (!items || items.length === 0) return new NextResponse('No payroll items', { status: 404 })

  const zip = new JSZip()
  const failed: string[] = []

  // Generate payslips serially to keep memory pressure low on small machines.
  for (const i of items) {
    try {
      const result = await buildPayslipBuffer(cycleId, i.employee_id as string)
      if (result) zip.file(result.fileName, result.buffer)
    } catch (err) {
      failed.push(`${i.employee_code_snapshot}: ${(err as Error).message}`)
    }
  }

  if (failed.length > 0) {
    zip.file('_ERRORS.txt', failed.join('\n'))
  }

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })
  const fileName = `Payslips_${MONTH_NAMES[cycle.month as number - 1]}_${cycle.year}.zip`

  return new NextResponse(new Uint8Array(zipBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
