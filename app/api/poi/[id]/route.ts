import { NextResponse } from 'next/server'
import { verifySession, requireAdminOrOwnEmployee } from '@/lib/auth/dal'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

type PP = Promise<{ id: string }>

const BUCKET = 'poi-documents'

export async function GET(_req: Request, { params }: { params: PP }) {
  await verifySession()
  const { id } = await params

  const admin = createAdminClient()
  const { data: poi } = await admin
    .from('poi_documents')
    .select('employee_id, file_path, file_name, mime_type')
    .eq('id', id)
    .maybeSingle()
  if (!poi) return new NextResponse('Not found', { status: 404 })

  // Gate: admin/HR/payroll OR the owning employee.
  await requireAdminOrOwnEmployee(poi.employee_id as string)

  // Issue a 60-second signed URL; redirect the browser to it.
  const { data: signed, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(poi.file_path as string, 60, {
      download: (poi.file_name as string) ?? 'proof',
    })
  if (error || !signed?.signedUrl) {
    return new NextResponse('Failed to sign URL', { status: 500 })
  }
  return NextResponse.redirect(signed.signedUrl, { status: 302 })
}
