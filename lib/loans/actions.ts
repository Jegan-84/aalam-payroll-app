'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifySession } from '@/lib/auth/dal'

const r2 = (n: number) => Math.round(n * 100) / 100

// -----------------------------------------------------------------------------
// create — sanction a new loan for an employee
// -----------------------------------------------------------------------------
export async function createLoanAction(
  formData: FormData,
): Promise<{ ok?: true; error?: string; id?: string }> {
  const session = await verifySession()
  const employeeId = String(formData.get('employee_id') ?? '')
  const loanType = String(formData.get('loan_type') ?? 'personal')
  const loanNumber = String(formData.get('loan_number') ?? '').trim() || null
  const principal = Number(formData.get('principal') ?? 0)
  const tenureMonths = Number(formData.get('tenure_months') ?? 0)
  const emiRaw = formData.get('emi_amount')
  const startYear = Number(formData.get('start_year') ?? 0)
  const startMonth = Number(formData.get('start_month') ?? 0)
  const notes = String(formData.get('notes') ?? '').trim() || null

  if (!employeeId) return { error: 'Missing employee_id' }
  if (!['personal', 'housing', 'vehicle', 'advance', 'other'].includes(loanType)) {
    return { error: 'Invalid loan_type' }
  }
  if (!(principal > 0)) return { error: 'Principal must be positive' }
  if (!(tenureMonths > 0)) return { error: 'Tenure must be at least 1 month' }
  if (!startYear || !startMonth || startMonth < 1 || startMonth > 12) {
    return { error: 'Invalid start year/month' }
  }

  // If EMI not supplied, default to even division (interest-free V1).
  let emi: number
  if (emiRaw != null && String(emiRaw).trim() !== '') {
    emi = Number(emiRaw)
    if (!(emi > 0)) return { error: 'EMI must be positive' }
  } else {
    emi = r2(principal / tenureMonths)
  }

  const admin = createAdminClient()

  // Sanity-check: employee must exist and be active.
  const { data: emp } = await admin.from('employees').select('id, employment_status').eq('id', employeeId).maybeSingle()
  if (!emp) return { error: 'Employee not found' }
  if (emp.employment_status === 'exited') return { error: 'Cannot sanction a loan for an exited employee.' }

  const { data, error } = await admin
    .from('employee_loans')
    .insert({
      employee_id: employeeId,
      loan_type: loanType,
      loan_number: loanNumber,
      principal,
      interest_rate_percent: 0,
      tenure_months: tenureMonths,
      emi_amount: emi,
      start_year: startYear,
      start_month: startMonth,
      outstanding_balance: principal,
      total_paid: 0,
      status: 'active',
      notes,
      sanctioned_by: session.userId,
    })
    .select('id')
    .single()
  if (error) return { error: error.message }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'loan.sanction',
    entity_type: 'employee_loan',
    entity_id: data.id,
    summary: `Sanctioned ${loanType} loan ₹${principal} for ${emp.id}`,
  })

  revalidatePath(`/employees/${employeeId}/loans`)
  revalidatePath('/loans')
  return { ok: true, id: data.id as string }
}

// -----------------------------------------------------------------------------
// update — edit metadata only (not principal/tenure/balance once active)
// -----------------------------------------------------------------------------
export async function updateLoanAction(formData: FormData): Promise<{ ok?: true; error?: string }> {
  const session = await verifySession()
  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'Missing id' }
  const loanNumber = String(formData.get('loan_number') ?? '').trim() || null
  const emiRaw = formData.get('emi_amount')
  const notes = String(formData.get('notes') ?? '').trim() || null

  const admin = createAdminClient()
  const { data: loan } = await admin.from('employee_loans').select('*').eq('id', id).maybeSingle()
  if (!loan) return { error: 'Loan not found' }
  if (loan.status !== 'active') return { error: `Loan is ${loan.status}; cannot edit.` }

  const patch: Record<string, unknown> = { loan_number: loanNumber, notes }
  if (emiRaw != null && String(emiRaw).trim() !== '') {
    const emi = Number(emiRaw)
    if (!(emi > 0)) return { error: 'EMI must be positive' }
    patch.emi_amount = emi
  }

  const { error } = await admin.from('employee_loans').update(patch).eq('id', id)
  if (error) return { error: error.message }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'loan.update',
    entity_type: 'employee_loan',
    entity_id: id,
    summary: 'Loan metadata updated',
  })

  revalidatePath(`/loans/${id}`)
  revalidatePath(`/employees/${loan.employee_id}/loans`)
  return { ok: true }
}

// -----------------------------------------------------------------------------
// foreclose — employee paid the outstanding balance outside payroll
// -----------------------------------------------------------------------------
export async function forecloseLoanAction(formData: FormData): Promise<{ ok?: true; error?: string }> {
  const session = await verifySession()
  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'Missing id' }

  const admin = createAdminClient()
  const { data: loan } = await admin.from('employee_loans').select('*').eq('id', id).maybeSingle()
  if (!loan) return { error: 'Loan not found' }
  if (loan.status !== 'active') return { error: `Loan is ${loan.status}; cannot foreclose.` }

  const { error } = await admin
    .from('employee_loans')
    .update({
      status: 'foreclosed',
      outstanding_balance: 0,
      total_paid: Number(loan.principal),
      closed_at: new Date().toISOString(),
      closed_by: session.userId,
    })
    .eq('id', id)
  if (error) return { error: error.message }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'loan.foreclose',
    entity_type: 'employee_loan',
    entity_id: id,
    summary: `Loan foreclosed (balance ₹${Number(loan.outstanding_balance)} cleared outside payroll)`,
  })

  revalidatePath(`/loans/${id}`)
  revalidatePath(`/employees/${loan.employee_id}/loans`)
  revalidatePath('/loans')
  return { ok: true }
}

// -----------------------------------------------------------------------------
// writeOff — write off remaining balance (e.g. exit with loss)
// -----------------------------------------------------------------------------
export async function writeOffLoanAction(formData: FormData): Promise<{ ok?: true; error?: string }> {
  const session = await verifySession()
  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'Missing id' }

  const admin = createAdminClient()
  const { data: loan } = await admin.from('employee_loans').select('*').eq('id', id).maybeSingle()
  if (!loan) return { error: 'Loan not found' }
  if (loan.status !== 'active') return { error: `Loan is ${loan.status}; cannot write off.` }

  const { error } = await admin
    .from('employee_loans')
    .update({
      status: 'written_off',
      closed_at: new Date().toISOString(),
      closed_by: session.userId,
    })
    .eq('id', id)
  if (error) return { error: error.message }

  await admin.from('audit_log').insert({
    actor_user_id: session.userId,
    actor_email: session.email,
    action: 'loan.write_off',
    entity_type: 'employee_loan',
    entity_id: id,
    summary: `Loan written off (balance ₹${Number(loan.outstanding_balance)})`,
  })

  revalidatePath(`/loans/${id}`)
  revalidatePath(`/employees/${loan.employee_id}/loans`)
  revalidatePath('/loans')
  return { ok: true }
}
