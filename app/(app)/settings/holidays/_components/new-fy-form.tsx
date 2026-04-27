'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function NewFyForm({ existing }: { existing: string[] }) {
  const router = useRouter()
  const [fy, setFy] = useState(() => defaultFyGuess())
  const [err, setErr] = useState<string | null>(null)

  const open = (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    const trimmed = fy.trim()
    if (!trimmed) {
      setErr('Enter an FY label like 2026-27')
      return
    }
    if (!/^[\w-]+$/.test(trimmed)) {
      setErr('Only letters, digits, - and _ allowed')
      return
    }
    router.push(`/settings/holidays/${encodeURIComponent(trimmed)}`)
  }

  return (
    <form onSubmit={open} className="flex flex-wrap items-end gap-3">
      <div className="flex-1">
        <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
          Financial year label
        </label>
        <input
          value={fy}
          onChange={(e) => setFy(e.target.value)}
          placeholder="2026-27"
          list="existing-fys"
          className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
        />
        <datalist id="existing-fys">
          {existing.map((fy) => <option key={fy} value={fy} />)}
        </datalist>
        {err && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{err}</p>}
      </div>
      <button
        type="submit"
        className="h-9 rounded-md bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700 active:bg-brand-800"
      >
        Open →
      </button>
    </form>
  )
}

function defaultFyGuess(): string {
  const today = new Date()
  const y = today.getUTCFullYear()
  const m = today.getUTCMonth() + 1
  // FY starts 1 April in India.
  const startYear = m >= 4 ? y : y - 1
  const endYear = (startYear + 1) % 100
  return `${startYear}-${String(endYear).padStart(2, '0')}`
}
