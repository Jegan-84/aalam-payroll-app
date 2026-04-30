import { notFound } from 'next/navigation'
import { getLeaveApplication } from '@/lib/leave/queries'
import { approveLeaveAction, rejectLeaveAction, cancelLeaveAction } from '@/lib/leave/actions'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardBody } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const metadata = { title: 'Leave application' }

type PP = Promise<{ id: string }>

const STATUS_LABEL: Record<string, string> = {
  pending: 'Awaiting reporting manager',
  manager_approved: 'Awaiting HR',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
}

export default async function LeaveDetailPage({ params }: { params: PP }) {
  const { id } = await params
  const app = await getLeaveApplication(id)
  if (!app) notFound()

  const { employee, leave_type } = app
  const statusTone: Record<string, 'warn' | 'success' | 'danger' | 'neutral'> = {
    pending: 'warn',
    manager_approved: 'warn',
    approved: 'success',
    rejected: 'danger',
    cancelled: 'neutral',
  }

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title={`${leave_type.code} — ${employee.full_name_snapshot}`}
        back={{ href: '/leave', label: 'Leave' }}
        actions={<Badge tone={statusTone[app.status] ?? 'neutral'}>{STATUS_LABEL[app.status] ?? app.status}</Badge>}
      />

      <ProgressStrip status={app.status as string} />

      <Card>
        <CardBody>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Employee</dt>
            <dd className="mt-0.5 text-slate-900 dark:text-slate-100">
              {employee.full_name_snapshot} <span className="text-slate-500">({employee.employee_code})</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Leave type</dt>
            <dd className="mt-0.5 text-slate-900 dark:text-slate-100">{leave_type.name} ({leave_type.code})</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">From</dt>
            <dd className="mt-0.5 text-slate-900 dark:text-slate-100">{app.from_date}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">To</dt>
            <dd className="mt-0.5 text-slate-900 dark:text-slate-100">{app.to_date}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Days</dt>
            <dd className="mt-0.5 flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
              <span>{Number(app.days_count).toFixed(1)}</span>
              {app.is_half_day && (
                <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                  ½ day
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Applied at</dt>
            <dd className="mt-0.5 text-slate-900 dark:text-slate-100">{formatTs(app.applied_at as string)}</dd>
          </div>
          {app.reason && (
            <div className="col-span-2">
              <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Reason</dt>
              <dd className="mt-0.5 whitespace-pre-wrap text-slate-900 dark:text-slate-100">{app.reason}</dd>
            </div>
          )}
          {app.review_notes && (
            <div className="col-span-2">
              <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Review notes {app.reviewed_at ? `(${formatTs(app.reviewed_at as string)})` : ''}
              </dt>
              <dd className="mt-0.5 whitespace-pre-wrap text-slate-900 dark:text-slate-100">{app.review_notes}</dd>
            </div>
          )}
        </dl>
        </CardBody>
      </Card>

      {(app.status === 'pending' || app.status === 'manager_approved') && (
        <div className="grid gap-3 sm:grid-cols-2">
          <form action={approveLeaveAction} className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/40">
            <input type="hidden" name="id" value={app.id as string} />
            <label className="mb-2 block text-xs font-medium text-green-800 dark:text-green-300">
              {app.status === 'pending' ? 'Manager approval note (optional)' : 'HR approval note (optional)'}
            </label>
            <input name="notes" className="mb-3 block h-9 w-full rounded-md border border-green-300 bg-white px-3 text-sm dark:border-green-800 dark:bg-slate-950" />
            <button className="inline-flex h-9 items-center rounded-md bg-green-700 px-4 text-sm font-medium text-white hover:bg-green-800">
              {app.status === 'pending' ? 'Approve (manager)' : 'Approve (HR — final)'}
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
      )}

      {(app.status === 'approved' || app.status === 'pending' || app.status === 'manager_approved') && (
        <form action={cancelLeaveAction} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <input type="hidden" name="id" value={app.id as string} />
          <label className="mb-2 block text-xs font-medium text-slate-700 dark:text-slate-300">
            Cancel application {app.status === 'approved' ? '— will refund balance and clear attendance cells' : ''}
          </label>
          <input name="notes" className="mb-3 block h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950" />
          <button className="inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800">
            Cancel application
          </button>
        </form>
      )}
    </div>
  )
}

function formatTs(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

// -----------------------------------------------------------------------------
// Two-step progress strip — visualises pending → manager_approved → approved.
function ProgressStrip({ status }: { status: string }) {
  const isRejected  = status === 'rejected'
  const isCancelled = status === 'cancelled'
  if (isRejected || isCancelled) {
    return (
      <div className="rounded-md border border-slate-200 bg-white px-4 py-2 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        Application is <strong className={isRejected ? 'text-red-700 dark:text-red-400' : 'text-slate-700 dark:text-slate-200'}>{status}</strong>. No further action.
      </div>
    )
  }
  const stage1Done = status === 'manager_approved' || status === 'approved'
  const stage2Done = status === 'approved'
  return (
    <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-3 text-xs dark:border-slate-800 dark:bg-slate-900">
      <Step label="Reporting manager" done={stage1Done} active={!stage1Done} />
      <Connector done={stage1Done} />
      <Step label="HR" done={stage2Done} active={stage1Done && !stage2Done} />
    </div>
  )
}

function Step({ label, done, active }: { label: string; done: boolean; active: boolean }) {
  const tone =
    done   ? 'bg-emerald-600 text-white'
  : active ? 'bg-amber-500 text-white animate-pulse'
  :          'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-500'
  return (
    <div className="flex items-center gap-1.5">
      <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${tone}`}>
        {done ? '✓' : active ? '…' : '·'}
      </span>
      <span className={`font-medium ${done ? 'text-emerald-700 dark:text-emerald-300' : active ? 'text-amber-700 dark:text-amber-300' : 'text-slate-500'}`}>
        {label}
      </span>
    </div>
  )
}

function Connector({ done }: { done: boolean }) {
  return <span className={`h-0.5 flex-1 ${done ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
}
