import { notFound } from 'next/navigation'
import { getCurrentEmployee } from '@/lib/auth/dal'
import { createClient } from '@/lib/supabase/server'
import { CompOffReviewActions } from './_components/review-actions'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardBody } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const metadata = { title: 'Review comp-off request' }

type PP = Promise<{ id: string }>

export default async function ManagerCompOffDetailPage({ params }: { params: PP }) {
  const { id } = await params
  const { employeeId: myEmployeeId } = await getCurrentEmployee()

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('comp_off_requests')
    .select('*, employee:employees!inner(id, employee_code, full_name_snapshot, reports_to)')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) notFound()

  type Emp = { id: string; employee_code: string; full_name_snapshot: string; reports_to: string | null }
  const employee = (Array.isArray(data.employee) ? data.employee[0] : data.employee) as Emp | null
  if (!employee) notFound()
  // Authorisation — managers see only their direct reports' requests.
  if (employee.reports_to !== myEmployeeId) notFound()

  const isPending = data.status === 'submitted'

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title={`Comp off — ${employee.full_name_snapshot}`}
        back={{ href: '/me/comp-off/approvals', label: 'Team approvals' }}
        actions={<Badge tone={isPending ? 'warn' : 'neutral'}>{isPending ? 'awaiting manager' : (data.status as string)}</Badge>}
      />

      <Card>
        <CardBody>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <Field label="Employee">
              {employee.full_name_snapshot} <span className="text-slate-500">({employee.employee_code})</span>
            </Field>
            <Field label="Worked on">{data.work_date as string}</Field>
            <Field label="Days requested"><span className="font-semibold">{Number(data.days_requested).toFixed(1)}</span></Field>
            <Field label="Submitted">
              {new Date(data.created_at as string).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
            </Field>
            {data.reason ? (
              <div className="col-span-2">
                <dt className="text-xs uppercase tracking-wide text-slate-500">Reason</dt>
                <dd className="mt-0.5 whitespace-pre-wrap text-slate-900 dark:text-slate-100">{data.reason as string}</dd>
              </div>
            ) : null}
          </dl>
        </CardBody>
      </Card>

      {isPending ? (
        <CompOffReviewActions id={data.id as string} />
      ) : (
        <p className="rounded-md border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          This request is no longer in your queue (status: <strong>{data.status as string}</strong>).
        </p>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-slate-900 dark:text-slate-100">{children}</dd>
    </div>
  )
}
