'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useBlockingTransition } from '@/lib/ui/action-blocker'
import { useSnackbar } from '@/components/ui/snackbar'
import { startTimerAction, stopTimerAction } from '@/lib/timesheet/actions'

type Project = { id: number; code: string; name: string }
type Activity = { id: number; code: string; name: string }

type ActiveTimer = {
  project_code: string
  project_name: string
  activity_code: string
  activity_name: string
  task: string | null
  work_mode: 'WFH' | 'WFO'
  startedAt: string
} | null

export function TimerBar({
  timer, projects, activityTypes,
}: {
  timer: ActiveTimer
  projects: Project[]
  activityTypes: Activity[]
}) {
  const router = useRouter()
  const snack = useSnackbar()
  const [pending, startTransition] = useBlockingTransition()
  const [picking, setPicking] = useState(false)

  if (timer) {
    return <RunningBar timer={timer} pending={pending} startTransition={startTransition} router={router} snack={snack} />
  }

  if (!picking) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-dashed border-slate-300 bg-white px-4 py-2.5 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <ClockIcon /> No timer running.
        </div>
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="inline-flex h-8 items-center rounded-md bg-brand-600 px-3 text-xs font-medium text-white shadow-sm hover:bg-brand-700"
        >
          ▶ Start timer
        </button>
      </div>
    )
  }

  const start = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await startTimerAction(fd)
      if (res.error) snack.show({ kind: 'error', message: res.error })
      else {
        snack.show({ kind: 'success', message: 'Timer started.' })
        setPicking(false)
        router.refresh()
      }
    })
  }

  return (
    <form onSubmit={start} className="rounded-lg border border-brand-300 bg-brand-50/40 px-4 py-3 dark:border-brand-800 dark:bg-brand-950/30">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">
        <ClockIcon /> Start a new timer
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_180px_1fr_110px_auto_auto]">
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
          onClick={() => setPicking(false)}
          className="h-9 rounded-md border border-slate-300 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="h-9 rounded-md bg-brand-600 px-3 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? 'Starting…' : '▶ Start'}
        </button>
      </div>
    </form>
  )
}

type Snack = ReturnType<typeof useSnackbar>
type Router = ReturnType<typeof useRouter>

function RunningBar({
  timer, pending, startTransition, router, snack,
}: {
  timer: NonNullable<ActiveTimer>
  pending: boolean
  startTransition: (cb: () => void) => void
  router: Router
  snack: Snack
}) {
  const [elapsed, setElapsed] = useState(() => Date.now() - new Date(timer.startedAt).getTime())

  useEffect(() => {
    const id = setInterval(() => setElapsed(Date.now() - new Date(timer.startedAt).getTime()), 1000)
    return () => clearInterval(id)
  }, [timer.startedAt])

  const stop = () => {
    startTransition(async () => {
      const res = await stopTimerAction()
      if (res.error) snack.show({ kind: 'error', message: res.error })
      else {
        const hrs = res.loggedHours ?? 0
        snack.show({
          kind: 'success',
          message: hrs > 0
            ? `Timer stopped. Logged ${hrs.toFixed(2)}h to ${timer.project_code} · ${timer.activity_code}.`
            : 'Timer stopped (under 15 min — not logged).',
        })
        router.refresh()
      }
    })
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2.5 dark:border-emerald-800 dark:bg-emerald-950/40">
      <div className="flex items-center gap-3">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500 opacity-75"></span>
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-600"></span>
        </span>
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-50">
            <span>{timer.project_code} <span className="text-slate-500">·</span> {timer.activity_code}</span>
            {timer.task && <span><span className="text-slate-500">·</span> <span className="italic text-slate-700 dark:text-slate-300">{timer.task}</span></span>}
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              timer.work_mode === 'WFH'
                ? 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200'
                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
            }`}>
              {timer.work_mode === 'WFH' ? '🏠 WFH' : '🏢 WFO'}
            </span>
          </div>
          <div className="text-[11px] text-slate-500">
            {timer.project_name} · started {new Date(timer.startedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="rounded-md bg-white px-3 py-1.5 text-base font-semibold tabular-nums text-emerald-800 shadow-sm dark:bg-slate-900 dark:text-emerald-300">
          {formatElapsed(elapsed)}
        </div>
        <button
          type="button"
          onClick={stop}
          disabled={pending}
          className="inline-flex h-9 items-center rounded-md bg-rose-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-rose-700 disabled:opacity-60"
        >
          {pending ? 'Stopping…' : '■ Stop'}
        </button>
      </div>
    </div>
  )
}

function formatElapsed(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const inputCls = 'h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950'

function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}
