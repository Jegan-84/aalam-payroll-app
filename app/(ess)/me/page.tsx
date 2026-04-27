import Link from 'next/link'
import { getCurrentEmployee } from '@/lib/auth/dal'
import { getEmployee } from '@/lib/employees/queries'
import { listEmployeePayslips } from '@/lib/payroll/ess-queries'
import { getEmployeeFyBalances, getFyContext, getLeaveTypes } from '@/lib/leave/queries'
import { resolveLeaveYear } from '@/lib/leave/year'
import { listEmployeeLoans } from '@/lib/loans/queries'
import { getDeclaration } from '@/lib/tax/queries'
import {
  getUpcomingHolidays,
  getUpcomingBirthdays,
  getExpiringCompOff,
} from '@/lib/dashboard/queries'
import {
  UpcomingHolidaysCard,
  UpcomingBirthdaysCard,
  ExpiringCompOffCard,
} from '@/components/dashboard/widgets'
import { MONTH_NAMES } from '@/lib/attendance/engine'
import { formatInr } from '@/lib/format'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Stat } from '@/components/ui/stat'
import { PageHeader } from '@/components/ui/page-header'
import { notFound } from 'next/navigation'

export const metadata = { title: 'My Portal' }

export default async function EssHome() {
  const { employeeId } = await getCurrentEmployee()
  const fy = await getFyContext()            // Apr–Mar (tax / TDS / declarations)
  const ly = resolveLeaveYear()               // Jan–Dec (leave balances only)

  const [emp, payslips, balances, leaveTypes, loans, declaration, holidays, birthdays, compOffExpiring] = await Promise.all([
    getEmployee(employeeId),
    listEmployeePayslips(employeeId),
    getEmployeeFyBalances(employeeId, ly.yearStart),
    getLeaveTypes(),
    listEmployeeLoans(employeeId),
    getDeclaration(employeeId, fy.fyStart),
    getUpcomingHolidays({ employeeId, windowDays: 90, limit: 5 }),
    getUpcomingBirthdays({ windowDays: 30, limit: 6 }),
    getExpiringCompOff(employeeId, 14),
  ])
  if (!emp) notFound()

  const latestPayslip = payslips[0]
  const activeLoan = loans.find((l) => l.status === 'active')
  const totalOutstanding = loans
    .filter((l) => l.status === 'active')
    .reduce((s, l) => s + Number(l.outstanding_balance), 0)

  const leaveByType = new Map(leaveTypes.map((lt) => [lt.id, lt.code]))
  const ytdTds = payslips.reduce((s, p) => s + p.monthly_tds, 0)
  const ytdNet = payslips.reduce((s, p) => s + p.net_pay, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Hi, ${(emp.first_name as string | null) ?? emp.full_name_snapshot.split(' ')[0]} 👋`}
        subtitle={`${emp.employee_code} · ${emp.full_name_snapshot}`}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          tone="brand"
          label="Last payslip"
          value={latestPayslip ? formatInr(latestPayslip.net_pay) : '—'}
        />
        <Stat
          label="FY net paid"
          value={formatInr(ytdNet)}
        />
        <Stat
          label="FY TDS"
          value={formatInr(ytdTds)}
        />
        <Stat
          label="Loan outstanding"
          value={activeLoan ? formatInr(totalOutstanding) : '—'}
        />
      </div>

      {compOffExpiring.length > 0 && (
        <ExpiringCompOffCard grants={compOffExpiring} applyHref="/me/leave/new" />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <UpcomingHolidaysCard holidays={holidays} viewAllHref="/me/holidays" />
        <UpcomingBirthdaysCard birthdays={birthdays} viewerEmployeeId={employeeId} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent payslips</CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            {payslips.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">No payslips yet. They appear here once your payroll cycle is approved.</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {payslips.slice(0, 4).map((p) => (
                  <li key={p.cycle_id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {MONTH_NAMES[p.month - 1]} {p.year}
                      </div>
                      <div className="text-xs text-slate-500">
                        {Number(p.paid_days).toFixed(1)} paid days · TDS {formatInr(p.monthly_tds)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatInr(p.net_pay)}</div>
                      <a
                        href={`/api/payslip/${p.cycle_id}/${employeeId}`}
                        target="_blank"
                        rel="noopener"
                        className="text-xs font-medium text-brand-700 hover:underline"
                      >
                        Download PDF
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {payslips.length > 4 && (
              <div className="border-t border-slate-100 p-3 text-right dark:border-slate-800">
                <Link href="/me/payslips" className="text-sm font-medium text-brand-700 hover:underline">
                  View all payslips →
                </Link>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Leave balances · {ly.label}</CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            {balances.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">No leave balances yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {balances.map((b) => {
                  const code = leaveByType.get(b.leave_type_id) ?? '—'
                  return (
                    <li key={b.id || `${b.leave_type_id}`} className="flex items-center justify-between px-4 py-3">
                      <Badge tone="brand">{code}</Badge>
                      <div className="text-right">
                        <div className="text-sm font-semibold tabular-nums">
                          {Number(b.current_balance).toFixed(1)} days
                        </div>
                        <div className="text-[11px] text-slate-500">
                          used {Number(b.used).toFixed(1)} · opening {Number(b.opening_balance + b.carried_forward).toFixed(1)}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
            <div className="border-t border-slate-100 p-3 text-right dark:border-slate-800">
              <Link href="/me/leave" className="text-sm font-medium text-brand-700 hover:underline">
                Apply for leave · history →
              </Link>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Tax declaration</CardTitle></CardHeader>
          <CardBody>
            {declaration ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-500">Regime:</span>
                  <span className="font-medium">{declaration.regime}</span>
                  <span className="text-slate-500">·</span>
                  <Badge tone={declaration.status === 'approved' ? 'success' : declaration.status === 'submitted' ? 'info' : declaration.status === 'rejected' ? 'danger' : 'warn'}>
                    {declaration.status}
                  </Badge>
                </div>
                <Link href="/me/declaration" className="text-sm font-medium text-brand-700 hover:underline">
                  View / edit →
                </Link>
              </div>
            ) : (
              <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <p>No declaration yet for FY {fy.label}. Submit your tax declaration to claim HRA, 80C, 80D, and other deductions under the OLD regime.</p>
                <Link href="/me/declaration" className="inline-block text-sm font-medium text-brand-700 hover:underline">
                  Start declaration →
                </Link>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Loans</CardTitle></CardHeader>
          <CardBody>
            {loans.length === 0 ? (
              <p className="text-sm text-slate-500">No loans. If you take a company loan, EMIs appear here and auto-deduct from your salary.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {loans.slice(0, 3).map((l) => (
                  <li key={l.id} className="flex items-center justify-between">
                    <span className="capitalize">{l.loan_type}</span>
                    <span className="tabular-nums">
                      {formatInr(l.outstanding_balance)}{' '}
                      <Badge tone={l.status === 'active' ? 'info' : l.status === 'closed' ? 'success' : 'neutral'}>
                        {l.status.replace('_', ' ')}
                      </Badge>
                    </span>
                  </li>
                ))}
                <li className="pt-1 text-right">
                  <Link href="/me/loans" className="text-xs font-medium text-brand-700 hover:underline">
                    View all →
                  </Link>
                </li>
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
