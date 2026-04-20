'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useBlockingTransition } from '@/lib/ui/action-blocker'
import { toggleIncludeVpAction } from '@/lib/payroll/vp-actions'

type Status = 'draft' | 'computed' | 'approved' | 'locked' | 'paid'

export function VpToggle({
  cycleId,
  enabled,
  status,
}: {
  cycleId: string
  enabled: boolean
  status: Status
}) {
  const router = useRouter()
  const [pending, startTransition] = useBlockingTransition()
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const readonly = status === 'locked' || status === 'paid'

  const flip = () => {
    if (readonly) return
    setMsg(null)
    setErr(null)
    const next = !enabled
    startTransition(async () => {
      const fd = new FormData()
      fd.set('cycle_id', cycleId)
      fd.set('enabled', String(next))
      const res = await toggleIncludeVpAction(fd)
      if (res.error) setErr(res.error)
      else {
        if (next && res.seeded != null && res.seeded > 0) {
          setMsg(`VP enabled — seeded ${res.seeded} employee${res.seeded === 1 ? '' : 's'}. Recompute the cycle to apply.`)
        } else if (next) {
          setMsg('VP enabled. Recompute the cycle to apply.')
        } else {
          setMsg('VP disabled. Recompute to remove from payslips.')
        }
        router.refresh()
      }
    })
  }

  return (
    <div className="flex flex-col gap-1">
      <label className={`inline-flex items-center gap-2 ${readonly ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={pending || readonly}
          onClick={flip}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            enabled ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-700'
          } disabled:opacity-60`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              enabled ? 'translate-x-4' : 'translate-x-0.5'
            }`}
          />
        </button>
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Include Variable Pay
        </span>
      </label>
      {msg && <span className="text-[11px] text-green-700 dark:text-green-400">{msg}</span>}
      {err && <span className="text-[11px] text-red-700 dark:text-red-400">{err}</span>}
    </div>
  )
}
