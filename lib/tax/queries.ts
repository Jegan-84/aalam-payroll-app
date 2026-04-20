import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/auth/dal'
import type { RawDeclaration } from '@/lib/tax/declarations'

export type DeclarationRow = RawDeclaration & {
  id: string
  employee_id: string
  fy_start: string
  fy_end: string
  regime: 'NEW' | 'OLD'
  status: 'draft' | 'submitted' | 'approved' | 'rejected'
  submitted_at: string | null
  reviewed_at: string | null
  review_notes: string | null
}

export const getDeclaration = cache(async (employeeId: string, fyStart: string): Promise<DeclarationRow | null> => {
  await verifySession()
  const supabase = await createClient()
  const { data } = await supabase
    .from('employee_tax_declarations')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('fy_start', fyStart)
    .maybeSingle()
  return (data as unknown as DeclarationRow) ?? null
})

/** Only an APPROVED declaration is applied to tax computation. */
export const getApprovedDeclaration = cache(async (employeeId: string, fyStart: string): Promise<DeclarationRow | null> => {
  await verifySession()
  const supabase = await createClient()
  const { data } = await supabase
    .from('employee_tax_declarations')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('fy_start', fyStart)
    .eq('status', 'approved')
    .maybeSingle()
  return (data as unknown as DeclarationRow) ?? null
})
