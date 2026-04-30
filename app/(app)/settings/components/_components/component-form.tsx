'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useBlockingTransition } from '@/lib/ui/action-blocker'
import { useConfirm } from '@/components/ui/confirm'
import { saveCustomComponentAction, deleteCustomComponentAction } from '@/lib/pay-components/actions'
import { evalFormula, validateFormulaSyntax, ALLOWED_VARS } from '@/lib/payroll/formula'
import type { CustomComponentRow } from '@/lib/pay-components/queries'

type Mode = 'create' | 'edit'

export function CustomComponentForm({
  mode,
  defaults,
}: {
  mode: Mode
  defaults?: CustomComponentRow
}) {
  const router = useRouter()
  const confirm = useConfirm()
  const [pending, startTransition] = useBlockingTransition()
  const [err, setErr] = useState<string | null>(null)

  const [code, setCode] = useState(defaults?.code ?? '')
  const [name, setName] = useState(defaults?.name ?? '')
  const [kind, setKind] = useState<CustomComponentRow['kind']>(defaults?.kind ?? 'earning')
  const [calcType, setCalcType] = useState<CustomComponentRow['calculation_type']>(defaults?.calculation_type ?? 'fixed')
  const [percentValue, setPercentValue] = useState(String(defaults?.percent_value ?? ''))
  const [capAmount, setCapAmount] = useState(String(defaults?.cap_amount ?? ''))
  const [formula, setFormula] = useState(defaults?.formula ?? '')
  const [displayOrder, setDisplayOrder] = useState(String(defaults?.display_order ?? 500))
  const [prorate, setProrate] = useState(defaults?.prorate ?? true)
  const [taxable, setTaxable] = useState(defaults?.taxable ?? true)
  const [includeInGross, setIncludeInGross] = useState(defaults?.include_in_gross ?? false)
  const [isActive, setIsActive] = useState(defaults?.is_active ?? true)

  // Sample payslip values for the formula preview.
  const [sampleBasic, setSampleBasic] = useState('25000')
  const sampleVars = useMemo(() => {
    const basic = Number(sampleBasic) || 0
    const gross = basic * 2 // basic = 50% of gross by convention
    return {
      gross,
      grossProrated: gross,
      basic,
      basicProrated: basic,
      hra: Math.round(basic * 0.5),
      hraProrated: Math.round(basic * 0.5),
      conv: Math.min(Math.round(basic * 0.1), 800),
      convProrated: Math.min(Math.round(basic * 0.1), 800),
      paidDays: 30,
      daysInMonth: 30,
      proration: 1,
      annualCtc: gross * 12,
      annualGross: gross * 12,
    }
  }, [sampleBasic])

  const formulaSyntaxErr = calcType === 'formula' && formula ? validateFormulaSyntax(formula) : null
  const formulaPreview = useMemo(() => {
    if (calcType !== 'formula' || !formula) return null
    const r = evalFormula(formula, sampleVars)
    return r.ok ? r.value : null
  }, [calcType, formula, sampleVars])

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErr(null)
    const fd = new FormData(e.currentTarget)
    if (defaults?.id) fd.set('id', String(defaults.id))
    startTransition(async () => {
      const res = await saveCustomComponentAction(fd)
      if (res.error) setErr(res.error)
      else router.push('/settings/components')
    })
  }

  const onDelete = async () => {
    if (!defaults?.id) return
    if (!await confirm({
      title: `Delete custom component "${defaults.code}"?`,
      body: 'Existing payslips are unaffected; future cycles will skip it.',
      confirmLabel: 'Delete',
      tone: 'danger',
    })) return
    setErr(null)
    const fd = new FormData()
    fd.set('id', String(defaults.id))
    startTransition(async () => {
      const res = await deleteCustomComponentAction(fd)
      if (res.error) setErr(res.error)
      else router.push('/settings/components')
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {err && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {err}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Code" hint="Uppercase, letters/digits/underscores. Can't collide with system codes (BASIC, HRA, …).">
          <input
            name="code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
            placeholder="e.g. NIGHT_SHIFT"
            required
            className={inputCls + ' font-mono uppercase'}
          />
        </Field>
        <Field label="Display name">
          <input name="name" value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} />
        </Field>

        <Field label="Kind">
          <select name="kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className={inputCls}>
            <option value="earning">Earning</option>
            <option value="deduction">Deduction</option>
            <option value="employer_retiral">Employer retiral</option>
            <option value="reimbursement">Reimbursement</option>
          </select>
        </Field>
        <Field label="Calculation type">
          <select name="calculation_type" value={calcType} onChange={(e) => setCalcType(e.target.value as typeof calcType)} className={inputCls}>
            <option value="fixed">Fixed amount</option>
            <option value="percent_of_basic">% of Basic</option>
            <option value="percent_of_gross">% of Gross</option>
            <option value="formula">Formula</option>
          </select>
        </Field>

        {calcType === 'fixed' && (
          <Field label="Fixed amount ₹" hint="This exact amount is added every month (prorated if 'prorate' is on).">
            <input name="cap_amount" type="number" min="0" step="1" value={capAmount} onChange={(e) => setCapAmount(e.target.value)} required className={inputCls} />
          </Field>
        )}

        {(calcType === 'percent_of_basic' || calcType === 'percent_of_gross') && (
          <>
            <Field label="Percent">
              <input name="percent_value" type="number" min="0" step="0.01" value={percentValue} onChange={(e) => setPercentValue(e.target.value)} required className={inputCls} />
            </Field>
            <Field label="Cap amount ₹ (optional)" hint="Hard upper limit per month. Leave blank for no cap.">
              <input name="cap_amount" type="number" min="0" step="1" value={capAmount} onChange={(e) => setCapAmount(e.target.value)} className={inputCls} />
            </Field>
          </>
        )}

        {calcType === 'formula' && (
          <>
            <Field label="Formula" hint="Arithmetic on allowed variables. No side effects.">
              <input
                name="formula"
                value={formula}
                onChange={(e) => setFormula(e.target.value)}
                placeholder="e.g. min(basic * 0.2, 5000)"
                required
                className={inputCls + ' font-mono'}
              />
              {formulaSyntaxErr && (
                <span className="mt-1 block text-[11px] text-red-700 dark:text-red-400">
                  {formulaSyntaxErr}
                </span>
              )}
            </Field>
            <Field label="Cap amount ₹ (optional)" hint="Applied after formula; leave blank for no cap.">
              <input name="cap_amount" type="number" min="0" step="1" value={capAmount} onChange={(e) => setCapAmount(e.target.value)} className={inputCls} />
            </Field>
          </>
        )}

        <Field label="Display order" hint="Lower = earlier on payslip. 500 is a good default for custom components.">
          <input name="display_order" type="number" min="0" max="9999" step="1" value={displayOrder} onChange={(e) => setDisplayOrder(e.target.value)} required className={inputCls} />
        </Field>

        <div className="sm:col-span-2 grid gap-2 sm:grid-cols-4">
          <Checkbox name="prorate" label="Prorate by paid days" checked={prorate} onChange={setProrate} />
          <Checkbox name="taxable" label="Taxable" checked={taxable} onChange={setTaxable} />
          <Checkbox name="include_in_gross" label="Include in gross total" checked={includeInGross} onChange={setIncludeInGross} />
          <Checkbox name="is_active" label="Active (apply on compute)" checked={isActive} onChange={setIsActive} />
        </div>
      </div>

      {calcType === 'formula' && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Formula preview</div>
            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
              Sample Basic ₹
              <input
                type="number"
                min="0"
                step="1"
                value={sampleBasic}
                onChange={(e) => setSampleBasic(e.target.value)}
                className="h-7 w-24 rounded-md border border-slate-300 bg-white px-2 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
            {formulaPreview != null ? (
              <div className="text-sm">
                Result: <span className="font-mono font-semibold tabular-nums">₹ {Math.round(formulaPreview).toLocaleString('en-IN')}</span>
              </div>
            ) : (
              <div className="text-xs text-slate-500">Enter a valid formula to see the preview.</div>
            )}
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            Variables: <span className="font-mono">{ALLOWED_VARS.join(', ')}</span>
            <span className="mx-2">·</span>
            Functions: <span className="font-mono">min, max, round, floor, ceil, abs</span>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={pending || !!formulaSyntaxErr}
          className="h-9 rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
        >
          {pending ? 'Saving…' : mode === 'create' ? 'Create component' : 'Save changes'}
        </button>
        <Link href="/settings/components" className="text-sm text-slate-500 hover:underline">Cancel</Link>
        {mode === 'edit' && (
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className="ml-auto h-9 rounded-md border border-red-300 bg-white px-4 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            Delete
          </button>
        )}
      </div>
    </form>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col">
      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</span>
      {children}
      {hint && <span className="mt-1 text-[11px] text-slate-500">{hint}</span>}
    </label>
  )
}

function Checkbox({ name, label, checked, onChange }: { name: string; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-800 dark:text-slate-200">
      <input type="checkbox" name={name} checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

const inputCls = 'mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-950'
