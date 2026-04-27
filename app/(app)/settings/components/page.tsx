import Link from 'next/link'
import { listCustomComponents } from '@/lib/pay-components/queries'
import { getStatutoryConfig } from '@/lib/salary/queries'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ButtonLink } from '@/components/ui/button'

export const metadata = { title: 'Custom Pay Components' }

const KIND_LABEL: Record<string, string> = {
  earning: 'Earning',
  deduction: 'Deduction',
  employer_retiral: 'Employer retiral',
  reimbursement: 'Reimbursement',
}

const CALC_LABEL: Record<string, string> = {
  fixed: 'Fixed',
  percent_of_basic: '% of Basic',
  percent_of_gross: '% of Gross',
  formula: 'Formula',
}

type SystemRow = { code: string; name: string; kind: string; formula: string; configuredAt: string }

export default async function CustomComponentsPage() {
  const [rows, stat] = await Promise.all([listCustomComponents(), getStatutoryConfig()])

  const systemRows: SystemRow[] = [
    { code: 'BASIC',     name: 'Basic',              kind: 'earning',          formula: `${stat.basic_percent_of_gross}% of Gross`,                                   configuredAt: '/settings/statutory' },
    { code: 'HRA',       name: 'HRA',                kind: 'earning',          formula: `${stat.hra_percent_of_basic}% of Basic`,                                     configuredAt: '/settings/statutory' },
    { code: 'CONV',      name: 'Conveyance',         kind: 'earning',          formula: `min(${stat.conv_percent_of_basic}% of Basic, ₹${stat.conv_monthly_cap}/mo)`, configuredAt: '/settings/statutory' },
    { code: 'OTHERALLOW',name: 'Other Allowance',    kind: 'earning',          formula: 'Balancing figure (Gross − Basic − HRA − Conv)',                              configuredAt: 'Code' },
    { code: 'INTERNET',  name: 'Internet',           kind: 'earning',          formula: 'Per employee — from Salary Structure',                                        configuredAt: '/employees (per structure)' },
    { code: 'INCENTIVE', name: 'Incentive',          kind: 'earning',          formula: 'Default ₹0 — set via Adjustments per cycle',                                  configuredAt: 'Adjustments panel' },
    { code: 'SHIFT',     name: 'Shift Allowance',    kind: 'earning',          formula: 'Per employee — shift_allowance_monthly (prorated)',                           configuredAt: '/employees (per employee)' },
    { code: 'VP',        name: 'Variable Pay',       kind: 'earning',          formula: 'Once-a-year — cycle toggle + per-employee %/₹',                               configuredAt: 'Payroll cycle + per structure' },
    { code: 'PF_EE',     name: 'PF (Employee)',      kind: 'deduction',        formula: `${stat.epf_employee_percent}% × min(Basic, ₹${stat.epf_wage_ceiling})`,       configuredAt: '/settings/statutory' },
    { code: 'ESI_EE',    name: 'ESI (Employee)',     kind: 'deduction',        formula: `${stat.esi_employee_percent}% × Gross (if Gross ≤ ₹${stat.esi_wage_ceiling})`, configuredAt: '/settings/statutory' },
    { code: 'PT',        name: 'Professional Tax',   kind: 'deduction',        formula: 'State slab ÷ 6',                                                               configuredAt: '/settings/pt' },
    { code: 'TDS',       name: 'TDS',                kind: 'deduction',        formula: 'Annual tax ÷ 12 + VP / perquisite spikes',                                    configuredAt: '/settings/tax' },
    { code: 'LUNCH',     name: 'Lunch Deduction',    kind: 'deduction',        formula: 'Flat ₹250 (when lunch_applicable)',                                            configuredAt: '/employees (per employee)' },
    { code: 'PF_ER',     name: 'PF (Employer)',      kind: 'employer_retiral', formula: `${stat.epf_employer_percent}% × min(Basic, ₹${stat.epf_wage_ceiling})`,       configuredAt: '/settings/statutory' },
    { code: 'ESI_ER',    name: 'ESI (Employer)',     kind: 'employer_retiral', formula: `${stat.esi_employer_percent}% × Gross (if Gross ≤ ₹${stat.esi_wage_ceiling})`, configuredAt: '/settings/statutory' },
    { code: 'GRATUITY',  name: 'Gratuity',           kind: 'employer_retiral', formula: `${stat.gratuity_percent}% × Basic`,                                          configuredAt: '/settings/statutory' },
    { code: 'MEDINS',    name: 'Medical Insurance',  kind: 'employer_retiral', formula: 'Per employee — medical_insurance_monthly',                                    configuredAt: '/employees (per structure)' },
    { code: 'TRAINING',  name: 'Training',           kind: 'reimbursement',    formula: 'Per employee — training_annual / 12',                                         configuredAt: '/employees (per structure)' },
    { code: 'LOAN_*',    name: 'Loan EMI',           kind: 'deduction',        formula: 'Per active loan — min(EMI, outstanding)',                                     configuredAt: '/employees/*/loans' },
    { code: 'PERQ_*',    name: 'Loan Perquisite',    kind: 'perquisite',       formula: 'Outstanding × (SBI rate − actual rate) ÷ 12 (if outstanding > ₹20k)',          configuredAt: '/settings/statutory (SBI rate)' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Custom Pay Components"
        back={{ href: '/settings', label: 'Settings' }}
        subtitle="Add org-wide earnings, deductions, retirals, or reimbursements that the statutory engine doesn't cover. System components (BASIC, HRA, PF, etc.) are fixed in code."
        actions={<ButtonLink href="/settings/components/new" variant="primary">+ New component</ButtonLink>}
      />

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
              <tr>
                <Th>Code</Th>
                <Th>Name</Th>
                <Th>Kind</Th>
                <Th>Calculation</Th>
                <Th className="text-right">Value</Th>
                <Th className="text-right">Cap</Th>
                <Th className="text-right">Order</Th>
                <Th>Flags</Th>
                <Th>{' '}</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-sm text-slate-500">
                    No custom components yet. Use <strong>+ New component</strong> to add one (e.g. night-shift allowance, canteen deduction).
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className={`transition-colors hover:bg-slate-50 dark:hover:bg-slate-950 ${r.is_active ? '' : 'opacity-60'}`}>
                  <Td className="font-mono text-xs">{r.code}</Td>
                  <Td>{r.name}</Td>
                  <Td><Badge tone={r.kind === 'earning' ? 'success' : r.kind === 'deduction' ? 'danger' : 'neutral'}>{KIND_LABEL[r.kind] ?? r.kind}</Badge></Td>
                  <Td>{CALC_LABEL[r.calculation_type] ?? r.calculation_type}</Td>
                  <Td className="text-right tabular-nums">
                    {r.calculation_type === 'fixed' && r.cap_amount != null ? `₹ ${r.cap_amount}` :
                      r.calculation_type.startsWith('percent') ? `${r.percent_value ?? 0}%` :
                      r.calculation_type === 'formula' ? <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400">{r.formula}</span> : '—'}
                  </Td>
                  <Td className="text-right tabular-nums">{r.cap_amount != null && r.calculation_type !== 'fixed' ? `₹ ${r.cap_amount}` : '—'}</Td>
                  <Td className="text-right tabular-nums">{r.display_order}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1 text-[10px]">
                      {!r.is_active && <Badge tone="neutral">inactive</Badge>}
                      {r.prorate && <Badge tone="info">prorate</Badge>}
                      {r.taxable && <Badge tone="warn">taxable</Badge>}
                      {r.include_in_gross && <Badge tone="brand">in gross</Badge>}
                    </div>
                  </Td>
                  <Td><Link href={`/settings/components/${r.id}`} className="text-xs font-medium text-brand-700 hover:underline">Edit →</Link></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">System components (read-only)</h2>
          <span className="text-xs text-slate-500">Click <strong>Configure here →</strong> to adjust the right setting</span>
        </div>
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
              <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
                <tr>
                  <Th>Code</Th>
                  <Th>Name</Th>
                  <Th>Kind</Th>
                  <Th>Current rule</Th>
                  <Th>Configure here</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
                {systemRows.map((r) => {
                  const isLink = r.configuredAt.startsWith('/')
                  return (
                    <tr key={r.code} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-950">
                      <Td className="font-mono text-xs">{r.code}</Td>
                      <Td>{r.name}</Td>
                      <Td><Badge tone={r.kind === 'earning' ? 'success' : r.kind === 'deduction' ? 'danger' : r.kind === 'perquisite' ? 'warn' : 'neutral'}>{r.kind.replace('_', ' ')}</Badge></Td>
                      <Td className="text-xs text-slate-700 dark:text-slate-300">{r.formula}</Td>
                      <Td>
                        {isLink ? (
                          <Link href={r.configuredAt} className="text-xs font-medium text-brand-700 hover:underline">
                            {r.configuredAt} →
                          </Link>
                        ) : (
                          <span className="text-xs text-slate-500">{r.configuredAt}</span>
                        )}
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card>
        <div className="p-4 text-xs text-slate-600 dark:text-slate-400">
          <p className="mb-2 font-semibold text-slate-900 dark:text-slate-50">How custom components work</p>
          <ul className="ml-4 list-disc space-y-1">
            <li>Applied to every active employee on every cycle — use the per-employee Recurring Components tab (via employee profile) for employee-specific lines.</li>
            <li>Evaluated <strong>after</strong> statutory components — formulas can reference <span className="font-mono">basic</span>, <span className="font-mono">hra</span>, <span className="font-mono">gross</span>, etc.</li>
            <li>HR can Skip or Override any custom component for a single cycle from the Adjustments panel.</li>
            <li>Formula operators: <span className="font-mono">+ - * / %</span> · Functions: <span className="font-mono">min max round floor ceil abs</span></li>
          </ul>
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
