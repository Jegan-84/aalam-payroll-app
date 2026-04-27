'use client'

import { useRouter } from 'next/navigation'
import { useBlockingTransition } from '@/lib/ui/action-blocker'
import { useSnackbar } from '@/components/ui/snackbar'
import { grantCompOffAction, expireAllCompOffAction } from '@/lib/leave/comp-off'

type EmpOption = { id: string; employee_code: string; full_name_snapshot: string }

export function CompOffGrantForm({ employees }: { employees: EmpOption[] }) {
  const router = useRouter()
  const snack = useSnackbar()
  const [pending, startTransition] = useBlockingTransition()

  const grant = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await grantCompOffAction(fd)
      if (res.error) snack.show({ kind: 'error', message: res.error })
      else {
        snack.show({ kind: 'success', message: 'Comp off granted.' })
        ;(e.target as HTMLFormElement).reset()
        router.refresh()
      }
    })
  }

  const sweep = () => {
    startTransition(async () => {
      const res = await expireAllCompOffAction()
      if (res.error) snack.show({ kind: 'error', message: res.error })
      else snack.show({ kind: 'info', message: `Expired ${res.expired ?? 0} grant(s).` })
      router.refresh()
    })
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Comp Off</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Grant 1 day (or fraction) for weekend / holiday work. Each grant expires 30 days from the work date unless claimed.
        </p>
      </div>
      <form onSubmit={grant} className="grid gap-2 sm:grid-cols-5">
        <select name="employee_id" required className={inputCls}>
          <option value="">Employee…</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.full_name_snapshot} ({e.employee_code})
            </option>
          ))}
        </select>
        <input name="work_date" type="date" required className={inputCls} />
        <input name="granted_days" type="number" min="0.5" max="2" step="0.5" defaultValue="1" required className={inputCls} />
        <input name="expiry_days" type="number" min="1" max="365" defaultValue="30" required className={inputCls} />
        <button
          type="submit"
          disabled={pending}
          className="h-9 rounded-md bg-brand-600 px-3 text-sm font-medium text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 disabled:opacity-60"
        >
          {pending ? 'Granting…' : 'Grant'}
        </button>
        <input name="reason" type="text" placeholder="Reason (optional)" className={inputCls + ' sm:col-span-5'} />
      </form>
      <div className="text-right">
        <button
          type="button"
          onClick={sweep}
          disabled={pending}
          className="text-xs font-medium text-slate-600 hover:text-slate-900 hover:underline dark:text-slate-400 dark:hover:text-slate-100"
        >
          Run expiry sweep (clears grants past their 30-day window)
        </button>
      </div>
    </div>
  )
}

const inputCls = 'h-9 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950'
