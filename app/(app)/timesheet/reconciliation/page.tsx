import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getTimesheetLeaveReconciliation, type ReconciliationRow } from '@/lib/timesheet/reconciliation-queries'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Stat } from '@/components/ui/stat'
import { RangePicker } from './_components/range-picker'

export const metadata = { title: 'Timesheet × Leave reconciliation' }

type SP = Promise<{ from?: string; to?: string; employee?: string }>

function defaultRange(): { from: string; to: string } {
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  return { from: start.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) }
}

const KIND_TONE: Record<string, string> = {
  leave_no_timesheet: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  timesheet_no_leave: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200',
  mismatch:           'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200',
}

const KIND_LABEL: Record<string, string> = {
  leave_no_timesheet: 'Leave only — no timesheet',
  timesheet_no_leave: 'Timesheet only — no leave',
  mismatch:           'Type mismatch',
}

export default async function ReconciliationPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams
  const def = defaultRange()
  const from = sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from : def.from
  const to   = sp.to   && /^\d{4}-\d{2}-\d{2}$/.test(sp.to)   ? sp.to   : def.to
  const employeeId = sp.employee && /^[0-9a-f-]{36}$/i.test(sp.employee) ? sp.employee : undefined

  const supabase = await createClient()
  const employeeOptionsP = supabase
    .from('employees')
    .select('id, employee_code, full_name_snapshot, employment_status')
    .eq('employment_status', 'active')
    .order('full_name_snapshot')

  const [summary, employeeOptionsRes] = await Promise.all([
    getTimesheetLeaveReconciliation(from, to, { employeeId }),
    employeeOptionsP,
  ])
  const employeeOptions = (employeeOptionsRes.data ?? []) as Array<{ id: string; employee_code: string; full_name_snapshot: string }>

  const exportParams = new URLSearchParams({ from, to })
  if (employeeId) exportParams.set('employee', employeeId)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Timesheet × Leave reconciliation"
        back={{ href: '/dashboard', label: 'Dashboard' }}
        subtitle={`Showing ${from} → ${to}. Compares submitted + approved leave applications with leave-coded timesheet entries.`}
        actions={
          <Link
            href={`/api/timesheet/reconciliation/export?${exportParams.toString()}`}
            className="inline-flex h-9 items-center whitespace-nowrap rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
          >
            Download CSV
          </Link>
        }
      />

      <RangePicker from={from} to={to} employeeId={employeeId} employees={employeeOptions} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat
          label="Total mismatches"
          value={summary.total}
          tone={summary.total > 0 ? 'warn' : 'brand'}
        />
        <Stat
          label="Reconciled cleanly"
          value={summary.matchedDays}
          hint={`${summary.cleanEmployees.length} employee${summary.cleanEmployees.length === 1 ? '' : 's'}`}
          tone={summary.matchedDays > 0 ? 'brand' : 'default'}
        />
        <Stat label="Leave only — no timesheet" value={summary.leaveNoTimesheet} tone={summary.leaveNoTimesheet > 0 ? 'warn' : 'default'} />
        <Stat label="Timesheet only — no leave" value={summary.timesheetNoLeave} tone={summary.timesheetNoLeave > 0 ? 'danger' : 'default'} />
        <Stat label="Type mismatch"             value={summary.mismatch}         tone={summary.mismatch > 0 ? 'danger' : 'default'} />
      </div>

      {summary.rows.length === 0 ? (
        <Card className="px-6 py-12 text-center text-sm text-slate-500">
          ✅ Nothing to reconcile in this range. Leave applications and timesheet entries agree.
        </Card>
      ) : (
        <>
          <p className="text-[11px] text-slate-500">
            Highlights: <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">amber</span> = leave applied but missed in timesheet ·
            <span className="ml-1 rounded-full bg-rose-100 px-1.5 py-0.5 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200">rose</span> = leave logged in timesheet without a leave application ·
            <span className="ml-1 rounded-full bg-violet-100 px-1.5 py-0.5 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200">violet</span> = type doesn&apos;t match.
          </p>
          <div className="space-y-4">
            {groupByEmployee(summary.rows).map((group) => (
              <EmployeeBlock key={group.employeeId} group={group} />
            ))}
          </div>
        </>
      )}

      {summary.cleanEmployees.length > 0 && (
        <Card className="overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-100 bg-emerald-50/60 px-4 py-3 dark:border-emerald-900/60 dark:bg-emerald-950/30">
            <div>
              <div className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                ✅ Reconciled cleanly
              </div>
              <div className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80">
                Leave applications and timesheet entries agree for these {summary.cleanEmployees.length} employee{summary.cleanEmployees.length === 1 ? '' : 's'}
                {' '}· {summary.matchedDays} matched day{summary.matchedDays === 1 ? '' : 's'} total.
              </div>
            </div>
          </div>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {summary.cleanEmployees.map((e) => (
              <li key={e.employeeId} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                <div>
                  <Link
                    href={`/employees/${e.employeeId}`}
                    className="font-medium text-slate-900 hover:text-brand-700 dark:text-slate-100"
                  >
                    {e.employeeName}
                  </Link>
                  <span className="ml-2 text-xs text-slate-500">{e.employeeCode}</span>
                </div>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                  {e.matchedDays} matched
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="text-[11px] text-slate-500">
        Both <strong>submitted</strong> and <strong>approved</strong> leave applications are checked — so mismatches surface as soon as the employee submits, not only after HR approves. Rejected / cancelled leaves are ignored. The timesheet side
        considers entries with activity codes <code>SL</code>, <code>PL</code>, <code>EL</code>, <code>COMP_OFF</code>, <code>LOP</code>.
      </p>
    </div>
  )
}

// -----------------------------------------------------------------------------
type EmployeeGroup = {
  employeeId: string
  employeeCode: string
  employeeName: string
  rows: ReconciliationRow[]
  counts: { leaveNoTimesheet: number; timesheetNoLeave: number; mismatch: number }
}

function groupByEmployee(rows: ReconciliationRow[]): EmployeeGroup[] {
  const map = new Map<string, EmployeeGroup>()
  for (const r of rows) {
    let g = map.get(r.employeeId)
    if (!g) {
      g = {
        employeeId: r.employeeId,
        employeeCode: r.employeeCode,
        employeeName: r.employeeName,
        rows: [],
        counts: { leaveNoTimesheet: 0, timesheetNoLeave: 0, mismatch: 0 },
      }
      map.set(r.employeeId, g)
    }
    g.rows.push(r)
    if (r.kind === 'leave_no_timesheet') g.counts.leaveNoTimesheet += 1
    else if (r.kind === 'timesheet_no_leave') g.counts.timesheetNoLeave += 1
    else g.counts.mismatch += 1
  }
  return Array.from(map.values()).sort((a, b) => a.employeeName.localeCompare(b.employeeName))
}

function EmployeeBlock({ group }: { group: EmployeeGroup }) {
  const { rows, counts } = group
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
        <div>
          <Link
            href={`/employees/${group.employeeId}`}
            className="text-sm font-semibold text-slate-900 hover:text-brand-700 dark:text-slate-50"
          >
            {group.employeeName}
          </Link>
          <span className="ml-2 text-xs text-slate-500">{group.employeeCode}</span>
          <span className="ml-3 text-[11px] text-slate-500">{rows.length} issue{rows.length === 1 ? '' : 's'}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide">
          {counts.leaveNoTimesheet > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
              {counts.leaveNoTimesheet} leave-no-ts
            </span>
          )}
          {counts.timesheetNoLeave > 0 && (
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200">
              {counts.timesheetNoLeave} ts-no-leave
            </span>
          )}
          {counts.mismatch > 0 && (
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200">
              {counts.mismatch} mismatch
            </span>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
          <thead className="bg-slate-50/40 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/30 dark:text-slate-400">
            <tr>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Issue</th>
              <th className="px-4 py-2">Leave type (application)</th>
              <th className="px-4 py-2">Activity (timesheet)</th>
              <th className="px-4 py-2 text-right">Hours</th>
              <th className="px-4 py-2">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
            {rows.map((r, idx) => (
              <tr key={`${r.date}-${idx}`}>
                <td className="px-4 py-2.5 tabular-nums">{r.date}</td>
                <td className="px-4 py-2.5">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${KIND_TONE[r.kind]}`}>
                    {KIND_LABEL[r.kind]}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  {r.leaveType ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="font-medium">{r.leaveType}</span>
                      {r.leaveStatus === 'pending' && (
                        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                          submitted
                        </span>
                      )}
                      {r.leaveStatus === 'approved' && (
                        <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                          approved
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  {r.timesheetActivity ? (
                    r.kind === 'mismatch' ? (
                      <span className="rounded-md bg-violet-100 px-1.5 py-0.5 font-medium text-violet-800 dark:bg-violet-900/40 dark:text-violet-200">
                        {r.timesheetActivity}
                      </span>
                    ) : (
                      <span className="font-medium">{r.timesheetActivity}</span>
                    )
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {r.timesheetHours > 0 ? r.timesheetHours.toFixed(2) : <span className="text-slate-400">—</span>}
                </td>
                <td className="px-4 py-2.5 text-xs text-slate-600 dark:text-slate-300">{r.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
