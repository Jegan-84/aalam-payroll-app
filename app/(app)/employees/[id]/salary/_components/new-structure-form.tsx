'use client'

import { useMemo, useState } from 'react'
import { useBlockingActionState } from '@/lib/ui/action-blocker'
import Link from 'next/link'
import { computeSalaryStructure } from '@/lib/payroll/engine'
import { computeAnnualTax, type TaxConfig, type TaxSlab, type TaxSurchargeSlab } from '@/lib/payroll/tax'
import { computeDeductions, type RawDeclaration } from '@/lib/tax/declarations'
import type { PtSlab, StatutoryConfig } from '@/lib/payroll/types'
import { createSalaryStructureAction } from '@/lib/salary/actions'
import type { SalaryFormErrors } from '@/lib/salary/schemas'

export type TaxBundle = {
  slabs: TaxSlab[]
  config: TaxConfig | null
  surchargeSlabs: TaxSurchargeSlab[]
}

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })
const fmt = (n: number) => '₹ ' + inr.format(Math.round(n))

export type TemplateOption = {
  id: string
  code: string
  name: string
  employment_type: string | null
  annual_fixed_ctc: number
  variable_pay_percent: number
  medical_insurance_monthly: number
  internet_annual: number
  training_annual: number
  epf_mode: 'ceiling' | 'fixed_max' | 'actual'
}

export type CurrentStructureSeed = {
  annual_fixed_ctc: number
  variable_pay_percent: number
  medical_insurance_monthly: number
  internet_annual: number
  training_annual: number
  epf_mode: 'ceiling' | 'fixed_max' | 'actual'
}

type Props = {
  employeeId: string
  employeeName: string
  statutory: StatutoryConfig
  ptSlabs: PtSlab[]
  ptState: string
  suggestedEffectiveFrom: string
  templates: TemplateOption[]
  currentStructure?: CurrentStructureSeed | null

  // Tax comparison context
  currentRegime: 'NEW' | 'OLD'
  fyLabel: string
  newTaxBundle: TaxBundle
  oldTaxBundle: TaxBundle
  declaration?: RawDeclaration | null
}

