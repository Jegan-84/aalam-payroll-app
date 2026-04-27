import { getBalancesForFy, getLeaveTypes } from '@/lib/leave/queries'
import { resolveLeaveYear } from '@/lib/leave/year'
import { createClient } from '@/lib/supabase/server'
import { SeedFyButton } from './_components/seed-fy-button'
import { CompOffGrantForm } from './_components/comp-off-grant'
import { YearEndButton } from './_components/year-end-button'
import { AdjustBalanceCell } from './_components/adjust-balance'
import { JoinerAllocationCard } from './_components/joiner-allocation'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'

export const metadata = { title: 'Leave balances' }

type SP = Promise<{ fy?: string }>

export default async function LeaveBalancesPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams
  const fy = sp.fy ? resolveLeaveYear(new Date(sp.fy + 'T00:00:00Z')) : resolveLeaveYear()

  const [balances, leaveTypes, employees] = await Promise.all([
    getBalancesForFy(fy.yearStart),
    getLeaveTypes(),
    (async () => {
      const supabase = await createClient()
      const { data } = await supabase
        .from('employees')
        .select('id, employee_code, full_name_snapshot, employment_status, date_of_joining')
        .order('full_name_snapshot')
      return data ?? []
    })(),
  ])

  type Bal = typeof balances[number]
  const byEmpType = new Map<string, Bal>()
  for (const b of balances) byEmpType.set(`${b.employee_id}:${b.leave_type_id}`, b)

  const paidTypes = leaveTypes.filter((t) => t.is_paid)

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Leave balances — ${fy.label}`}
        back={{ href: '/leave', label: 'Leave' }}
        subtitle={`${fy.yearStart} → ${fy.yearEnd}. Balance = opening + accrued + carry-fwd − used − encashed + adjustment.`}
        actions={<SeedFyButton fyStart={fy.yearStart} fyLabel={fy.label} />}
      />

      <JoinerAllocationCard
        employees={employees as unknown as { id: string; employee_code: string; full_name_snapshot: string; date_of_joining: string | null }[]}
        leaveTypes={leaveTypes.map((lt) => ({ id: lt.id, code: lt.code, name: lt.name }))}
        fyStart={fy.yearStart}
        fyLabel={fy.label}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <CompOffGrantForm employees={employees as unknown as { id: string; employee_code: string; full_name_snapshot: string }[]} />
        <YearEndButton currentYear={new Date().getUTCFullYear()} />
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
              <tr>
                <Th>Employee</Th>
                {paidTypes.map((lt) => <Th key={lt.id} className="text-right">{lt.code}</Th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {employees.length === 0 && (
                <tr><td colSpan={paidTypes.length + 1} className="px-6 py-12 text-center text-sm text-slate-500">No employees.</td></tr>
              )}
              {employees.map((e) => (
                <tr key={e.id as string} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-950">
                  <Td>
                    <span className="font-medium text-slate-900 dark:text-slate-100">{e.full_name_snapshot as string}</span>{' '}
                    <span className="text-slate-500">({e.employee_code as string})</span>
                  </Td>
                  {paidTypes.map((lt) => {
                    const b = byEmpType.get(`${e.id}:${lt.id}`)
                    const current = b ? Number(b.current_balance) : 0
                    const adj = Number(b?.adjustment ?? 0)
                    return (
                      <Td key={lt.id} className="text-right">
                        <div className={`font-semibold tabular-nums ${current < 0 ? 'text-red-700 dark:text-red-400' : 'text-slate-900 dark:text-slate-100'}`}>
                          {current.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          used {Number(b?.used ?? 0).toFixed(2)} / opening {Number(b?.opening_balance ?? 0).toFixed(2)}
                          {adj !== 0 && (
                            <span className={adj > 0 ? ' text-green-700 dark:text-green-400' : ' text-red-700 dark:text-red-400'}>
                              {' '}· adj {adj > 0 ? '+' : ''}{adj.toFixed(2)}
                            </span>
                          )}
                        </div>
                        <div className="mt-1">
                          <AdjustBalanceCell
                            employeeId={e.id as string}
                            employeeLabel={`${e.full_name_snapshot} (${e.employee_code})` as string}
                            leaveTypeId={lt.id}
                            leaveTypeCode={lt.code}
                            fyStart={fy.yearStart}
                            current={{
                              opening_balance: Number(b?.opening_balance ?? 0),
                              accrued: Number(b?.accrued ?? 0),
                              carried_forward: Number(b?.carried_forward ?? 0),
                              used: Number(b?.used ?? 0),
                              encashed: Number(b?.encashed ?? 0),
                              adjustment: adj,
                            }}
                          />
                        </div>
                      </Td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 ${className}`}>{children}</th>
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-slate-900 dark:text-slate-100 ${className}`}>{children}</td>
}

