'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useBlockingTransition } from '@/lib/ui/action-blocker'
import { useSnackbar } from '@/components/ui/snackbar'
import { upsertEntryAction } from '@/lib/timesheet/actions'

type Props = {
  projectId: number
  activityTypeId: number
  task: string | null
  workMode: 'WFH' | 'WFO'
  entryDate: string
  initialHours: number
  locked: boolean
}

export function TimesheetCell({
  projectId, activityTypeId, task, workMode, entryDate, initialHours, locked,
}: Props) {
  const router = useRouter()
  const snack = useSnackbar()
  const [pending, startTransition] = useBlockingTransition()
  const [value, setValue] = useState(initialHours === 0 ? '' : initialHours.toFixed(2))

  if (locked) {
    return (
      <span className="block w-full rounded-md py-1.5 text-center text-sm tabular-nums text-slate-700 dark:text-slate-200">
        {initialHours === 0 ? '—' : initialHours.toFixed(2)}
      </span>
    )
  }

  const save = (raw: string) => {
    const trimmed = raw.trim()
    const next = trimmed === '' ? 0 : Number(trimmed)
    if (Number.isNaN(next) || next < 0 || next > 24) {
      snack.show({ kind: 'error', message: 'Hours must be between 0 and 24.' })
      setValue(initialHours === 0 ? '' : initialHours.toFixed(2))
      return
    }
    if (next === initialHours) return  // no change

    const fd = new FormData()
    fd.set('project_id', String(projectId))
    fd.set('activity_type_id', String(activityTypeId))
    if (task) fd.set('task', task)
    fd.set('entry_date', entryDate)
    fd.set('hours', String(next))
    fd.set('work_mode', workMode)

    startTransition(async () => {
      const res = await upsertEntryAction(fd)
      if (res.error) {
        snack.show({ kind: 'error', message: res.error })
        setValue(initialHours === 0 ? '' : initialHours.toFixed(2))
      } else {
        router.refresh()
      }
    })
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={(e) => save(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') {
          setValue(initialHours === 0 ? '' : initialHours.toFixed(2))
          ;(e.target as HTMLInputElement).blur()
        }
      }}
      disabled={pending}
      placeholder="—"
      className="block h-8 w-full max-w-[60px] rounded-md border border-transparent bg-transparent text-center text-sm tabular-nums text-slate-900 outline-none transition-colors hover:border-slate-300 focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500/30 dark:text-slate-100 dark:hover:border-slate-700 dark:focus:bg-slate-950"
    />
  )
}
