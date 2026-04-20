import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/dal'

export type DepartmentRow = { id: number; code: string; name: string; is_active: boolean; created_at: string }
export type DesignationRow = { id: number; code: string; name: string; grade: string | null; is_active: boolean; created_at: string }

export async function listDepartments(): Promise<DepartmentRow[]> {
  await requireRole('admin', 'hr')
  const supabase = await createClient()
  const { data, error } = await supabase.from('departments').select('*').order('name')
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as DepartmentRow[]
}

export async function listDesignations(): Promise<DesignationRow[]> {
  await requireRole('admin', 'hr')
  const supabase = await createClient()
  const { data, error } = await supabase.from('designations').select('*').order('name')
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as DesignationRow[]
}
