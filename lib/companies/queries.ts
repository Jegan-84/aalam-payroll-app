import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { requireRole, verifySession } from '@/lib/auth/dal'

export type CompanyRow = {
  id: string
  code: string
  legal_name: string
  display_name: string
  pan: string | null
  tan: string | null
  gstin: string | null
  cin: string | null
  epf_establishment_id: string | null
  esi_establishment_id: string | null
  pt_registration_no: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  pincode: string | null
  country: string | null
  logo_url: string | null
  is_active: boolean
  display_order: number
  created_at: string
  updated_at: string
}

export async function listCompanies(opts: { activeOnly?: boolean } = {}): Promise<CompanyRow[]> {
  await verifySession()
  const supabase = await createClient()
  let query = supabase.from('companies').select('*').order('display_order').order('legal_name')
  if (opts.activeOnly) query = query.eq('is_active', true)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as CompanyRow[]
}

export const getCompany = cache(async (id: string): Promise<CompanyRow | null> => {
  await requireRole('admin', 'hr')
  const supabase = await createClient()
  const { data } = await supabase.from('companies').select('*').eq('id', id).maybeSingle()
  return (data as unknown as CompanyRow) ?? null
})

export function formatCompanyAddress(c: Pick<CompanyRow, 'address_line1' | 'address_line2' | 'city' | 'state' | 'pincode'>): string {
  const parts = [
    c.address_line1,
    c.address_line2,
    [c.city, c.state, c.pincode].filter(Boolean).join(' '),
  ].filter(Boolean) as string[]
  return parts.join(', ')
}
