'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

type Employee = { id: string; employee_code: string; full_name_snapshot: string }

export function RangePicker({
  from, to, employeeId, employees, live,
}: {
  from: string
  to: string
  employeeId?: string
  employees: Employee[]
  live: boolean
}) {
  const router = useRouter()
  const [f, setF] = useState(from)
  const [t, setT] = useState(to)
  const [emp, setEmp] = useState(employeeId ?? '')
  const [includeSubmitted, setIncludeSubmitted] = useState(live)

  const apply = (overrides?: Partial<{ from: string; to: string; employeeId: string; live: boolean }>) => {
    const params = new URLSearchParams()
    params.set('from', overrides?.from ?? f)
    params.set('to', overrides?.to ?? t)
    const e = overrides?.employeeId !== undefined ? overrides.employeeId : emp
    if (e) params.set('employee', e)
    const liveOn = overrides?.live !== undefined ? overrides.live : includeSubmitted
    if (liveOn) params.set('live', '1')
    router.push(`/timesheet/daily-grid?${params.toString()}`)
  }

  const preset = (which: 'this_month' | 'last_month' | 'last_7' | 'this_quarter') => {
    const now = new Date()
    let from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    let to = new Date(now.getTime())
    if (which === 'last_month') {
      from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
      to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0))
    } else if (which === 'this_quarter') {
      const qStart = Math.floor(now.getUTCMonth() / 3) * 3
      from = new Date(Date.UTC(now.getUTCFullYear(), qStart, 1))
    } else if (which === 'last_7') {
      from = new Date(now.getTime() - 6 * 86_400_000)
    }
    const fromIso = from.toISOString().slice(0, 10)
    const toIso = to.toISOString().slice(0, 10)
    setF(fromIso); setT(toIso)
    apply({ from: fromIso, to: toIso })
  }

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <Field label="From">
        <input type="date" value={f} onChange={(e) => setF(e.target.value)} className={inputCls} />
      </Field>
      <Field label="To">
        <input type="date" value={t} onChange={(e) => setT(e.target.value)} className={inputCls} />
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

      <label className="ml-2 flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
        <input
          type="checkbox"
          checked={includeSubmitted}
          onChange={(e) => { setIncludeSubmitted(e.target.checked); apply({ live: e.target.checked }) }}
          className="h-4 w-4 rounded border-slate-300"
        />
        Include drafts &amp; submitted
      </label>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Preset onClick={() => preset('last_7')}>Last 7d</Preset>
        <Preset onClick={() => preset('this_month')}>This month</Preset>
        <Preset onClick={() => preset('last_month')}>Last month</Preset>
        <Preset onClick={() => preset('this_quarter')}>This quarter</Preset>
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
