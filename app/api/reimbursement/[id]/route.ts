import { NextResponse } from 'next/server'
import { verifySession, requireAdminOrOwnEmployee } from '@/lib/auth/dal'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

type PP = Promise<{ id: string }>

const BUCKET = 'reimbursement-receipts'

export async function GET(_req: Request, { params }: { params: PP }) {
  await verifySession()
  const { id } = await params

  const admin = createAdminClient()
  const { data: claim } = await admin
    .from('reimbursement_claims')
    .select('employee_id, file_path, file_name')
    .eq('id', id)
    .maybeSingle()
  if (!claim) return new NextResponse('Not found', { status: 404 })

  await requireAdminOrOwnEmployee(claim.employee_id as string)

  const { data: signed, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(claim.file_path as string, 60, {
      download: (claim.file_name as string) ?? 'receipt',
    })
  if (error || !signed?.signedUrl) return new NextResponse('Failed to sign URL', { status: 500 })
  return NextResponse.redirect(signed.signedUrl, { status: 302 })
}
