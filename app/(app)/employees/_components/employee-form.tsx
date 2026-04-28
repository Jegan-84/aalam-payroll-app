'use client'

import { useState } from 'react'
import { useBlockingTransition } from '@/lib/ui/action-blocker'
import { useForm, useWatch, type SubmitHandler, type FieldErrors, type Path, type Control } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  EmployeeSchema,
  type EmployeeFormState,
  type EmployeeFormValues,
  type EmployeeInput,
} from '@/lib/employees/schemas'

type MasterOption = { id: number; code: string; name: string }
type ManagerOption = { id: string; employee_code: string; full_name_snapshot: string }
type CompanyOption = { id: string; code: string; legal_name: string; display_name: string }
type UserOption = {
  id: string
  email: string
  full_name: string | null
  linked_to: { employee_code: string; full_name: string } | null
}

type Masters = {
  departments: MasterOption[]
  designations: MasterOption[]
  locations: MasterOption[]
  projects: MasterOption[]
  managers: ManagerOption[]
  companies: CompanyOption[]
  users: UserOption[]
}

type Defaults = Partial<Record<string, string | number | boolean | null | readonly (string | number)[]>>

export type EmployeeFormProps = {
  mode: 'create' | 'edit'
  action: (prev: EmployeeFormState, formData: FormData) => Promise<EmployeeFormState>
  masters: Masters
  defaults?: Defaults
  cancelHref: string
}

const SECTIONS = [
  { id: 'identity',   label: 'Identity' },
  { id: 'personal',   label: 'Personal' },
  { id: 'address',    label: 'Address' },
  { id: 'statutory',  label: 'Statutory IDs' },
  { id: 'employment', label: 'Employment' },
  { id: 'bank',       label: 'Bank' },
  { id: 'tax',        label: 'Tax' },
] as const

function toDefaultValues(d: Defaults): EmployeeFormValues {
  const s = (k: string) => {
    const v = d[k]
    return v == null ? '' : String(v)
  }
  return {
    employee_code: s('employee_code'),
    work_email:    s('work_email'),

    first_name: s('first_name'),
    middle_name: s('middle_name'),
    last_name:  s('last_name'),
    date_of_birth: s('date_of_birth'),
    gender:        s('gender') || undefined,
    marital_status: s('marital_status') || undefined,
    blood_group: s('blood_group'),
    personal_email: s('personal_email'),
    personal_phone: s('personal_phone'),
    emergency_contact_name: s('emergency_contact_name'),
    emergency_contact_relation: s('emergency_contact_relation'),
    emergency_contact_phone: s('emergency_contact_phone'),

    current_address_line1: s('current_address_line1'),
    current_address_line2: s('current_address_line2'),
    current_address_city: s('current_address_city'),
    current_address_state: s('current_address_state'),
    current_address_pincode: s('current_address_pincode'),
    current_address_country: d.current_address_country == null ? 'India' : String(d.current_address_country),

    permanent_same_as_current: Boolean(d.permanent_same_as_current ?? true),
    permanent_address_line1: s('permanent_address_line1'),
    permanent_address_line2: s('permanent_address_line2'),
    permanent_address_city: s('permanent_address_city'),
    permanent_address_state: s('permanent_address_state'),
    permanent_address_pincode: s('permanent_address_pincode'),
    permanent_address_country: d.permanent_address_country == null ? 'India' : String(d.permanent_address_country),

    pan_number: s('pan_number'),
    aadhaar_number: s('aadhaar_number'),
    uan_number: s('uan_number'),
    esi_number: s('esi_number'),
    passport_number: s('passport_number'),
    biometric_id: s('biometric_id'),

    company_id:     d.company_id == null ? undefined : String(d.company_id),
    department_id:  d.department_id  == null || d.department_id  === '' ? undefined : Number(d.department_id),
    designation_id: d.designation_id == null || d.designation_id === '' ? undefined : Number(d.designation_id),
    location_id:    d.location_id    == null || d.location_id    === '' ? undefined : Number(d.location_id),
    primary_project_id: d.primary_project_id == null || d.primary_project_id === '' ? undefined : Number(d.primary_project_id),
    secondary_project_ids: (() => {
      const v = d.secondary_project_ids
      if (Array.isArray(v)) return v.map(Number).filter((n) => Number.isFinite(n) && n > 0)
      if (typeof v === 'string' && v.trim() !== '') {
        return v.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0)
      }
      return []
    })(),
    reports_to:     d.reports_to == null ? undefined : String(d.reports_to),
    employment_type: (s('employment_type') || 'full_time') as EmployeeFormValues['employment_type'],
    date_of_joining: s('date_of_joining'),
    date_of_confirmation: s('date_of_confirmation'),
    probation_end_date: s('probation_end_date'),
    employment_status: (s('employment_status') || 'active') as EmployeeFormValues['employment_status'],
    date_of_exit: s('date_of_exit'),
    exit_reason: s('exit_reason'),

    bank_name: s('bank_name'),
    bank_account_number: s('bank_account_number'),
    bank_ifsc: s('bank_ifsc'),
    bank_account_type: s('bank_account_type') || undefined,
    bank_account_holder_name: s('bank_account_holder_name'),

    tax_regime_code: (s('tax_regime_code') || 'NEW') as EmployeeFormValues['tax_regime_code'],
    lunch_applicable: Boolean(d.lunch_applicable ?? false),
    shift_applicable: Boolean(d.shift_applicable ?? false),
    shift_allowance_monthly: (() => {
      const v = d.shift_allowance_monthly
      if (v == null) return 5000
      const n = Number(v)
      return Number.isFinite(n) ? n : 5000
    })(),
  }
}

