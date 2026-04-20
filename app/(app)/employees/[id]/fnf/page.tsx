import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { getEmployee } from '@/lib/employees/queries'
import { getFnfForEmployee } from '@/lib/fnf/queries'
import { initiateFnfAction } from '@/lib/fnf/actions'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { ButtonLink } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export const metadata = { title: 'Full & Final Settlement' }

type PP = Promise<{ id: string }>

async function handleInitiate(formData: FormData) {
  'use server'
  const res = await initiateFnfAction(formData)
  if (res.ok && res.id) redirect(`/fnf/${res.id}`)
  if (res.error) redirect(`/employees/${formData.get('employee_id')}/fnf?err=${encodeURIComponent(res.error)}`)
}

export default async function EmployeeFnfLanding({
  params,
  searchParams,
}: {
  params: PP
  searchParams: Promise<{ err?: string }>
}) {
  const { id } = await params
  const { err } = await searchParams

  const [emp, existing] = await Promise.all([getEmployee(id), getFnfForEmployee(id)])
  if (!emp) notFound()

  if (existing) {
    return (
      <div className="max-w-3xl space-y-6">
        <PageHeader
          title="Full & Final Settlement"
          back={{ href: `/employees/${id}`, label: emp.full_name_snapshot }}
          subtitle={`LWD ${existing.last_working_day} · status: ${existing.status}`}
          actions={<ButtonLink href={`/fnf/${existing.id}`} variant="primary">Open settlement →</ButtonLink>}
        />
        <Card>
          <CardBody>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              An F&F settlement already exists for this employee.
            </p>
          </CardBody>
        </Card>
      </div>
    )
  }

  const canInitiate = emp.employment_status === 'on_notice' || emp.employment_status === 'resigned'

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Full & Final Settlement"
        back={{ href: `/employees/${id}`, label: emp.full_name_snapshot }}
        subtitle={`Employee status: ${emp.employment_status}`}
      />

      {!canInitiate && (
        <Card>
          <CardBody>
            <p className="text-sm text-amber-800 dark:text-amber-200">
              F&F can only be initiated when the employee is on notice or resigned.
              Update the employee&apos;s status on their profile first.
            </p>
          </CardBody>
        </Card>
      )}

      {canInitiate && (
        <Card>
          <CardHeader><CardTitle>Initiate settlement</CardTitle></CardHeader>
          <CardBody>
            {err && (
              <div role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                {err}
              </div>
            )}
            <form action={handleInitiate} className="grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="employee_id" value={id} />
              <Field label="Last working day" hint="Date of exit">
                <input
                  name="last_working_day"
                  type="date"
                  required
                  className={inputCls}
                />
              </Field>
              <Field label="Notice period (days)" hint="As per employment contract">
                <input
                  name="notice_period_days"
                  type="number"
                  min="0"
                  defaultValue={60}
                  required
                  className={inputCls}
                />
              </Field>
              <Field label="Notice days served" hint="How many days of the period the employee actually served">
                <input
                  name="notice_days_served"
                  type="number"
                  min="0"
                  defaultValue={0}
                  required
                  className={inputCls}
                />
              </Field>
              <div className="sm:col-span-2 flex items-center gap-3">
                <button
                  type="submit"
                  className="h-9 rounded-md bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
                >
                  Initiate F&amp;F
                </button>
                <Link href={`/employees/${id}`} className="text-sm text-slate-500 hover:underline">
                  Cancel
                </Link>
                <Badge tone="neutral">creates a draft settlement</Badge>
              </div>
            </form>

            <div className="mt-6 border-t border-slate-200 pt-4 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-400">
              Next steps after initiating:
              <ul className="ml-4 mt-1 list-disc space-y-0.5">
                <li>Run <strong>Compute</strong> on the settlement page to generate auto lines (salary proration, leave encashment, gratuity, notice adjustments, TDS).</li>
                <li>Add any manual lines (bonus, loan recovery, asset deductions).</li>
                <li>Approve to flip the employee to <em>exited</em> and lock the statement.</li>
                <li>Download the PDF and mark paid.</li>
              </ul>
            </div>
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

const inputCls =
  'mt-1 h-9 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-950'
