import { getBalancesForFy, getFyContext, getLeaveTypes } from '@/lib/leave/queries'
import { createClient } from '@/lib/supabase/server'
import { SeedFyButton } from './_components/seed-fy-button'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'

export const metadata = { title: 'Leave balances' }

type SP = Promise<{ fy?: string }>

export default async function LeaveBalancesPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams
  const fy = sp.fy ? await resolveFyByStart(sp.fy) : await getFyContext()

  const [balances, leaveTypes, employees] = await Promise.all([
    getBalancesForFy(fy.fyStart),
    getLeaveTypes(),
    (async () => {
      const supabase = await createClient()
      const { data } = await supabase
        .from('employees')
        .select('id, employee_code, full_name_snapshot, employment_status')
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
        title={`Leave balances — FY ${fy.label}`}
        back={{ href: '/leave', label: 'Leave' }}
        subtitle={`${fy.fyStart} → ${fy.fyEnd}. Balance = opening + accrued + carry-fwd − used − encashed + adjustment.`}
        actions={<SeedFyButton fyStart={fy.fyStart} fyLabel={fy.label} />}
      />

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
                    return (
                      <Td key={lt.id} className="text-right">
                        <div className={`font-semibold tabular-nums ${current < 0 ? 'text-red-700 dark:text-red-400' : 'text-slate-900 dark:text-slate-100'}`}>
                          {current.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          used {Number(b?.used ?? 0).toFixed(2)} / opening {Number(b?.opening_balance ?? 0).toFixed(2)}
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

async function resolveFyByStart(fyStartIso: string) {
  const d = new Date(fyStartIso + 'T00:00:00Z')
  return getFyContext(d)
}
