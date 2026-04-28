'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useBlockingTransition } from '@/lib/ui/action-blocker'
import { useSnackbar } from '@/components/ui/snackbar'
import { saveWeekDraftAction, submitWeekAction } from '@/lib/timesheet/actions'

type WorkMode = 'WFH' | 'WFO'
type Source = 'manual' | 'timer' | 'auto'

export type ClientRow = {
  // Stable identifier across renders for React key. Server-side ids aren't
  // useful here because we use replace-semantics on save.
  clientId: string
  project_id: number
  project_code: string
  project_name: string
  activity_type_id: number
  activity_code: string
  activity_name: string
  task: string | null
  description: string | null
  work_mode: WorkMode
  source: Source
  hoursByDate: Record<string, number>
}

type Project = { id: number; code: string; name: string }
type Activity = { id: number; code: string; name: string }

type Day = { iso: string; label: string; dayNumber: string }

type Props = {
  weekStart: string
  weekStatus: 'draft' | 'submitted' | 'approved' | 'rejected'
  todayIso: string
  days: Day[]
  initialRows: ClientRow[]
  projects: Project[]
  activityTypes: Activity[]
}

export function WeekClient({
  weekStart, weekStatus, todayIso, days, initialRows, projects, activityTypes,
}: Props) {
  const router = useRouter()
  const snack = useSnackbar()
  const [pending, startTransition] = useBlockingTransition()
  const [rows, setRows] = useState<ClientRow[]>(initialRows)
  const [isDirty, setIsDirty] = useState(false)
  const [adding, setAdding] = useState(false)
  const isLocked = weekStatus === 'submitted' || weekStatus === 'approved'
  const canEdit = !isLocked
  // After save/submit/reopen, the page calls router.refresh() — Next ships
  // fresh server data and React reuses this component instance. We keep our
  // local rows as the source of truth (they already reflect what was just
  // saved). For week-level state changes (status flip), the parent's
  // weekStatus prop drives `canEdit` directly, no local resync needed.

  // ---------- Cell + row mutations ----------
  const updateHours = (clientId: string, dateIso: string, hours: number) => {
    setRows((prev) => prev.map((r) =>
      r.clientId !== clientId ? r : {
        ...r,
        hoursByDate: { ...r.hoursByDate, [dateIso]: hours },
      },
    ))
    setIsDirty(true)
  }
  const addRow = (input: { project_id: number; activity_type_id: number; task: string; work_mode: WorkMode }) => {
    const proj = projects.find((p) => p.id === input.project_id)
    const act = activityTypes.find((a) => a.id === input.activity_type_id)
    if (!proj || !act) return
    const newRow: ClientRow = {
      clientId: cryptoRandomId(),
      project_id: input.project_id,
      project_code: proj.code,
      project_name: proj.name,
      activity_type_id: input.activity_type_id,
      activity_code: act.code,
      activity_name: act.name,
      task: input.task.trim() || null,
      description: null,
      work_mode: input.work_mode,
      source: 'manual',
      hoursByDate: {},
    }
    setRows((prev) => [...prev, newRow])
    setIsDirty(true)
    setAdding(false)
  }
  const removeRow = (clientId: string) => {
    setRows((prev) => prev.filter((r) => r.clientId !== clientId))
    setIsDirty(true)
  }

  // ---------- Save ----------
  const save = () => {
    if (!isDirty || pending) return
    const fd = new FormData()
    fd.set('week_start', weekStart)
    fd.set('rows', JSON.stringify(rows))
    startTransition(async () => {
      const res = await saveWeekDraftAction(fd)
      if (res.error) {
        snack.show({ kind: 'error', message: res.error })
        return
      }
      snack.show({ kind: 'success', message: `Saved ${res.saved ?? 0} entr${res.saved === 1 ? 'y' : 'ies'}.` })
      setIsDirty(false)
      router.refresh()
    })
  }

  // ---------- Submit ----------
  const submit = () => {
    if (isDirty) {
      snack.show({ kind: 'warn', message: 'You have unsaved changes. Save them first, then submit.' })
      return
    }
    const total = rows.reduce((s, r) => s + Object.values(r.hoursByDate).reduce((a, b) => a + Number(b || 0), 0), 0)
    if (!confirm(`Submit week starting ${weekStart} for approval?\n\nTotal hours: ${total.toFixed(2)}\n\nOnce submitted you can't edit until your manager either approves or rejects.`)) return
    const fd = new FormData()
    fd.set('week_start', weekStart)
    startTransition(async () => {
      const res = await submitWeekAction(fd)
      if (res.error) snack.show({ kind: 'error', message: res.error })
      else {
        snack.show({ kind: 'success', message: 'Week submitted for approval.' })
        router.refresh()
      }
    })
  }

  // ---------- Ctrl+S / Cmd+S ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault()
        if (canEdit) save()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, isDirty, pending, canEdit, weekStart])

  // Daily totals
  const dailyTotals: Record<string, number> = {}
  for (const d of days) dailyTotals[d.iso] = 0
  let weekTotal = 0
  for (const r of rows) {
    for (const [d, h] of Object.entries(r.hoursByDate)) {
      const v = Number(h || 0)
      dailyTotals[d] = (dailyTotals[d] ?? 0) + v
      weekTotal += v
    }
  }

  return (
    <>
      {/* Action bar — Save (red, when dirty) OR Submit (brand, when clean) */}
      <div className="sticky top-0 z-10 -mx-2 mb-2 flex items-center justify-between rounded-md border border-slate-200 bg-white/90 px-3 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div className="text-xs text-slate-500">
          {isDirty
            ? <span className="font-medium text-red-700 dark:text-red-400">Unsaved changes — press Ctrl+S to save</span>
            : isLocked
              ? <span>Read-only ({weekStatus}). Reopen to edit.</span>
              : <span>All changes saved · {rows.length} row{rows.length === 1 ? '' : 's'} · {weekTotal.toFixed(2)}h total</span>}
        </div>
        {canEdit && (
          isDirty ? (
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="inline-flex h-9 items-center whitespace-nowrap rounded-md bg-red-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-red-700 active:bg-red-800 disabled:opacity-60"
            >
              {pending ? 'Saving…' : 'Save (Ctrl+S)'}
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={pending || rows.length === 0}
              className="inline-flex h-9 items-center whitespace-nowrap rounded-md bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 disabled:opacity-60"
            >
              {pending ? 'Submitting…' : 'Submit'}
            </button>
          )
        )}
      </div>

      {/* Grid */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 w-[260px]">Project / Activity / Task</th>
                {days.map((d) => (
                  <th key={d.iso} className={`px-2 py-3 text-center ${d.iso === todayIso ? 'bg-brand-50 dark:bg-brand-950/30' : ''}`}>
                    <div className="text-[10px] tracking-wide text-slate-500">{d.label}</div>
                    <div className="text-base font-semibold tabular-nums text-slate-900 dark:text-slate-50">{d.dayNumber}</div>
                  </th>
                ))}
                <th className="px-4 py-3 text-right">Total</th>
                {canEdit && <th className="px-2 py-3"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={(canEdit ? 10 : 9)} className="px-6 py-12 text-center text-sm text-slate-500">
                    No rows yet. Click <span className="font-medium">+ Add row</span> below to start logging.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const rowTotal = Object.values(r.hoursByDate).reduce((s, h) => s + Number(h || 0), 0)
                  return (
                    <tr key={r.clientId}>
                      <td className="px-4 py-2.5 align-top">
                        <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                          <span>{r.project_code} <span className="font-normal text-slate-500">· {r.project_name}</span></span>
                          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                            r.work_mode === 'WFH'
                              ? 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200'
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                          }`}>
                            {r.work_mode === 'WFH' ? '🏠 WFH' : '🏢 WFO'}
                          </span>
                          {r.source === 'auto' && (
                            <span
                              title="Pre-filled from your leave / holiday calendar. Edit if you actually worked that day."
                              className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                            >
                              ✨ auto
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {r.activity_code}
                          {r.task ? <> · <span className="italic">{r.task}</span></> : null}
                        </div>
                      </td>
                      {days.map((d) => (
                        <td key={d.iso} className={`px-2 py-2 text-center ${d.iso === todayIso ? 'bg-brand-50/40 dark:bg-brand-950/20' : ''}`}>
                          <CellInput
                            value={r.hoursByDate[d.iso] ?? 0}
                            disabled={!canEdit}
                            onChange={(v) => updateHours(r.clientId, d.iso, v)}
                          />
                        </td>
                      ))}
                      <td className="px-4 py-2 text-right text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                        {rowTotal.toFixed(2)}
                      </td>
                      {canEdit && (
                        <td className="px-2 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => removeRow(r.clientId)}
                            title="Remove row"
                            className="text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                          >
                            ×
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                })
              )}

              <tr className="bg-slate-50/60 dark:bg-slate-950/30">
                <td className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Daily total</td>
                {days.map((d) => (
                  <td key={d.iso} className="px-2 py-2 text-center text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                    {(dailyTotals[d.iso] ?? 0).toFixed(2)}
                  </td>
                ))}
                <td className="px-4 py-2 text-right text-base font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                  {weekTotal.toFixed(2)}
                </td>
                {canEdit && <td />}
              </tr>
            </tbody>
          </table>
        </div>

        {canEdit && (
          <div className="border-t border-slate-100 p-4 dark:border-slate-800">
            {adding ? (
              <AddRowInline
                projects={projects}
                activityTypes={activityTypes}
                onAdd={addRow}
                onCancel={() => setAdding(false)}
              />
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="inline-flex h-9 items-center rounded-md border border-dashed border-slate-300 px-3 text-sm font-medium text-slate-600 hover:border-brand-400 hover:text-brand-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand-700 dark:hover:text-brand-400"
              >
                + Add row
              </button>
            )}
          </div>
        )}
      </div>
    </>
  )
}

// -----------------------------------------------------------------------------
function CellInput({
  value, disabled, onChange,
}: { value: number; disabled: boolean; onChange: (v: number) => void }) {
  if (disabled) {
    return (
      <span className="block w-full rounded-md py-1.5 text-center text-sm tabular-nums text-slate-700 dark:text-slate-200">
        {value > 0 ? value.toFixed(2) : '—'}
      </span>
    )
  }

  const display = value > 0 ? value.toFixed(2) : ''

  const commit = (raw: string, el: HTMLInputElement) => {
    const trimmed = raw.trim()
    if (trimmed === '') {
      onChange(0)
      return
    }
    const n = Number(trimmed)
    if (!Number.isFinite(n) || n < 0 || n > 24) {
      // Reset to last known good — uncontrolled input value rewrite
      el.value = display
      return
    }
    const rounded = Math.round(n * 4) / 4
    onChange(rounded)
    el.value = rounded > 0 ? rounded.toFixed(2) : ''
  }

  // Uncontrolled input keyed by the canonical value. When `value` changes
  // externally (e.g. on save/refresh) the key flips and the DOM input
  // remounts with the fresh defaultValue. While the user is typing, React
  // never resets the DOM value, so input flow is uninterrupted.
  return (
    <input
      key={display}
      type="text"
      inputMode="decimal"
      defaultValue={display}
      onBlur={(e) => commit(e.currentTarget.value, e.currentTarget)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') {
          ;(e.currentTarget).value = display
          ;(e.target as HTMLInputElement).blur()
        }
      }}
      placeholder="—"
      className="block h-8 w-full max-w-[60px] rounded-md border border-transparent bg-transparent text-center text-sm tabular-nums text-slate-900 outline-none transition-colors hover:border-slate-300 focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500/30 dark:text-slate-100 dark:hover:border-slate-700 dark:focus:bg-slate-950"
    />
  )
}

// -----------------------------------------------------------------------------
function AddRowInline({
  projects, activityTypes, onAdd, onCancel,
}: {
  projects: Project[]
  activityTypes: Activity[]
  onAdd: (input: { project_id: number; activity_type_id: number; task: string; work_mode: WorkMode }) => void
  onCancel: () => void
}) {
  const [projectId, setProjectId] = useState<string>('')
  const [activityId, setActivityId] = useState<string>('')
  const [task, setTask] = useState('')
  const [mode, setMode] = useState<WorkMode>('WFO')

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!projectId || !activityId) return
    onAdd({
      project_id: Number(projectId),
      activity_type_id: Number(activityId),
      task,
      work_mode: mode,
    })
  }

  return (
    <form onSubmit={submit} className="grid gap-2 sm:grid-cols-[1fr_180px_1fr_110px_auto_auto]">
      <select value={projectId} onChange={(e) => setProjectId(e.target.value)} required className={inputCls}>
        <option value="">Project…</option>
        {projects.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
      </select>
      <select value={activityId} onChange={(e) => setActivityId(e.target.value)} required className={inputCls}>
        <option value="">Activity…</option>
        {activityTypes.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
      </select>
      <input value={task} onChange={(e) => setTask(e.target.value)} type="text" placeholder="Task (optional)" className={inputCls} />
      <select value={mode} onChange={(e) => setMode(e.target.value as WorkMode)} className={inputCls} title="Work mode">
        <option value="WFO">🏢 WFO</option>
        <option value="WFH">🏠 WFH</option>
      </select>
      <button
        type="button"
        onClick={onCancel}
        className="h-9 rounded-md border border-slate-300 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
      >
        Cancel
      </button>
      <button
        type="submit"
        className="h-9 rounded-md bg-brand-600 px-3 text-xs font-medium text-white hover:bg-brand-700"
      >
        Add row
      </button>
    </form>
  )
}

const inputCls = 'h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950'

// Tiny client-side id — fine for React keys.
function cryptoRandomId(): string {
  const c = (typeof globalThis !== 'undefined' ? (globalThis as { crypto?: Crypto }).crypto : undefined)
  if (c && 'randomUUID' in c) return c.randomUUID()
  return 'r_' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}
