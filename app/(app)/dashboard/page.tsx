import Link from 'next/link'
import { getUserWithRoles } from '@/lib/auth/dal'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/page-header'
import { Stat } from '@/components/ui/stat'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { ButtonLink } from '@/components/ui/button'
import { formatInr } from '@/lib/format'

export const metadata = { title: 'Dashboard — PayFlow' }

export default async function DashboardPage() {
  const me = await getUserWithRoles()
  const supabase = await createClient()

  // Pull some headline counts — all soft (no throws on empty tables)
  const [employeesCount, companiesCount, activeStructures, latestCycle] = await Promise.all([
    supabase.from('employees').select('id', { count: 'exact', head: true }).eq('employment_status', 'active'),
    supabase.from('companies').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('salary_structures').select('id', { count: 'exact', head: true }).is('effective_to', null).eq('status', 'active'),
    supabase.from('payroll_cycles').select('id, year, month, status, employee_count, total_net_pay, total_employer_cost').order('year', { ascending: false }).order('month', { ascending: false }).limit(1).maybeSingle(),
  ])

  const cycle = latestCycle.data as { id: string; year: number; month: number; status: string; employee_count: number; total_net_pay: number; total_employer_cost: number } | null
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome${me.fullName ? `, ${me.fullName.split(' ')[0]}` : ''}`}
        subtitle="Your payroll console. Open a cycle, review employees, or jump into reports."
        actions={
          <>
            <ButtonLink href="/payroll" variant="outline" size="md">Open payroll</ButtonLink>
            <ButtonLink href="/employees/new" variant="primary" size="md">+ Add employee</ButtonLink>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat tone="brand" label="Active employees" value={employeesCount.count ?? 0} hint="employment_status = active" />
        <Stat label="Companies" value={companiesCount.count ?? 0} hint="legal / brand entities" />
        <Stat label="Salary structures" value={activeStructures.count ?? 0} hint="currently effective" />
        <Stat
          tone={cycle?.status === 'locked' || cycle?.status === 'paid' ? 'brand' : 'warn'}
          label="Latest cycle"
          value={cycle ? `${months[cycle.month - 1]} ${cycle.year}` : '—'}
          hint={cycle ? `status: ${cycle.status}` : 'no cycles yet'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Latest payroll cycle</CardTitle></CardHeader>
          <CardBody>
            {cycle ? (
              <div className="grid grid-cols-3 gap-4">
                <MiniStat label="Employees processed" value={String(cycle.employee_count)} />
                <MiniStat label="Total net pay" value={formatInr(cycle.total_net_pay)} />
                <MiniStat label="Employer cost" value={formatInr(cycle.total_employer_cost)} />
                <div className="col-span-3 flex gap-2 pt-2">
                  <ButtonLink href={`/payroll/${cycle.id}`} variant="primary" size="sm">Open {months[cycle.month - 1]} {cycle.year}</ButtonLink>
                  <ButtonLink href={`/api/payslip/${cycle.id}/bulk`} variant="outline" size="sm">Download all payslips (ZIP)</ButtonLink>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-start gap-3">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  You haven&apos;t run payroll yet. Open the first cycle for the current month — takes under a minute.
                </p>
                <ButtonLink href="/payroll" variant="primary" size="sm">Open payroll</ButtonLink>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Quick links</CardTitle></CardHeader>
          <CardBody>
            <ul className="space-y-2 text-sm">
              <QL href="/employees"          label="Manage employees" />
              <QL href="/salary/templates"   label="Salary templates" />
              <QL href="/attendance"         label="Attendance grid" />
              <QL href="/leave/balances"     label="Leave balances" />
              <QL href="/declarations"       label="Tax declarations (HR)" />
              <QL href="/settings/companies" label="Company settings" />
            </ul>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Your profile</CardTitle></CardHeader>
        <CardBody>
          <div className="grid gap-3 sm:grid-cols-3">
            <Fact label="Name" value={me.fullName ?? '—'} />
            <Fact label="Email" value={me.email} />
            <Fact label="Roles" value={me.roles.length ? me.roles.join(', ') : 'none'} />
          </div>
        </CardBody>
      </Card>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-50">{value}</div>
    </div>
  )
}

function QL({ href, label }: { href: string; label: string }) {
  return (
    <li>
      <Link href={href} className="group flex items-center justify-between rounded-md px-2 py-1.5 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800">
        <span className="text-slate-700 group-hover:text-slate-900 dark:text-slate-300 dark:group-hover:text-slate-100">{label}</span>
        <span className="text-slate-400 group-hover:text-brand-600">→</span>
      </Link>
    </li>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-0.5 text-sm font-medium text-slate-900 dark:text-slate-100">{value}</div>
    </div>
  )
}