function valuesToFormData(values: EmployeeInput): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(values)) {
    if (v === undefined || v === null) continue
    if (typeof v === 'boolean') {
      if (v) fd.append(k, 'on')
      continue
    }
    if (Array.isArray(v)) {
      // Multi-value fields (e.g. secondary_project_ids) — serialise as CSV
      // so parseFormData() on the server gets a single predictable string.
      if (v.length > 0) fd.append(k, v.join(','))
      continue
    }
    fd.append(k, String(v))
  }
  return fd
}

export function EmployeeForm({ mode, action, masters, defaults = {}, cancelHref }: EmployeeFormProps) {
  const router = useRouter()
  const [pending, startTransition] = useBlockingTransition()
  const [formError, setFormError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const {
    register,
    handleSubmit,
    setError,
    control,
    setValue,
    formState: { errors },
  } = useForm<EmployeeFormValues, unknown, EmployeeInput>({
    resolver: zodResolver(EmployeeSchema),
    defaultValues: toDefaultValues(defaults),
    shouldFocusError: true,
  })

  const err = (k: Path<EmployeeFormValues>) =>
    (errors as FieldErrors<EmployeeFormValues>)[k]?.message as string | undefined

  const onSubmit: SubmitHandler<EmployeeInput> = (values) => {
    setFormError(null)
    setSaved(false)
    startTransition(async () => {
      const fd = valuesToFormData(values)
      const result = await action(undefined, fd)
      if (result?.errors) {
        if (result.errors._form?.[0]) setFormError(result.errors._form[0])
        for (const [k, msgs] of Object.entries(result.errors)) {
          if (k === '_form' || !msgs?.[0]) continue
          setError(k as Path<EmployeeFormValues>, { message: msgs[0] })
        }
        return
      }
      if (result?.redirectTo) {
        router.push(result.redirectTo)
        return
      }
      if (result?.ok) setSaved(true)
    })
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
      <nav aria-label="Form sections" className="hidden lg:block">
        <ul className="sticky top-4 space-y-1 border-l border-slate-200 dark:border-slate-800">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="-ml-px block border-l-2 border-transparent px-3 py-1.5 text-sm text-slate-500 hover:border-slate-400 hover:text-slate-900 dark:hover:border-slate-500 dark:hover:text-slate-100"
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {formError && (
          <div role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {formError}
          </div>
        )}
        {mode === 'edit' && saved && (
          <div role="status" className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
            Saved.
          </div>
        )}

        <Section id="identity" title="Identity" description="How this employee is identified in the system.">
          <Grid>
            <Field label="Employee code" error={err('employee_code')} required>
              <Input {...register('employee_code')} placeholder="AAL001" />
            </Field>
            <Field
              label={
                <span className="inline-flex items-center gap-1.5">
                  Work email
                  <span
                    className="inline-flex items-center gap-0.5 rounded-full border border-brand-300 bg-brand-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-brand-700 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-300"
                    title="This field links the employee to a login user for the Employee Self-Service portal."
                  >
                    🔗 portal login
                  </span>
                </span>
              }
              error={err('work_email')}
              hint="Pick the user account the employee will log in with. Leave blank if this employee won't use the portal (HR will manage their leave / attendance manually). You can add it later and invite a user from /users."
            >
              <Select {...register('work_email')}>
                <option value="">— No portal access —</option>
                {masters.users.map((u) => {
                  const mineCode = mode === 'edit' ? (defaults.employee_code as string | undefined) : undefined
                  const takenByOther = u.linked_to && u.linked_to.employee_code !== mineCode
                  return (
                    <option key={u.id} value={u.email} disabled={takenByOther ?? false}>
                      {u.email}
                      {u.full_name ? ` · ${u.full_name}` : ''}
                      {takenByOther ? ` — already linked to ${u.linked_to!.employee_code}` : ''}
                    </option>
                  )
                })}
              </Select>
            </Field>
          </Grid>
        </Section>

        <Section id="personal" title="Personal" description="Personal details and emergency contact.">
          <Grid>
            <Field label="First name" error={err('first_name')} required>
              <Input {...register('first_name')} />
            </Field>
            <Field label="Middle name" error={err('middle_name')}>
              <Input {...register('middle_name')} />
            </Field>
            <Field label="Last name" error={err('last_name')} required>
              <Input {...register('last_name')} />
            </Field>
            <Field label="Date of birth" error={err('date_of_birth')}>
              <Input type="date" {...register('date_of_birth')} />
            </Field>
            <Field label="Gender" error={err('gender')}>
              <Select {...register('gender')}>
                <option value="">—</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="O">Other</option>
              </Select>
            </Field>
            <Field label="Marital status" error={err('marital_status')}>
              <Select {...register('marital_status')}>
                <option value="">—</option>
                <option value="single">Single</option>
                <option value="married">Married</option>
                <option value="divorced">Divorced</option>
                <option value="widowed">Widowed</option>
              </Select>
            </Field>
            <Field label="Blood group" error={err('blood_group')}>
              <Input {...register('blood_group')} placeholder="e.g. O+" />
            </Field>
            <Field label="Personal email" error={err('personal_email')}>
              <Input type="email" {...register('personal_email')} />
            </Field>
            <Field label="Personal phone" error={err('personal_phone')}>
              <Input {...register('personal_phone')} />
            </Field>
            <Field label="Emergency contact name" error={err('emergency_contact_name')}>
              <Input {...register('emergency_contact_name')} />
            </Field>
            <Field label="Emergency relation" error={err('emergency_contact_relation')}>
              <Input {...register('emergency_contact_relation')} />
            </Field>
            <Field label="Emergency phone" error={err('emergency_contact_phone')}>
              <Input {...register('emergency_contact_phone')} />
            </Field>
          </Grid>
        </Section>

        <Section id="address" title="Address" description="Current and permanent addresses.">
          <div className="space-y-6">
            <SubHeading>Current address</SubHeading>
            <Grid>
              <Field label="Line 1"><Input {...register('current_address_line1')} /></Field>
              <Field label="Line 2"><Input {...register('current_address_line2')} /></Field>
              <Field label="City"><Input {...register('current_address_city')} /></Field>
              <Field label="State"><Input {...register('current_address_state')} /></Field>
              <Field label="Pincode"><Input {...register('current_address_pincode')} /></Field>
              <Field label="Country"><Input {...register('current_address_country')} /></Field>
            </Grid>

            <label className="flex items-center gap-2 text-sm text-slate-800 dark:text-slate-200">
              <input type="checkbox" {...register('permanent_same_as_current')} />
              Permanent address same as current
            </label>

            <SubHeading>Permanent address (used if not same as current)</SubHeading>
            <Grid>
              <Field label="Line 1"><Input {...register('permanent_address_line1')} /></Field>
              <Field label="Line 2"><Input {...register('permanent_address_line2')} /></Field>
              <Field label="City"><Input {...register('permanent_address_city')} /></Field>
              <Field label="State"><Input {...register('permanent_address_state')} /></Field>
              <Field label="Pincode"><Input {...register('permanent_address_pincode')} /></Field>
              <Field label="Country"><Input {...register('permanent_address_country')} /></Field>
            </Grid>
          </div>
        </Section>

        <Section id="statutory" title="Statutory IDs" description="PAN, Aadhaar, UAN, ESI and passport.">
          <Grid>
            <Field label="PAN" error={err('pan_number')}>
              <Input {...register('pan_number')} placeholder="ABCDE1234F" style={{ textTransform: 'uppercase' }} />
            </Field>
            <Field label="Aadhaar" error={err('aadhaar_number')}>
              <Input {...register('aadhaar_number')} placeholder="12-digit" />
            </Field>
            <Field label="UAN" error={err('uan_number')}>
              <Input {...register('uan_number')} />
            </Field>
            <Field label="ESI number" error={err('esi_number')}>
              <Input {...register('esi_number')} />
            </Field>
            <Field label="Passport number" error={err('passport_number')}>
              <Input {...register('passport_number')} />
            </Field>
            <Field label="Biometric ID" error={err('biometric_id')} hint="Punch / attendance device ID. Used by attendance integrations.">
              <Input {...register('biometric_id')} placeholder="e.g. BIO-1042" />
            </Field>
          </Grid>
        </Section>

        <Section id="employment" title="Employment" description="Role, reporting line and employment lifecycle.">
          <Grid>
            <Field label="Company" error={err('company_id')} required>
              <Select {...register('company_id')}>
                <option value="">— select company —</option>
                {masters.companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.legal_name} ({c.code})</option>
                ))}
              </Select>
            </Field>
            <Field label="Department" error={err('department_id')}>
              <Select {...register('department_id')}>
                <option value="">—</option>
                {masters.departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Designation" error={err('designation_id')}>
              <Select {...register('designation_id')}>
                <option value="">—</option>
                {masters.designations.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Location" error={err('location_id')}>
              <Select {...register('location_id')}>
                <option value="">—</option>
                {masters.locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Primary project" error={err('primary_project_id')}>
              <Select {...register('primary_project_id')}>
                <option value="">—</option>
                {masters.projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                ))}
              </Select>
            </Field>
            <Field label="Secondary projects" error={err('secondary_project_ids')}>
              <SecondaryProjectsController
                control={control}
                options={masters.projects}
                onChange={(next) => setValue('secondary_project_ids', next, { shouldDirty: true })}
              />
            </Field>
            <Field label="Reports to" error={err('reports_to')}>
              <Select {...register('reports_to')}>
                <option value="">—</option>
                {masters.managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name_snapshot} ({m.employee_code})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Employment type" error={err('employment_type')} required>
              <Select {...register('employment_type')}>
                <option value="full_time">Full-time (permanent)</option>
                <option value="probation">Probation</option>
                <option value="contract">Contract</option>
                <option value="intern">Intern</option>
                <option value="consultant">Consultant</option>
              </Select>
            </Field>
            <Field label="Date of joining" error={err('date_of_joining')} required>
              <Input type="date" {...register('date_of_joining')} />
            </Field>
            <Field label="Probation end" error={err('probation_end_date')}>
              <Input type="date" {...register('probation_end_date')} />
            </Field>
            <Field label="Date of confirmation" error={err('date_of_confirmation')}>
              <Input type="date" {...register('date_of_confirmation')} />
            </Field>
            <Field label="Employment status" error={err('employment_status')} required>
              <Select {...register('employment_status')}>
                <option value="active">Active</option>
                <option value="on_notice">On notice</option>
                <option value="resigned">Resigned</option>
                <option value="terminated">Terminated</option>
                <option value="exited">Exited</option>
                <option value="on_hold">On hold</option>
              </Select>
            </Field>
            <Field label="Date of exit" error={err('date_of_exit')}>
              <Input type="date" {...register('date_of_exit')} />
            </Field>
            <Field label="Exit reason" error={err('exit_reason')}>
              <Input {...register('exit_reason')} />
            </Field>
          </Grid>
        </Section>

        <Section id="bank" title="Bank" description="Salary payout account details.">
          <Grid>
            <Field label="Bank name" error={err('bank_name')}>
              <Input {...register('bank_name')} />
            </Field>
            <Field label="Account number" error={err('bank_account_number')}>
              <Input {...register('bank_account_number')} />
            </Field>
            <Field label="IFSC" error={err('bank_ifsc')}>
              <Input {...register('bank_ifsc')} placeholder="HDFC0ABCDEF" style={{ textTransform: 'uppercase' }} />
            </Field>
            <Field label="Account type" error={err('bank_account_type')}>
              <Select {...register('bank_account_type')}>
                <option value="">—</option>
                <option value="savings">Savings</option>
                <option value="current">Current</option>
              </Select>
            </Field>
            <Field label="Account holder name" error={err('bank_account_holder_name')}>
              <Input {...register('bank_account_holder_name')} />
            </Field>
          </Grid>
        </Section>

        <Section id="tax" title="Tax" description="Income tax regime election.">
          <Grid>
            <Field label="Tax regime" error={err('tax_regime_code')} required>
              <Select {...register('tax_regime_code')}>
                <option value="NEW">New (default)</option>
                <option value="OLD">Old</option>
              </Select>
            </Field>
            <Field label="Lunch applicable" error={err('lunch_applicable')}>
              <label className="flex min-h-9 items-start gap-2 py-1.5 text-sm leading-5 text-slate-800 dark:text-slate-200">
                <input type="checkbox" className="mt-0.5" {...register('lunch_applicable')} />
                <span>Deduct ₹250/month (the employee takes the company lunch)</span>
              </label>
            </Field>
            <Field label="Shift allowance applicable" error={err('shift_applicable')}>
              <label className="flex min-h-9 items-start gap-2 py-1.5 text-sm leading-5 text-slate-800 dark:text-slate-200">
                <input type="checkbox" className="mt-0.5" {...register('shift_applicable')} />
                <span>Credit a monthly shift allowance (prorated by paid days)</span>
              </label>
            </Field>
            <ShiftAllowanceAmount control={control} register={register} error={err('shift_allowance_monthly')} />
          </Grid>
        </Section>

        <div className="flex items-center justify-end gap-2">
          <Link
            href={cancelHref}
            className="inline-flex h-9 items-center rounded-md border border-slate-300 px-4 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-9 items-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {pending ? 'Saving…' : mode === 'create' ? 'Create employee' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Section({
  id, title, description, children,
}: { id: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <header className="mb-4 border-b border-slate-200 pb-3 dark:border-slate-800">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      </header>
      {children}
    </section>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
}

