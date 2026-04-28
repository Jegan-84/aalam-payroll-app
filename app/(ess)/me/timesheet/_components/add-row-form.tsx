'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useBlockingTransition } from '@/lib/ui/action-blocker'
import { useSnackbar } from '@/components/ui/snackbar'
import { addRowAction } from '@/lib/timesheet/actions'

type Project = { id: number; code: string; name: string }
type Activity = { id: number; code: string; name: string }

export function AddRowForm({
  weekStart, projects, activityTypes,
}: {
  weekStart: string
  projects: Project[]
  activityTypes: Activity[]
}) {
  const router = useRouter()
  const snack = useSnackbar()
  const [pending, startTransition] = useBlockingTransition()
  const [open, setOpen] = useState(false)

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('week_start', weekStart)
    startTransition(async () => {
      const res = await addRowAction(fd)
      if (res.error) {
        snack.show({ kind: 'error', message: res.error })
        return
      }
      ;(e.target as HTMLFormElement).reset()
      setOpen(false)
      router.refresh()
    })
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center rounded-md border border-dashed border-slate-300 px-3 text-sm font-medium text-slate-600 hover:border-brand-400 hover:text-brand-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand-700 dark:hover:text-brand-400"
      >
        + Add row
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="grid gap-2 sm:grid-cols-[1fr_180px_1fr_110px_auto_auto]">
      <select name="project_id" required className={inputCls}>
        <option value="">Project…</option>
        {projects.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
      </select>
      <select name="activity_type_id" required className={inputCls}>
        <option value="">Activity…</option>
        {activityTypes.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
      </select>
      <input name="task" type="text" placeholder="Task (optional)" className={inputCls} />
      <select name="work_mode" defaultValue="WFO" className={inputCls} title="Work mode">
        <option value="WFO">🏢 WFO</option>
        <option value="WFH">🏠 WFH</option>
      </select>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="h-9 rounded-md border border-slate-300 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={pending}
        className="h-9 rounded-md bg-brand-600 px-3 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? 'Adding…' : 'Add row'}
      </button>
    </form>
  )
}

const inputCls = 'h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950'
