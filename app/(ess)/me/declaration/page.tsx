import { notFound } from 'next/navigation'
import { getCurrentEmployee } from '@/lib/auth/dal'
import { getEmployee } from '@/lib/employees/queries'
import { getDeclaration } from '@/lib/tax/queries'
import { getFyContext } from '@/lib/leave/queries'
import { listEmployeePoi } from '@/lib/poi/queries'
import { createClient } from '@/lib/supabase/server'
import { DeclarationForm } from '@/app/(app)/employees/[id]/declaration/_components/declaration-form'
import { PoiPanel } from './_components/poi-panel'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardBody } from '@/components/ui/card'

export const metadata = { title: 'My Tax Declaration' }

export default async function MyDeclarationPage() {
  const { employeeId } = await getCurrentEmployee()
  const fy = await getFyContext()

  const [emp, declaration, activeStructure, poiDocs] = await Promise.all([
    getEmployee(employeeId),
    getDeclaration(employeeId, fy.fyStart),
    (async () => {
      const supabase = await createClient()
      const { data } = await supabase
        .from('salary_structures')
        .select('annual_gross, monthly_gross')
        .eq('employee_id', employeeId)
        .is('effective_to', null)
        .eq('status', 'active')
        .maybeSingle()
      return data
    })(),
    listEmployeePoi(employeeId, fy.fyStart),
  ])
  if (!emp) notFound()

  const annualGross = Number(activeStructure?.annual_gross ?? 0)
  const annualBasic = annualGross * 0.5
  const annualHra = annualBasic * 0.5

  const regime = (emp.tax_regime_code as 'NEW' | 'OLD' | null) ?? 'NEW'

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tax Declaration"
        subtitle={`FY ${fy.label} · Regime: ${regime} · ${declaration ? `Status: ${declaration.status}` : 'No declaration yet'}`}
      />

      {regime === 'NEW' && (
        <Card>
          <CardBody>
            <p className="text-sm text-amber-800 dark:text-amber-200">
              You are on the <strong>NEW regime</strong>. HRA, 80C, 80D, and home-loan deductions do not apply —
              only a flat standard deduction is available. You can still save a declaration on record, but it won&apos;t change your TDS.
              Contact HR to switch regimes before filling this in.
            </p>
          </CardBody>
        </Card>
      )}

      <DeclarationForm
        employeeId={employeeId}
        fyStart={fy.fyStart}
        fyEnd={fy.fyEnd}
        fyLabel={fy.label}
        annualBasic={annualBasic}
        annualHra={annualHra}
        regime={regime}
        defaults={declaration ?? undefined}
        locked={declaration?.status === 'approved'}
      />

      <PoiPanel
        fyStart={fy.fyStart}
        fyLabel={fy.label}
        readonly={declaration?.status === 'approved'}
        docs={poiDocs}
      />

      {declaration && (declaration.status === 'submitted' || declaration.status === 'approved') && (
        <Card>
          <CardBody>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Download Form 12BB</span>
              <a
                href={`/api/form12bb/${employeeId}/${fy.fyStart}`}
                target="_blank"
                rel="noopener"
                className="inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
              >
                Form 12BB · FY {fy.label}
              </a>
              <p className="text-xs text-slate-500">
                Print, sign, and keep a copy. HR may ask for supporting proofs (rent receipts, 80C certificates) separately.
              </p>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  )
}
