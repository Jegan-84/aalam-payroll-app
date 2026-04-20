'use client'

import { useState, useTransition } from 'react'
import { seedFyBalancesAction } from '@/lib/leave/actions'

export function SeedFyButton({ fyStart, fyLabel }: { fyStart: string; fyLabel: string }) {
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const onClick = () => {
    if (!confirm(`Seed opening balances for FY ${fyLabel} for every active employee?`)) return
    setMsg(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set('fy_start', fyStart)
      const res = await seedFyBalancesAction(fd)
      if (res.error) setMsg({ kind: 'err', text: res.error })
      else setMsg({ kind: 'ok', text: `Seeded ${res.inserted ?? 0} row(s). Existing balances were left untouched.` })
    })
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onClick}
        disabled={pending}
        className="inline-flex h-9 items-center rounded-md border border-slate-300 px-3 text-sm font-medium hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
      >
        {pending ? 'Seeding…' : `Seed FY ${fyLabel}`}
      </button>
      {msg && (
        <span className={`text-xs ${msg.kind === 'ok' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
          {msg.text}
        </span>
      )}
    </div>
  )
}
