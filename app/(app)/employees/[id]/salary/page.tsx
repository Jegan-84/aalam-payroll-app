import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getEmployee } from '@/lib/employees/queries'
import {
  getEmployeeSalaryHistory,
  getOrgPtState,
  getPtSlabs,
  getStatutoryConfig,
} from '@/lib/salary/queries'
import { listTemplates } from '@/lib/salary-templates/queries'
import { getTaxSlabsForFy } from '@/lib/payroll/queries'
import { getFyContext } from '@/lib/leave/queries'
import { getApprovedDeclaration } from '@/lib/tax/queries'
import { formatInr } from '@/lib/format'
import { NewStructureForm, type CurrentStructureSeed, type TemplateOption } from './_components/new-structure-form'

type PP = Promise<{ id: string }>

export async function generateMetadata({ params }: { params: PP }) {
  const { id } = await params
  const emp = await getEmployee(id)
  return { title: emp ? `Salary — ${emp.employee_code}` : 'Salary' }
}

export default async function EmployeeSalaryPage({ params }: { params: PP }) {
  const { id } = await params
  const emp = await getEmployee(id)
  if (!emp) notFound()

  const [history, statutory, ptState, rawTemplates, fy] = await Promise.all([
    getEmployeeSalaryHistory(id),
    getStatutoryConfig(),
    getOrgPtState(),
    listTemplates({ activeOnly: true }),
    getFyContext(),
  ])
  const [ptSlabs, newTax, oldTax, declaration] = await Promise.all([
    getPtSlabs(ptState),
    getTaxSlabsForFy(fy.fyStart, 'NEW'),
    getTaxSlabsForFy(fy.fyStart, 'OLD'),
    getApprovedDeclaration(id, fy.fyStart),
  ])
  const templates: TemplateOption[] = rawTemplates.map((t) => ({
    id: t.id,
    code: t.code,
    name: t.name,
    employment_type: t.employment_type,
    annual_fixed_ctc: Number(t.annual_fixed_ctc),
    variable_pay_percent: Number(t.variable_pay_percent),
    medical_insurance_monthly: Number(t.medical_insurance_monthly),
    internet_annual: Number(t.internet_annual),
    training_annual: Number(t.training_annual),
    epf_mode: t.epf_mode,
  }))

  const today = new Date().toISOString().slice(0, 10)

  const activeHist = history.find((r) => r.effective_to === null && r.status === 'active') ?? history[0] ?? null
  type HistoryRow = typeof history[number] & {
    medical_insurance_monthly?: number
    internet_annual?: number
    training_annual?: number
  }
  const currentStructure: CurrentStructureSeed | null = activeHist
    ? {
        annual_fixed_ctc: Number(activeHist.annual_fixed_ctc),
        variable_pay_percent: 10,
        medical_insurance_monthly: Number((activeHist as HistoryRow).medical_insurance_monthly ?? 500),
        internet_annual: Number((activeHist as HistoryRow).internet_annual ?? 12000),
        training_annual: Number((activeHist as HistoryRow).training_annual ?? 12000),
        epf_mode: (activeHist.epf_mode as 'ceiling' | 'fixed_max' | 'actual') ?? 'ceiling',
      }
    : null

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/employees/${id}`} className="text-sm text-slate-500 hover:underline">
          ← Employee
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
          Salary — {emp.full_name_snapshot}{' '}
          <span className="text-base font-normal text-slate-500">({emp.employee_code})</span>
        </h1>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-50">History</h2>
        {history.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            No salary structure yet. Fill out the form below to create the first one.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm dark:divide-slate-800">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="py-2 pr-4 font-medium">Effective from</th>
                  <th className="py-2 pr-4 font-medium">Effective to</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 text-right font-medium">Fixed CTC / yr</th>
                  <th className="py-2 pr-4 text-right font-medium">Gross / yr</th>
                  <th className="py-2 pr-4 text-right font-medium">Take home / mo</th>
                  <th className="py-2 pr-4 text-right font-medium">Total CTC / yr</th>
                  <th className="py-2 pr-4 font-medium">EPF mode</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {history.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 pr-4">{r.effective_from}</td>
                    <td className="py-2 pr-4">{r.effective_to ?? '—'}</td>
                    <td className="py-2 pr-4">
                      <span
                        className={
                          'inline-flex rounded-full px-2 py-0.5 text-xs font-medium ' +
                          (r.status === 'active' && !r.effective_to
                            ? 'bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300'
                            : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300')
                        }
                      >
                        {r.effective_to ? 'superseded' : r.status}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">{formatInr(r.annual_fixed_ctc)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{formatInr(r.annual_gross)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{formatInr(r.monthly_take_home)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums font-medium">{formatInr(r.annual_total_ctc)}</td>
                    <td className="py-2 pr-4">{r.epf_mode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-50">
          {history.length === 0 ? 'Create first structure' : 'New version (supersedes current)'}
        </h2>
        <NewStructureForm
          employeeId={id}
          employeeName={emp.full_name_snapshot}
          statutory={statutory}
          ptSlabs={ptSlabs}
          ptState={ptState}
          suggestedEffectiveFrom={today}
          templates={templates}
          currentStructure={currentStructure}
          currentRegime={((emp.tax_regime_code as 'NEW' | 'OLD' | null) ?? 'NEW')}
          fyLabel={fy.label}
          newTaxBundle={newTax}
          oldTaxBundle={oldTax}
          declaration={declaration}
        />
      </section>
    </div>
  )
}
