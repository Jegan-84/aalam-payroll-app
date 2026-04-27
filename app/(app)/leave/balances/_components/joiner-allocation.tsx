'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useBlockingTransition } from '@/lib/ui/action-blocker'
import { useSnackbar } from '@/components/ui/snackbar'
import { allocateForNewJoinerAction, grantSpecialLeaveAction } from '@/lib/leave/actions'

type EmpOption = { id: string; employee_code: string; full_name_snapshot: string; date_of_joining: string | null }
type LeaveTypeOption = { id: number; code: string; name: string }

export function JoinerAllocationCard({
  employees, leaveTypes, fyStart, fyLabel,
}: {
  employees: EmpOption[]
  leaveTypes: LeaveTypeOption[]
  fyStart: string
  fyLabel: string
}) {
  const router = useRouter()
  const snack = useSnackbar()
  const [pending, startTransition] = useBlockingTransition()
  const [tab, setTab] = useState<'joiner' | 'special'>('joiner')

  const allocate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('fy_start', fyStart)
    startTransition(async () => {
      const res = await allocateForNewJoinerAction(fd)
      if (res.error) snack.show({ kind: 'error', message: res.error })
      else {
        snack.show({ kind: 'success', message: `Allocated ${res.created ?? 0} leave type(s).` })
        ;(e.target as HTMLFormElement).reset()
        router.refresh()
      }
    })
  }

  const grant = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('fy_start', fyStart)
    startTransition(async () => {
      const res = await grantSpecialLeaveAction(fd)
      if (res.error) snack.show({ kind: 'error', message: res.error })
      else {
        snack.show({ kind: 'success', message: 'Special leave granted.' })
        ;(e.target as HTMLFormElement).reset()
        router.refresh()
      }
    })
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <div className="flex gap-2">
          <TabBtn active={tab === 'joiner'} onClick={() => setTab('joiner')}>New joiner</TabBtn>
          <TabBtn active={tab === 'special'} onClick={() => setTab('special')}>Special grant</TabBtn>
        </div>
      </div>

      <div className="p-4">
        {tab === 'joiner' ? (
          <>
            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
              Allocates prorated leave for an employee whose DOJ falls inside {fyLabel}.
              Annual quotas scale by months-remaining; half-yearly / monthly types start at 0 and accrue normally. Existing rows are not overwritten.
            </p>
            <form onSubmit={allocate} className="grid gap-2 sm:grid-cols-[1fr_140px_auto]">
              <select name="employee_id" required className={inputCls}>
                <option value="">Employee…</option>
                {employees.map((e) => {
                  const doj = e.date_of_joining ? ` · DOJ ${e.date_of_joining}` : ''
                  return (
                    <option key={e.id} value={e.id}>
                      {e.full_name_snapshot} ({e.employee_code}){doj}
                    </option>
                  )
                })}
              </select>
              <input name="doj" type="date" placeholder="DOJ override" className={inputCls} title="Override DOJ (optional)" />
              <button
                type="submit"
                disabled={pending}
                className="h-9 rounded-md bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 disabled:opacity-60"
              >
                {pending ? 'Allocating…' : 'Allocate'}
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
              Grant any leave type to a specific employee — even one outside the type&apos;s normal eligibility.
              Use this for Maternity, Paternity, Bereavement, or any one-off allocation. Days are added to {fyLabel}&apos;s opening balance.
            </p>
            <form onSubmit={grant} className="grid gap-2 sm:grid-cols-[1fr_180px_120px_auto]">
              <select name="employee_id" required className={inputCls}>
                <option value="">Employee…</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.full_name_snapshot} ({e.employee_code})</option>
                ))}
              </select>
              <select name="leave_type_id" required className={inputCls}>
                <option value="">Leave type…</option>
                {leaveTypes.map((lt) => (
                  <option key={lt.id} value={lt.id}>{lt.code} — {lt.name}</option>
                ))}
              </select>
              <input name="days" type="number" min="0.5" max="365" step="0.5" placeholder="Days" required className={inputCls} />
              <button
                type="submit"
                disabled={pending}
                className="h-9 rounded-md bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 disabled:opacity-60"
              >
                {pending ? 'Granting…' : 'Grant'}
              </button>
              <input
                name="reason"
                type="text"
                placeholder="Reason (e.g., maternity per HR ticket #4527)"
                required
                className={inputCls + ' sm:col-span-4'}
              />
            </form>
          </>
        )}
      </div>
    </div>
  )
}

const inputCls = 'h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950'

function TabBtn({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
          : 'border border-slate-300 bg-white text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
      }`}
    >
      {children}
    </button>
  )
}
