import Link from 'next/link'
import { listActiveSalaries } from '@/lib/salary/queries'
import { formatInr } from '@/lib/format'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { ButtonLink } from '@/components/ui/button'
import { Pagination } from '@/components/ui/pagination'

export const metadata = { title: 'Salary Structures' }

type SP = Promise<{ q?: string; page?: string }>

type Row = Awaited<ReturnType<typeof listActiveSalaries>>['rows'][number]
type EmployeeEmbed = { id: string; employee_code: string; full_name_snapshot: string; work_email: string; employment_status: string }

function pickEmployee(e: Row['employee']): EmployeeEmbed | null {
  if (!e) return null
  return Array.isArray(e) ? (e[0] as EmployeeEmbed | undefined) ?? null : (e as unknown as EmployeeEmbed)
}

export default async function SalaryListPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams
  const pageNum = sp.page ? Number(sp.page) : 1
  const { rows, total, page, totalPages } = await listActiveSalaries(sp.q, { page: pageNum })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Salary Structures"
        subtitle={`${total} active ${total === 1 ? 'structure' : 'structures'}`}
        actions={<ButtonLink href="/salary/templates" variant="outline">Manage templates</ButtonLink>}
      />

      <Card className="p-3">
        <form className="flex gap-2">
          <input
            name="q"
            defaultValue={sp.q ?? ''}
            placeholder="Search by employee code, name or email"
            className="h-9 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-950"
          />
          <button className="h-9 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800">
            Search
          </button>
        </form>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
              <tr>
                <Th>Employee</Th>
                <Th>Effective from</Th>
                <Th className="text-right">Fixed CTC / yr</Th>
                <Th className="text-right">Gross / yr</Th>
                <Th className="text-right">Take home / mo</Th>
                <Th className="text-right">Total CTC / yr</Th>
                <Th>{' '}</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-500">
                    No salary structures yet. Add one from an employee&apos;s Salary tab.
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                const emp = pickEmployee(r.employee)
                return (
                  <tr key={r.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-950">
                    <Td>
                      {emp ? (
                        <Link href={`/employees/${emp.id}/salary`} className="font-medium text-slate-900 hover:text-brand-700 hover:underline dark:text-slate-100">
                          {emp.full_name_snapshot}{' '}
                          <span className="text-slate-500">({emp.employee_code})</span>
                        </Link>
                      ) : '—'}
                    </Td>
                    <Td className="tabular-nums">{r.effective_from}</Td>
                    <Td className="text-right tabular-nums">{formatInr(r.annual_fixed_ctc)}</Td>
                    <Td className="text-right tabular-nums">{formatInr(r.annual_gross)}</Td>
                    <Td className="text-right tabular-nums">{formatInr(r.monthly_take_home)}</Td>
                    <Td className="text-right font-semibold tabular-nums">{formatInr(r.annual_total_ctc)}</Td>
                    <Td>
                      {emp && <Link href={`/employees/${emp.id}/salary`} className="text-xs font-medium text-brand-700 hover:underline">Manage →</Link>}
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        basePath="/salary"
        searchParams={sp}
        noun={{ singular: 'structure', plural: 'structures' }}
      />
    </div>
  )
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 ${className}`}>{children}</th>
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-slate-900 dark:text-slate-100 ${className}`}>{children}</td>
}