export function NewStructureForm({
  employeeId,
  employeeName,
  statutory,
  ptSlabs,
  ptState,
  suggestedEffectiveFrom,
  templates,
  currentStructure,
  currentRegime,
  fyLabel,
  newTaxBundle,
  oldTaxBundle,
  declaration,
}: Props) {
  const [state, formAction, pending] = useBlockingActionState(createSalaryStructureAction, undefined)

  // Controlled fields so we can live-preview the breakdown
  const [annualCtc, setAnnualCtc] = useState<number>(342840)
  const [vpPct, setVpPct] = useState<number>(10)
  const [medIns, setMedIns] = useState<number>(500)
  const [internet, setInternet] = useState<number>(12000)
  const [training, setTraining] = useState<number>(12000)
  const [epfMode, setEpfMode] = useState<'ceiling' | 'fixed_max' | 'actual'>('ceiling')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [regime, setRegime] = useState<'NEW' | 'OLD'>(currentRegime)

  const copyCurrent = () => {
    if (!currentStructure) return
    setSelectedTemplateId('')
    setAnnualCtc(Number(currentStructure.annual_fixed_ctc))
    setVpPct(Number(currentStructure.variable_pay_percent))
    setMedIns(Number(currentStructure.medical_insurance_monthly))
    setInternet(Number(currentStructure.internet_annual))
    setTraining(Number(currentStructure.training_annual))
    setEpfMode(currentStructure.epf_mode)
  }

  const applyTemplate = (tid: string) => {
    setSelectedTemplateId(tid)
    if (!tid) return
    const t = templates.find((x) => x.id === tid)
    if (!t) return
    setAnnualCtc(Number(t.annual_fixed_ctc))
    setVpPct(Number(t.variable_pay_percent))
    setMedIns(Number(t.medical_insurance_monthly))
    setInternet(Number(t.internet_annual))
    setTraining(Number(t.training_annual))
    setEpfMode(t.epf_mode)
  }

  const preview = useMemo(
    () =>
      computeSalaryStructure({
        annualFixedCtc: annualCtc,
        variablePayPercent: vpPct,
        medicalInsuranceMonthly: medIns,
        internetAnnual: internet,
        trainingAnnual: training,
        epfMode,
        ptState,
        statutory,
        ptSlabs,
      }),
    [annualCtc, vpPct, medIns, internet, training, epfMode, ptState, statutory, ptSlabs],
  )

  // --- Tax comparison: NEW vs OLD on the previewed annualGross ---
  const taxCompare = useMemo(() => {
    const annualGross = preview.annualGross
    const annualBasic = annualGross * 0.5
    const annualHra = annualBasic * 0.5

    const oldDeductions = declaration
      ? computeDeductions(declaration, { hraReceivedAnnual: annualHra, basicAnnual: annualBasic })
      : null

    const newResult = newTaxBundle.config
      ? computeAnnualTax({
          annualGross,
          slabs: newTaxBundle.slabs,
          config: newTaxBundle.config,
          surchargeSlabs: newTaxBundle.surchargeSlabs,
        })
      : null

    const oldResult = oldTaxBundle.config
      ? computeAnnualTax({
          annualGross,
          slabs: oldTaxBundle.slabs,
          config: oldTaxBundle.config,
          surchargeSlabs: oldTaxBundle.surchargeSlabs,
          totalDeductions: oldDeductions?.total ?? 0,
        })
      : null

    const newTotal = newResult?.total ?? 0
    const oldTotal = oldResult?.total ?? 0
    const better: 'NEW' | 'OLD' | 'tie' =
      newTotal === oldTotal ? 'tie' : newTotal < oldTotal ? 'NEW' : 'OLD'
    const saving = Math.abs(newTotal - oldTotal)

    return { annualGross, annualBasic, newResult, oldResult, oldDeductions, better, saving }
  }, [preview.annualGross, newTaxBundle, oldTaxBundle, declaration])

  const fieldErr = (k: keyof SalaryFormErrors) => state?.errors?.[k]?.[0]

  const groupedComponents = useMemo(() => {
    return {
      earnings: preview.components.filter((c) => c.kind === 'earning'),
      deductions: preview.components.filter((c) => c.kind === 'deduction'),
      retirals: preview.components.filter((c) => c.kind === 'employer_retiral'),
      reimbursements: preview.components.filter((c) => c.kind === 'reimbursement'),
      variable: preview.components.filter((c) => c.kind === 'variable'),
    }
  }, [preview.components])

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <form action={formAction} className="space-y-4 lg:col-span-2">
        <input type="hidden" name="employee_id" value={employeeId} />
        {selectedTemplateId && <input type="hidden" name="template_id" value={selectedTemplateId} />}

        {(templates.length > 0 || currentStructure) && (
          <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-end gap-3">
              {templates.length > 0 && (
                <div className="flex-1 min-w-[220px]">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Start from template</label>
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => applyTemplate(e.target.value)}
                    className="mt-1 block h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                  >
                    <option value="">— none (start blank) —</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.code} — {t.name}{t.employment_type ? ` · ${t.employment_type}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {currentStructure && (
                <button
                  type="button"
                  onClick={copyCurrent}
                  className="inline-flex h-9 items-center rounded-md border border-slate-300 px-3 text-xs font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  title="For hikes: pull the employee's current CTC and benefits, then bump the CTC."
                >
                  Copy current values
                </button>
              )}
            </div>
            <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
              Use &ldquo;Copy current values&rdquo; to process a hike — prefills everything, you just change the CTC.
            </p>
          </div>
        )}

        {state?.errors?._form && (
          <div role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {state.errors._form[0]}
          </div>
        )}
        {state?.ok && (
          <div role="status" className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
            Salary structure saved.
          </div>
        )}

        <Card title="Structure for">
          <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{employeeName}</div>
          <Field label="Effective from" required error={fieldErr('effective_from')}>
            <input
              type="date"
              name="effective_from"
              defaultValue={suggestedEffectiveFrom}
              required
              className={inputCls}
            />
          </Field>
        </Card>

        <Card title="Compensation">
          <Field label="Annual fixed CTC" required error={fieldErr('annual_fixed_ctc')}>
            <input
              type="number"
              name="annual_fixed_ctc"
              min="0"
              step="1"
              value={annualCtc}
              onChange={(e) => setAnnualCtc(Number(e.target.value || 0))}
              className={inputCls}
            />
          </Field>
          <Field label="Variable pay (% of annual gross)" error={fieldErr('variable_pay_percent')}>
            <input
              type="number"
              name="variable_pay_percent"
              min="0"
              step="0.1"
              value={vpPct}
              onChange={(e) => setVpPct(Number(e.target.value || 0))}
              className={inputCls}
            />
          </Field>
        </Card>

        <Card title="Fixed employer benefits">
          <Field label="Medical insurance (per month)" error={fieldErr('medical_insurance_monthly')}>
            <input
              type="number"
              name="medical_insurance_monthly"
              min="0"
              step="1"
              value={medIns}
              onChange={(e) => setMedIns(Number(e.target.value || 0))}
              className={inputCls}
            />
          </Field>
          <Field label="Internet reimbursement (annual)" error={fieldErr('internet_annual')}>
            <input
              type="number"
              name="internet_annual"
              min="0"
              step="1"
              value={internet}
              onChange={(e) => setInternet(Number(e.target.value || 0))}
              className={inputCls}
            />
          </Field>
          <Field label="Training / certification (annual)" error={fieldErr('training_annual')}>
            <input
              type="number"
              name="training_annual"
              min="0"
              step="1"
              value={training}
              onChange={(e) => setTraining(Number(e.target.value || 0))}
              className={inputCls}
            />
          </Field>
        </Card>

        <Card title="PF mode">
          <Field label="EPF computation" error={fieldErr('epf_mode')}>
            <select
              name="epf_mode"
              value={epfMode}
              onChange={(e) => setEpfMode(e.target.value as typeof epfMode)}
              className={selectCls}
            >
              <option value="ceiling">Ceiling — 12% of min(Basic, {inr.format(statutory.epf_wage_ceiling)})</option>
              <option value="fixed_max">Fixed max — {inr.format(statutory.epf_max_monthly_contribution)} always</option>
              <option value="actual">Actual — 12% of Basic, no cap</option>
            </select>
          </Field>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Your sample sheet effectively uses <strong>fixed max</strong> (PF = ₹1800 regardless of Basic).
            The statutory minimum is <strong>ceiling</strong>.
          </p>
        </Card>

        <Card title={`Tax regime — FY ${fyLabel}`}>
          <input type="hidden" name="tax_regime_code" value={regime} />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <RegimeTile
              label="NEW Regime"
              selected={regime === 'NEW'}
              onSelect={() => setRegime('NEW')}
              total={taxCompare.newResult?.total ?? 0}
              monthly={taxCompare.newResult?.monthly ?? 0}
              taxableIncome={taxCompare.newResult?.taxableIncome ?? 0}
              stdDeduction={newTaxBundle.config?.standard_deduction ?? 0}
              chapterVIa={0}
            />
            <RegimeTile
              label="OLD Regime"
              selected={regime === 'OLD'}
              onSelect={() => setRegime('OLD')}
              total={taxCompare.oldResult?.total ?? 0}
              monthly={taxCompare.oldResult?.monthly ?? 0}
              taxableIncome={taxCompare.oldResult?.taxableIncome ?? 0}
              stdDeduction={oldTaxBundle.config?.standard_deduction ?? 0}
              chapterVIa={taxCompare.oldDeductions?.total ?? 0}
            />
          </div>

          <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-950">
            {taxCompare.better === 'tie' ? (
              <span>Both regimes compute the same tax for this gross.</span>
            ) : (
              <>
                <strong className="text-slate-900 dark:text-slate-50">{taxCompare.better} regime</strong> is cheaper
                by <strong className="text-green-700 dark:text-green-400">{fmt(taxCompare.saving)}</strong>/year.
              </>
            )}
            {!declaration && (
              <span className="ml-1 text-amber-700 dark:text-amber-400">
                No approved tax declaration on file — OLD regime shows only standard deduction. Submit a
                declaration (80C, HRA, etc.) to see the real OLD-regime tax.
              </span>
            )}
          </div>
        </Card>

        <Card title="Notes">
          <textarea
            name="notes"
            rows={3}
            className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:focus:border-slate-100"
            placeholder="Optional: annual revision, offer-letter ref, etc."
          />
        </Card>

        <div className="flex items-center justify-end gap-2">
          <Link href={`/employees/${employeeId}`} className="inline-flex h-9 items-center rounded-md border border-slate-300 px-4 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
            Back to employee
          </Link>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-9 items-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {pending ? 'Saving…' : 'Save structure'}
          </button>
        </div>
      </form>

      <div className="lg:col-span-3">
        <div className="sticky top-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Monthly gross" value={fmt(preview.monthlyGross)} />
            <Stat label="Take home / mo" value={fmt(preview.monthlyTakeHome)} emphasis />
            <Stat label="Annual gross" value={fmt(preview.annualGross)} />
            <Stat label="Total CTC / yr" value={fmt(preview.annualTotalCtc)} emphasis />
          </div>

          <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <Section title="Earnings (gross)">
              {groupedComponents.earnings.map((c) => (
                <Row key={c.code} label={c.name} monthly={c.monthly} annual={c.annual} />
              ))}
              <RowTotal label="Gross" monthly={preview.monthlyGross} annual={preview.annualGross} />
            </Section>

            <Section title="Employee deductions">
              {groupedComponents.deductions.map((c) => (
                <Row key={c.code} label={c.name} monthly={c.monthly} annual={c.annual} />
              ))}
              <RowTotal
                label="Take home"
                monthly={preview.monthlyTakeHome}
                annual={preview.monthlyTakeHome * 12}
              />
            </Section>

            <Section title="Employer retirals">
              {groupedComponents.retirals.map((c) => (
                <Row key={c.code} label={c.name} monthly={c.monthly} annual={c.annual} />
              ))}
            </Section>

            <Section title="Reimbursements (annual)">
              {groupedComponents.reimbursements.map((c) => (
                <Row key={c.code} label={c.name} monthly={c.monthly} annual={c.annual} />
              ))}
            </Section>

            <Section title="Variable">
              {groupedComponents.variable.map((c) => (
                <Row key={c.code} label={c.name} monthly={c.monthly} annual={c.annual} />
              ))}
            </Section>
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400">
            Converged in {preview.diagnostics.iterations} iteration(s)
            {preview.diagnostics.converged ? '' : ' (solver hit iteration cap — review inputs)'}.
          </div>
        </div>
      </div>
    </div>
  )
}

const inputCls =
  'block h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:focus:border-slate-100 dark:focus:ring-slate-100'
const selectCls =
  'block h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:focus:border-slate-100 dark:focus:ring-slate-100'

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {title}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Field({
  label, required, error, children,
}: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
        {label}{required && <span className="text-red-600"> *</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}

function Stat({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${emphasis ? 'border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'}`}>
      <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-50">{value}</div>
    </div>
  )
}

function RegimeTile({
  label, selected, onSelect, total, monthly, taxableIncome, stdDeduction, chapterVIa,
}: {
  label: string
  selected: boolean
  onSelect: () => void
  total: number
  monthly: number
  taxableIncome: number
  stdDeduction: number
  chapterVIa: number
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex flex-col items-start rounded-lg border-2 p-3 text-left transition ${
        selected
          ? 'border-slate-900 bg-slate-50 dark:border-slate-100 dark:bg-slate-800'
          : 'border-slate-200 bg-white hover:border-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-600'
      }`}
    >
      <div className="flex w-full items-center justify-between">
        <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">{label}</span>
        <span className={`h-4 w-4 rounded-full border-2 ${selected ? 'border-slate-900 bg-slate-900 dark:border-slate-100 dark:bg-slate-100' : 'border-slate-400 dark:border-slate-600'}`} />
      </div>
      <div className="mt-2 text-xs text-slate-600 dark:text-slate-400">Annual tax</div>
      <div className="text-lg font-bold text-slate-900 dark:text-slate-50">{fmt(total)}</div>
      <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
        &asymp; {fmt(monthly)}/month &middot; Taxable: {fmt(taxableIncome)}
      </div>
      <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
        Std deduction {fmt(stdDeduction)}{chapterVIa > 0 ? ` · Exemptions ${fmt(chapterVIa)}` : ''}
      </div>
    </button>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-slate-100 p-4 last:border-b-0 dark:border-slate-800">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {title}
      </div>
      <table className="w-full text-sm">
        <thead className="text-xs text-slate-500">
          <tr>
            <th className="w-1/2 py-1 text-left font-normal">Component</th>
            <th className="py-1 text-right font-normal">Monthly</th>
            <th className="py-1 text-right font-normal">Annual</th>
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

function Row({ label, monthly, annual }: { label: string; monthly: number; annual: number }) {
  return (
    <tr>
      <td className="py-1 text-slate-800 dark:text-slate-200">{label}</td>
      <td className="py-1 text-right tabular-nums">{fmt(monthly)}</td>
      <td className="py-1 text-right tabular-nums">{fmt(annual)}</td>
    </tr>
  )
}
function RowTotal({ label, monthly, annual }: { label: string; monthly: number; annual: number }) {
  return (
    <tr className="border-t border-slate-200 dark:border-slate-800">
      <td className="py-1 font-medium text-slate-900 dark:text-slate-100">{label}</td>
      <td className="py-1 text-right font-medium tabular-nums">{fmt(monthly)}</td>
      <td className="py-1 text-right font-medium tabular-nums">{fmt(annual)}</td>
    </tr>
  )
}
