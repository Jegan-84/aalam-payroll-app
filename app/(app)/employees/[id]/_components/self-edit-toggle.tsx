'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useSnackbar } from '@/components/ui/snackbar'
import { useBlockingTransition } from '@/lib/ui/action-blocker'
import { setProfileEditEnabledAction } from '@/lib/employees/self-service'

export function SelfEditToggle({
  employeeId, enabled,
}: { employeeId: string; enabled: boolean }) {
  const router = useRouter()
  const snack = useSnackbar()
  const [pending, startTransition] = useBlockingTransition()
  const [optimistic, setOptimistic] = React.useState(enabled)

  const flip = (next: boolean) => {
    const fd = new FormData()
    fd.set('enabled', next ? 'true' : 'false')
    setOptimistic(next)
    startTransition(async () => {
      const res = await setProfileEditEnabledAction(employeeId, fd)
      if ('error' in res) {
        snack.show({ kind: 'error', message: res.error })
        setOptimistic(!next)
      } else {
        snack.show({
          kind: 'success',
          message: next ? 'Self-edit enabled. Employee can now update their profile.' : 'Self-edit disabled.',
        })
        router.refresh()
      }
    })
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
          Allow employee to edit their profile
        </h3>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          When on, the employee can update personal, address, statutory, and bank details from <code>/me/profile</code>,
          and upload documents. Tax regime, employment, and pay fields stay HR-only.
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={optimistic}
        disabled={pending}
        onClick={() => flip(!optimistic)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:opacity-60 ${
          optimistic ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
            optimistic ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  )
}
