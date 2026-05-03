'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

type Employee = { id: string; employee_code: string; full_name_snapshot: string }

export function MonthPicker({
  monthIso, employeeId, employees,
}: {
  monthIso: string             // YYYY-MM
  employeeId?: string
  employees: Employee[]
}) {
  const router = useRouter()
  const [m, setM] = useState(monthIso)
  const [emp, setEmp] = useState(employeeId ?? '')

  const apply = (overrides?: Partial<{ monthIso: string; employeeId: string }>) => {
    const params = new URLSearchParams()
    params.set('month', overrides?.monthIso ?? m)
    const e = overrides?.employeeId !== undefined ? overrides.employeeId : emp
    if (e) params.set('employee', e)
    router.push(`/leave/plan-report?${params.toString()}`)
  }

  const shift = (delta: number) => {
    const [y, mm] = m.split('-').map(Number)
    const dt = new Date(Date.UTC(y, mm - 1 + delta, 1))
    const next = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`
    setM(next)
    apply({ monthIso: next })
  }
  const thisMonth = () => {
    const now = new Date()
    const next = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
    setM(next)
    apply({ monthIso: next })
  }

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <Field label="Month">
        <input
          type="month"
          value={m}
          onChange={(e) => setM(e.target.value)}
          className={inputCls}
        />
      </Field>
      <Field label="Employee">
        <select
          value={emp}
          onChange={(e) => { setEmp(e.target.value); apply({ employeeId: e.target.value }) }}
          className={inputCls + ' min-w-[220px]'}
        >
          <option value="">All employees</option>
          {employees.map((u) => (
            <option key={u.id} value={u.id}>
              {u.full_name_snapshot} ({u.employee_code})
            </option>
          ))}
        </select>
      </Field>
      <button
        type="button"
        onClick={() => apply()}
        className="h-9 rounded-md bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
      >
        Apply
      </button>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Preset onClick={() => shift(-1)}>‹ Prev</Preset>
        <Preset onClick={thisMonth}>This month</Preset>
        <Preset onClick={() => shift(1)}>Next ›</Preset>
      </div>
    </div>
  )
}

const inputCls = 'h-9 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</label>
      {children}
    </div>
  )
}

function Preset({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-7 rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
    >
      {children}
    </button>
  )
}
