import { notFound } from 'next/navigation'
import { getCurrentEmployee } from '@/lib/auth/dal'
import { getLeaveApplication } from '@/lib/leave/queries'
import { approveLeaveAction, rejectLeaveAction } from '@/lib/leave/actions'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardBody } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const metadata = { title: 'Review leave request' }

type PP = Promise<{ id: string }>

export default async function ManagerLeaveDetailPage({ params }: { params: PP }) {
  const { id } = await params
  const { employeeId: myEmployeeId } = await getCurrentEmployee()

  const app = await getLeaveApplication(id)
  if (!app) notFound()

  // Authorisation: managers can only see their direct reports' applications
  // when status='pending'. Anything else falls through to /me/leave.
  // (Admins have access via /leave/[id] — this page is the ESS-side view for
  // reporting managers reviewing their team.)
  const reportsTo = (app.employee as { reports_to?: string | null }).reports_to ?? null
  const isMyReport = reportsTo === myEmployeeId
  if (!isMyReport) notFound()

  const { employee, leave_type } = app

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title={`${leave_type.code} — ${employee.full_name_snapshot}`}
        back={{ href: '/me/leave/approvals', label: 'Team approvals' }}
        actions={<Badge tone={app.status === 'pending' ? 'warn' : 'neutral'}>{app.status}</Badge>}
      />

      <Card>
        <CardBody>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <Field label="Employee">
              {employee.full_name_snapshot} <span className="text-slate-500">({employee.employee_code})</span>
            </Field>
            <Field label="Leave type">{leave_type.name} ({leave_type.code})</Field>
            <Field label="From">{app.from_date as string}</Field>
            <Field label="To">{app.to_date as string}</Field>
            <Field label="Days">
              <span className="font-semibold">{Number(app.days_count).toFixed(1)}</span>
              {app.is_half_day ? ' (half-day)' : ''}
            </Field>
            <Field label="Applied at">
              {new Date(app.applied_at as string).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
            </Field>
            {app.reason ? (
              <div className="col-span-2">
                <dt className="text-xs uppercase tracking-wide text-slate-500">Reason</dt>
                <dd className="mt-0.5 whitespace-pre-wrap text-slate-900 dark:text-slate-100">{app.reason as string}</dd>
              </div>
            ) : null}
          </dl>
        </CardBody>
      </Card>

      {app.status === 'pending' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <form action={approveLeaveAction} className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/40">
            <input type="hidden" name="id" value={app.id as string} />
            <label className="mb-2 block text-xs font-medium text-green-800 dark:text-green-300">Approval note (optional)</label>
            <input name="notes" className="mb-3 block h-9 w-full rounded-md border border-green-300 bg-white px-3 text-sm dark:border-green-800 dark:bg-slate-950" />
            <button className="inline-flex h-9 items-center rounded-md bg-green-700 px-4 text-sm font-medium text-white hover:bg-green-800">
              Approve and forward to HR
            </button>
          </form>
          <form action={rejectLeaveAction} className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40">
            <input type="hidden" name="id" value={app.id as string} />
            <label className="mb-2 block text-xs font-medium text-red-800 dark:text-red-300">Reason for rejection</label>
            <input name="notes" className="mb-3 block h-9 w-full rounded-md border border-red-300 bg-white px-3 text-sm dark:border-red-800 dark:bg-slate-950" />
            <button className="inline-flex h-9 items-center rounded-md bg-red-700 px-4 text-sm font-medium text-white hover:bg-red-800">
              Reject
            </button>
          </form>
        </div>
      ) : (
        <p className="rounded-md border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          This request is no longer in your queue (status: <strong>{app.status as string}</strong>).
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
