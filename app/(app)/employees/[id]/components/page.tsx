import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getEmployee } from '@/lib/employees/queries'
import { listEmployeeComponents } from '@/lib/components/queries'
import { formatInr } from '@/lib/format'

export const metadata = { title: 'Recurring pay components' }

type PP = Promise<{ id: string }>

export default async function EmployeeComponentsPage({ params }: { params: PP }) {
  const { id } = await params
  const [emp, rows] = await Promise.all([getEmployee(id), listEmployeeComponents(id)])
  if (!emp) notFound()

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <Link href={`/employees/${id}`} className="text-sm text-slate-500 hover:underline">← Employee</Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Recurring components — {emp.full_name_snapshot}{' '}
            <span className="text-base font-normal text-slate-500">({emp.employee_code})</span>
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Standing earnings or deductions that auto-apply every payroll cycle (e.g. shift allowance, lunch deduction).
          </p>
        </div>
        <Link href={`/employees/${id}/components/new`} className="inline-flex h-9 items-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200">
          New component
        </Link>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950 dark:text-slate-400">
            <tr>
              <Th>Code</Th>
              <Th>Name</Th>
              <Th>Kind</Th>
              <Th className="text-right">Monthly</Th>
              <Th>Prorate</Th>
              <Th>Effective from</Th>
              <Th>Effective to</Th>
              <Th>Status</Th>
              <Th>{' '}</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
            {rows.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                No components. Add one with <strong>New component</strong>.
              </td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-950">
                <Td className="font-medium">{r.code}</Td>
                <Td>{r.name}</Td>
                <Td>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${r.kind === 'earning' ? 'bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'}`}>
                    {r.kind}
                  </span>
                </Td>
                <Td className="text-right tabular-nums">{formatInr(r.monthly_amount)}</Td>
                <Td>{r.prorate ? 'yes' : 'no'}</Td>
                <Td>{r.effective_from}</Td>
                <Td>{r.effective_to ?? '—'}</Td>
                <Td>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${r.is_active ? 'bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300' : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
                    {r.is_active ? 'active' : 'inactive'}
                  </span>
                </Td>
                <Td>
                  <Link href={`/employees/${id}/components/${r.id}`} className="text-xs underline">Edit</Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 font-medium ${className}`}>{children}</th>
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-slate-900 dark:text-slate-100 ${className}`}>{children}</td>
}
