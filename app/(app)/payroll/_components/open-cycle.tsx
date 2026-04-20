'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useBlockingTransition } from '@/lib/ui/action-blocker'
import { openCycleAction } from '@/lib/payroll/actions'
import { MONTH_NAMES } from '@/lib/attendance/engine'

export function OpenCycleButton() {
  const router = useRouter()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [pending, startTransition] = useBlockingTransition()
  const [err, setErr] = useState<string | null>(null)

  const submit = () => {
    setErr(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set('year', String(year))
      fd.set('month', String(month))
      const res = await openCycleAction(fd)
      if (res.error) setErr(res.error)
      else if (res.id) router.push(`/payroll/${res.id}`)
    })
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={month}
        onChange={(e) => setMonth(Number(e.target.value))}
        className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950"
      >
        {MONTH_NAMES.map((n, i) => (
          <option key={i} value={i + 1}>{n}</option>
        ))}
      </select>
      <input
        type="number"
        value={year}
        onChange={(e) => setYear(Number(e.target.value))}
        className="h-9 w-24 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950"
      />
      <button
        onClick={submit}
        disabled={pending}
        className="inline-flex h-9 items-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
      >
        {pending ? 'Opening…' : 'Open cycle'}
      </button>
      {err && <span className="text-xs text-red-600">{err}</span>}
    </div>
  )
}
