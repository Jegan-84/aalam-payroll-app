import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { getEmployee } from '@/lib/employees/queries'
import { listEmployeeLoans } from '@/lib/loans/queries'
import { createLoanAction } from '@/lib/loans/actions'
import { formatInr } from '@/lib/format'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const metadata = { title: 'Employee Loans' }

type PP = Promise<{ id: string }>

async function handleCreate(formData: FormData) {
  'use server'
  const employeeId = String(formData.get('employee_id') ?? '')
  const res = await createLoanAction(formData)
  if (res.ok) redirect(`/employees/${employeeId}/loans`)
  if (res.error) redirect(`/employees/${employeeId}/loans?err=${encodeURIComponent(res.error)}`)
}

const STATUS_TONE: Record<string, 'success' | 'info' | 'warn' | 'neutral'> = {
  active: 'info',
  closed: 'success',
  foreclosed: 'success',
  written_off: 'warn',
}

export default async function EmployeeLoansPage({
  params,
  searchParams,
}: {
  params: PP
  searchParams: Promise<{ err?: string }>
}) {
  const { id } = await params
  const { err } = await searchParams
  const [emp, loans] = await Promise.all([getEmployee(id), listEmployeeLoans(id)])
  if (!emp) notFound()

  const now = new Date()
  const defaultYear = now.getUTCMonth() >= 11 ? now.getUTCFullYear() + 1 : now.getUTCFullYear()
  const defaultMonth = (now.getUTCMonth() + 2 > 12 ? 1 : now.getUTCMonth() + 2) // next month

  const canSanction = emp.employment_status !== 'exited'

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title="Loans"
        back={{ href: `/employees/${id}`, label: emp.full_name_snapshot }}
        subtitle={`${loans.length} ${loans.length === 1 ? 'loan' : 'loans'} on record`}
      />

      {loans.length > 0 && (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
              <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
                <tr>
                  <Th>Type</Th>
                  <Th>Sanctioned</Th>
                  <Th className="text-right">Principal</Th>
                  <Th className="text-right">EMI</Th>
                  <Th>Start</Th>
                  <Th className="text-right">Paid</Th>
                  <Th className="text-right">Outstanding</Th>
                  <Th>Status</Th>
                  <Th>{' '}</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
                {loans.map((l) => (
                  <tr key={l.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-950">
                    <Td>{l.loan_type}{l.loan_number ? <span className="ml-1 text-xs text-slate-500">({l.loan_number})</span> : null}</Td>
                    <Td className="text-xs text-slate-500">{l.sanctioned_at.slice(0, 10)}</Td>
                    <Td className="text-right tabular-nums">{formatInr(l.principal)}</Td>
                    <Td className="text-right tabular-nums">{formatInr(l.emi_amount)}</Td>
                    <Td className="tabular-nums">{l.start_year}-{String(l.start_month).padStart(2, '0')}</Td>
                    <Td className="text-right tabular-nums">{formatInr(l.total_paid)}</Td>
                    <Td className="text-right font-semibold tabular-nums">{formatInr(l.outstanding_balance)}</Td>
                    <Td><Badge tone={STATUS_TONE[l.status] ?? 'neutral'}>{l.status.replace('_', ' ')}</Badge></Td>
                    <Td><Link href={`/loans/${l.id}`} className="text-xs font-medium text-brand-700 hover:underline">Open →</Link></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {canSanction && (
        <Card>
          <CardHeader><CardTitle>Sanction a new loan</CardTitle></CardHeader>
          <CardBody>
            {err && (
              <div role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                {err}
              </div>
            )}
            <form action={handleCreate} className="grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="employee_id" value={id} />
              <Field label="Loan type">
                <select name="loan_type" required className={inputCls} defaultValue="personal">
                  <option value="personal">Personal</option>
                  <option value="housing">Housing</option>
                  <option value="vehicle">Vehicle</option>
                  <option value="advance">Salary advance</option>
                  <option value="other">Other</option>
                </select>
              </Field>
              <Field label="Reference number (optional)">
                <input name="loan_number" type="text" className={inputCls} />
              </Field>
              <Field label="Principal ₹" hint="Amount disbursed">
                <input name="principal" type="number" min="1" step="1" required className={inputCls} />
              </Field>
              <Field label="Tenure (months)">
                <input name="tenure_months" type="number" min="1" max="120" step="1" required className={inputCls} />
              </Field>
              <Field label="EMI ₹" hint="Leave blank to auto-divide principal ÷ tenure">
                <input name="emi_amount" type="number" min="1" step="1" className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Start year">
                  <input name="start_year" type="number" min="2024" max="2100" defaultValue={defaultYear} required className={inputCls} />
                </Field>
                <Field label="Start month">
                  <input name="start_month" type="number" min="1" max="12" defaultValue={defaultMonth} required className={inputCls} />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Notes (optional)">
                  <textarea name="notes" rows={2} className={inputCls + ' resize-none'} />
                </Field>
              </div>
              <div className="sm:col-span-2 flex items-center gap-3">
                <button
                  type="submit"
                  className="h-9 rounded-md bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
                >
                  Sanction loan
                </button>
                <Link href={`/employees/${id}`} className="text-sm text-slate-500 hover:underline">Cancel</Link>
                <span className="text-xs text-slate-500">V1: interest-free. EMIs auto-deduct in payroll from the start month.</span>
              </div>
            </form>
          </CardBody>
        </Card>
      )}
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col">
      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</span>
      {children}
      {hint && <span className="mt-1 text-[11px] text-slate-500">{hint}</span>}
    </label>
  )
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 ${className}`}>{children}</th>
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-slate-900 dark:text-slate-100 ${className}`}>{children}</td>
}

const inputCls =
  'mt-1 h-9 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-950'