function Field({
  label, required, error, hint, children,
}: { label: React.ReactNode; required?: boolean; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
        {label}{required && <span className="text-red-600"> *</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-slate-500 dark:text-slate-400">{hint}</p>}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="block h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:focus:border-slate-100 dark:focus:ring-slate-100"
    />
  )
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="block h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:focus:border-slate-100 dark:focus:ring-slate-100"
    />
  )
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{children}</h3>
}

function ShiftAllowanceAmount({
  control, register, error,
}: {
  control: Control<EmployeeFormValues, unknown, EmployeeInput>
  register: ReturnType<typeof useForm<EmployeeFormValues, unknown, EmployeeInput>>['register']
  error?: string
}) {
  const enabled = Boolean(useWatch({ control, name: 'shift_applicable' }))
  if (!enabled) return null
  return (
    <Field label="Shift allowance (₹/month)" error={error}>
      <input
        type="number"
        min={0}
        step="1"
        className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-950"
        {...register('shift_allowance_monthly', { valueAsNumber: true })}
      />
    </Field>
  )
}

function SecondaryProjectsController({
  control, options, onChange,
}: {
  control: Control<EmployeeFormValues, unknown, EmployeeInput>
  options: MasterOption[]
  onChange: (next: number[]) => void
}) {
  const value = (useWatch({ control, name: 'secondary_project_ids' }) as number[] | undefined) ?? []
  return <SecondaryProjectsPicker value={value} options={options} onChange={onChange} />
}

function SecondaryProjectsPicker({
  value, options, onChange,
}: {
  value: number[]
  options: MasterOption[]
  onChange: (next: number[]) => void
}) {
  const selected = new Set(value)
  const toggle = (id: number) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(Array.from(next).sort((a, b) => a - b))
  }
  if (options.length === 0) {
    return <p className="text-[11px] text-slate-500">Add projects in Settings → Projects first.</p>
  }
  return (
    <div className="flex flex-wrap gap-1.5 rounded-md border border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-950">
      {options.map((p) => {
        const on = selected.has(p.id)
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => toggle(p.id)}
            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
              on
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
            }`}
          >
            {p.code}
          </button>
        )
      })}
    </div>
  )
}
