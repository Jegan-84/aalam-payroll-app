import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/auth/dal'

export type LoanStatus = 'active' | 'closed' | 'foreclosed' | 'written_off'
export type LoanType = 'personal' | 'housing' | 'vehicle' | 'advance' | 'other'

export type LoanRow = {
  id: string
  employee_id: string
  loan_type: LoanType
  loan_number: string | null
  principal: number
  interest_rate_percent: number
  tenure_months: number
  emi_amount: number
  start_year: number
  start_month: number
  outstanding_balance: number
  total_paid: number
  status: LoanStatus
  notes: string | null
  sanctioned_at: string
  closed_at: string | null
  created_at: string
  updated_at: string
}

export type LoanWithEmployee = LoanRow & {
  employee: { id: string; employee_code: string; full_name_snapshot: string } | null
}

export type RepaymentRow = {
  id: string
  loan_id: string
  cycle_id: string
  amount_paid: number
  running_balance: number
  cycle_year: number
  cycle_month: number
  created_at: string
}

function rowToLoan(r: Record<string, unknown>): LoanRow {
  return {
    id: r.id as string,
    employee_id: r.employee_id as string,
    loan_type: r.loan_type as LoanType,
    loan_number: (r.loan_number as string | null) ?? null,
    principal: Number(r.principal),
    interest_rate_percent: Number(r.interest_rate_percent),
    tenure_months: Number(r.tenure_months),
    emi_amount: Number(r.emi_amount),
    start_year: Number(r.start_year),
    start_month: Number(r.start_month),
    outstanding_balance: Number(r.outstanding_balance),
    total_paid: Number(r.total_paid),
    status: r.status as LoanStatus,
    notes: (r.notes as string | null) ?? null,
    sanctioned_at: r.sanctioned_at as string,
    closed_at: (r.closed_at as string | null) ?? null,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
  }
}

export async function listEmployeeLoans(employeeId: string): Promise<LoanRow[]> {
  await verifySession()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('employee_loans')
    .select('*')
    .eq('employee_id', employeeId)
    .order('sanctioned_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => rowToLoan(r as Record<string, unknown>))
}

export async function listLoans(opts?: {
  page?: number
  pageSize?: number
  status?: LoanStatus
}): Promise<{ rows: LoanWithEmployee[]; total: number; page: number; totalPages: number }> {
  await verifySession()
  const supabase = await createClient()

  const pageSize = Math.max(1, Math.min(100, opts?.pageSize ?? 50))
  const page = Math.max(1, opts?.page ?? 1)
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('employee_loans')
    .select(
      `
      *,
      employee:employees!inner ( id, employee_code, full_name_snapshot )
    `,
      { count: 'exact' },
    )
    .order('sanctioned_at', { ascending: false })
    .range(from, to)

  if (opts?.status) query = query.eq('status', opts.status)

  const { data, count, error } = await query
  if (error) throw new Error(error.message)

  type EmpEmbed = { id: string; employee_code: string; full_name_snapshot: string }
  const rows = (data ?? []).map((r) => {
    const loan = rowToLoan(r as Record<string, unknown>)
    const raw = (r as { employee: EmpEmbed | EmpEmbed[] | null }).employee
    const emp = Array.isArray(raw) ? raw[0] ?? null : raw
    return { ...loan, employee: emp }
  })
  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  return { rows, total, page: Math.min(page, totalPages), totalPages }
}

export const getLoan = cache(async (id: string): Promise<LoanRow | null> => {
  await verifySession()
  const supabase = await createClient()
  const { data } = await supabase.from('employee_loans').select('*').eq('id', id).maybeSingle()
  return data ? rowToLoan(data as Record<string, unknown>) : null
})

export async function listLoanRepayments(loanId: string): Promise<RepaymentRow[]> {
  await verifySession()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('loan_repayments')
    .select('*')
    .eq('loan_id', loanId)
    .order('cycle_year')
    .order('cycle_month')
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => ({
    id: r.id as string,
    loan_id: r.loan_id as string,
    cycle_id: r.cycle_id as string,
    amount_paid: Number(r.amount_paid),
    running_balance: Number(r.running_balance),
    cycle_year: Number(r.cycle_year),
    cycle_month: Number(r.cycle_month),
    created_at: r.created_at as string,
  }))
}
