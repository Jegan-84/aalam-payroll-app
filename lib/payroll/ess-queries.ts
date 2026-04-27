import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/auth/dal'

export type EmployeePayslipRow = {
  cycle_id: string
  year: number
  month: number
  cycle_status: 'draft' | 'computed' | 'approved' | 'locked' | 'paid'
  item_status: 'draft' | 'approved' | 'locked'
  paid_days: number
  lop_days: number
  monthly_gross: number
  total_deductions: number
  net_pay: number
  monthly_tds: number
}

/**
 * Lists an employee's payslips across every cycle where their item exists
 * and the cycle has reached at least 'approved' (so the payslip is final).
 * Ordered newest-first.
 */
export async function listEmployeePayslips(employeeId: string): Promise<EmployeePayslipRow[]> {
  await verifySession()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('payroll_items')
    .select(
      `
      status, paid_days, lop_days, monthly_gross, total_deductions, net_pay, monthly_tds,
      cycle:payroll_cycles!inner ( id, year, month, status )
    `,
    )
    .eq('employee_id', employeeId)
    .in('status', ['approved', 'locked'])
    .order('cycle(year)', { ascending: false })
    .order('cycle(month)', { ascending: false })
  if (error) throw new Error(error.message)

  type CycleEmbed = { id: string; year: number; month: number; status: string } | Array<{ id: string; year: number; month: number; status: string }> | null
  type Row = {
    status: 'draft' | 'approved' | 'locked'
    paid_days: number
    lop_days: number
    monthly_gross: number
    total_deductions: number
    net_pay: number
    monthly_tds: number
    cycle: CycleEmbed
  }
  return ((data ?? []) as unknown as Row[])
    .map((r) => {
      const cy = Array.isArray(r.cycle) ? r.cycle[0] : r.cycle
      if (!cy) return null
      return {
        cycle_id: cy.id,
        year: Number(cy.year),
        month: Number(cy.month),
        cycle_status: cy.status as EmployeePayslipRow['cycle_status'],
        item_status: r.status,
        paid_days: Number(r.paid_days),
        lop_days: Number(r.lop_days),
        monthly_gross: Number(r.monthly_gross),
        total_deductions: Number(r.total_deductions),
        net_pay: Number(r.net_pay),
        monthly_tds: Number(r.monthly_tds),
      }
    })
    .filter((r): r is EmployeePayslipRow => r !== null)
}
