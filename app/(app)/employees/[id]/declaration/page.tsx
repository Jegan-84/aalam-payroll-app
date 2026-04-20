import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getEmployee } from '@/lib/employees/queries'
import { getDeclaration } from '@/lib/tax/queries'
import { getFyContext } from '@/lib/leave/queries'
import { createClient } from '@/lib/supabase/server'
import { DeclarationForm } from './_components/declaration-form'
import { resolveFy } from '@/lib/leave/engine'

export const metadata = { title: 'Tax declaration' }

type PP = Promise<{ id: string }>
type SP = Promise<{ fy?: string }>

export default async function DeclarationPage({ params, searchParams }: { params: PP; searchParams: SP }) {
  const { id } = await params
  const sp = await searchParams

  const emp = await getEmployee(id)
  if (!emp) notFound()

  const fy = sp.fy && /^\d{4}-\d{2}-\d{2}$/.test(sp.fy) ? resolveFy(new Date(sp.fy + 'T00:00:00Z'), 4) : await getFyContext()

  const [declaration, activeStructure] = await Promise.all([
    getDeclaration(id, fy.fyStart),
    (async () => {
      const supabase = await createClient()
      const { data } = await supabase
        .from('salary_structures')
        .select('annual_gross, monthly_gross')
        .eq('employee_id', id)
        .is('effective_to', null)
        .eq('status', 'active')
        .maybeSingle()
      return data
    })(),
  ])

  const annualGross = Number(activeStructure?.annual_gross ?? 0)
  const annualBasic = annualGross * 0.5
  const annualHra = annualBasic * 0.5

  const regime = (emp.tax_regime_code as 'NEW' | 'OLD' | null) ?? 'NEW'

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href={`/employees/${id}`} className="text-sm text-slate-500 hover:underline">← Employee</Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Tax declaration — {emp.full_name_snapshot}{' '}
            <span className="text-base font-normal text-slate-500">({emp.employee_code})</span>
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            FY {fy.label} · Regime: <strong>{regime}</strong> ·
            {declaration ? ` Status: ${declaration.status}` : ' No declaration yet'}
          </p>
        </div>
      </div>

      <DeclarationForm
        employeeId={id}
        fyStart={fy.fyStart}
        fyEnd={fy.fyEnd}
        fyLabel={fy.label}
        annualBasic={annualBasic}
        annualHra={annualHra}
        regime={regime}
        defaults={declaration ?? undefined}
        locked={declaration?.status === 'approved'}
      />
    </div>
  )
}
