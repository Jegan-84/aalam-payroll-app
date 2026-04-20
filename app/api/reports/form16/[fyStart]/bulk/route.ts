import { NextResponse } from 'next/server'
import JSZip from 'jszip'
import { verifySession } from '@/lib/auth/dal'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildForm16Buffer } from '@/lib/pdf/build-form16'

export const runtime = 'nodejs'
export const maxDuration = 120

type PP = Promise<{ fyStart: string }>

export async function GET(_req: Request, { params }: { params: PP }) {
  await verifySession()
  const { fyStart } = await params
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fyStart)) return new NextResponse('Bad fy', { status: 400 })

  const admin = createAdminClient()
  const { data: rows } = await admin
    .from('tds_ledger')
    .select('employee_id, employee_code_snapshot')
    .eq('fy_start', fyStart)
  if (!rows || rows.length === 0) return new NextResponse('No ledger entries', { status: 404 })

  const uniqueEmpIds = Array.from(new Set(rows.map((r) => r.employee_id as string)))
  const zip = new JSZip()
  const failed: string[] = []

  for (const id of uniqueEmpIds) {
    try {
      const result = await buildForm16Buffer(id, fyStart)
      if (result) zip.file(result.fileName, result.buffer)
    } catch (err) {
      failed.push(`${id}: ${(err as Error).message}`)
    }
  }

  if (failed.length > 0) zip.file('_ERRORS.txt', failed.join('\n'))

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })
  const fileName = `Form16_FY${fyStart.slice(0, 4)}-${String(Number(fyStart.slice(0, 4)) + 1).slice(2)}.zip`
  return new NextResponse(new Uint8Array(zipBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
