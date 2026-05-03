'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useBlockingTransition } from '@/lib/ui/action-blocker'
import { useSnackbar } from '@/components/ui/snackbar'
import { saveMonthPlanAction } from '@/lib/plan/actions'
import type { PlanRow, PlanKind, LeaveTypeOption } from '@/lib/plan/queries'

type DayCell = {
  iso: string
  dayNumber: number
  inMonth: boolean
  isToday: boolean
  isWeekend: boolean
  isHoliday: boolean
}

type LocalPlan = {
  date: string
  kind: PlanKind
  leave_type_id: number | null
  leave_code: string | null
  notes: string | null
}

const KIND_LABEL: Record<PlanKind, string> = {
  WFH: 'WFH',
  FIRST_HALF_LEAVE: '1st-half leave',
  SECOND_HALF_LEAVE: '2nd-half leave',
  FULL_DAY_LEAVE: 'Full-day leave',
}

const KIND_ICON: Record<PlanKind, string> = {
  WFH: '🏠',
  FIRST_HALF_LEAVE: '🌅',
  SECOND_HALF_LEAVE: '🌇',
  FULL_DAY_LEAVE: '🌴',
}

const KIND_COLOR: Record<PlanKind, string> = {
  WFH:               'bg-sky-100 text-sky-800 ring-sky-200 dark:bg-sky-900/40 dark:text-sky-200 dark:ring-sky-800',
  FIRST_HALF_LEAVE:  'bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:ring-amber-800',
  SECOND_HALF_LEAVE: 'bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:ring-amber-800',
  FULL_DAY_LEAVE:    'bg-rose-100 text-rose-800 ring-rose-200 dark:bg-rose-900/40 dark:text-rose-200 dark:ring-rose-800',
}

const DOW_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

export function CalendarClient({
  cells, plans: initialPlans, leaveTypes, monthLabel, year, month,
}: {
  cells: DayCell[]
  plans: PlanRow[]
  leaveTypes: LeaveTypeOption[]
  monthLabel: string
  year: number
  month: number   // 1..12
}) {
  const router = useRouter()
  const snack = useSnackbar()
  const [pending, startTransition] = useBlockingTransition()

  // Hydrate the local map once. After that, the client owns the truth until
  // Save. router.refresh() after save will reflow the parent with new data,
  // but we keep our state — Save just succeeded.
  const [plans, setPlans] = useState<Map<string, LocalPlan>>(() => {
    const m = new Map<string, LocalPlan>()
    for (const p of initialPlans) {
      m.set(p.date, {
        date: p.date,
        kind: p.kind,
        leave_type_id: p.leave_type_id,
        leave_code: p.leave_code,
        notes: p.notes,
      })
    }
    return m
  })
  const [isDirty, setIsDirty] = useState(false)
  const [openDate, setOpenDate] = useState<string | null>(null)

  const setPlanLocal = (next: LocalPlan) => {
    setPlans((prev) => {
      const m = new Map(prev)
      m.set(next.date, next)
      return m
    })
    setIsDirty(true)
  }
  const removePlanLocal = (date: string) => {
    setPlans((prev) => {
      if (!prev.has(date)) return prev
      const m = new Map(prev)
      m.delete(date)
      return m
    })
    setIsDirty(true)
  }

  const save = () => {
    if (pending || !isDirty) return
    const fd = new FormData()
    fd.set('year', String(year))
    fd.set('month', String(month))
    const entries = Array.from(plans.values()).map((p) => ({
      date: p.date,
      kind: p.kind,
      leave_type_id: p.kind === 'WFH' ? null : p.leave_type_id,
      notes: p.notes,
    }))
    fd.set('entries', JSON.stringify(entries))
    startTransition(async () => {
      const res = await saveMonthPlanAction(fd)
      if (res.error) {
        snack.show({ kind: 'error', message: res.error })
        return
      }
      snack.show({
        kind: 'success',
        message: `Saved ${res.saved ?? 0} day${res.saved === 1 ? '' : 's'} for ${monthLabel}.`,
      })
      setIsDirty(false)
      router.refresh()
    })
  }

  // Ctrl/Cmd+S to save
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault()
        if (isDirty && !pending) save()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plans, isDirty, pending])

  const editing = openDate ? (plans.get(openDate) ?? null) : null

  return (
    <>
      {/* Action bar */}
      <div className="sticky top-0 z-10 -mx-2 mb-2 flex items-center justify-between rounded-md border border-slate-200 bg-white/90 px-3 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div className="text-xs text-slate-500">
          {isDirty
            ? <span className="font-medium text-red-700 dark:text-red-400">Unsaved changes — press Ctrl+S to save</span>
            : <span>All changes saved · {plans.size} planned day{plans.size === 1 ? '' : 's'}</span>}
        </div>
        <button
          type="button"
          onClick={save}
          disabled={pending || !isDirty}
          className={`inline-flex h-9 items-center whitespace-nowrap rounded-md px-4 text-sm font-medium text-white shadow-sm disabled:opacity-50 ${
            isDirty
              ? 'bg-red-600 hover:bg-red-700 active:bg-red-800'
              : 'bg-brand-600 hover:bg-brand-700'
          }`}
        >
          {pending ? 'Saving…' : isDirty ? 'Save (Ctrl+S)' : 'Saved'}
        </button>
      </div>

      <div>
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
          {DOW_LABELS.map((d) => (
            <div key={d} className="px-3 py-2 text-center">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((c) => {
            const plan = plans.get(c.iso)
            return (
              <button
                key={c.iso}
                type="button"
                onClick={() => setOpenDate(c.iso)}
                disabled={!c.inMonth}
                className={`group flex h-24 flex-col items-stretch border-b border-r border-slate-100 p-1.5 text-left transition-colors dark:border-slate-800 ${
                  c.inMonth ? 'hover:bg-slate-50 dark:hover:bg-slate-950/50 cursor-pointer' : 'bg-slate-50/40 dark:bg-slate-950/20 cursor-not-allowed'
                } ${c.isToday ? 'ring-2 ring-inset ring-brand-500' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-medium tabular-nums ${
                    !c.inMonth ? 'text-slate-400'
                    : c.isWeekend || c.isHoliday ? 'text-rose-600 dark:text-rose-400'
                    : 'text-slate-900 dark:text-slate-100'
                  }`}>
                    {c.dayNumber}
                  </span>
                  {c.isHoliday && <span title="Holiday" className="text-[9px] uppercase font-semibold tracking-wide text-rose-600 dark:text-rose-400">Holiday</span>}
                </div>
                {plan && (
                  <div className={`mt-1 inline-flex items-center gap-1 self-start rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset ${KIND_COLOR[plan.kind]}`}>
                    <span>{KIND_ICON[plan.kind]}</span>
                    <span>{KIND_LABEL[plan.kind]}</span>
                    {plan.leave_code && <span className="opacity-70">· {plan.leave_code}</span>}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {openDate && (
        <DayEditor
          date={openDate}
          plan={editing}
          leaveTypes={leaveTypes}
          monthLabel={monthLabel}
          onClose={() => setOpenDate(null)}
          onSave={(p) => { setPlanLocal(p); setOpenDate(null) }}
          onClear={() => { removePlanLocal(openDate); setOpenDate(null) }}
        />
      )}
    </>
  )
}

// -----------------------------------------------------------------------------
function DayEditor({
  date, plan, leaveTypes, monthLabel, onClose, onSave, onClear,
}: {
  date: string
  plan: LocalPlan | null
  leaveTypes: LeaveTypeOption[]
  monthLabel: string
  onClose: () => void
  onSave: (p: LocalPlan) => void
  onClear: () => void
}) {
  const [kind, setKind] = useState<PlanKind | ''>(plan?.kind ?? '')
  const [leaveTypeId, setLeaveTypeId] = useState<string>(plan?.leave_type_id ? String(plan.leave_type_id) : '')
  const [notes, setNotes] = useState<string>(plan?.notes ?? '')

  const dateLabel = new Date(date + 'T00:00:00Z').toLocaleDateString('en-IN', {
    weekday: 'long', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
  })

  const apply = () => {
    if (!kind) return
    if (kind !== 'WFH' && !leaveTypeId) return
    const leaveTypeIdNum = kind === 'WFH' ? null : Number(leaveTypeId)
    const leaveCode = leaveTypeIdNum
      ? leaveTypes.find((l) => l.id === leaveTypeIdNum)?.code ?? null
      : null
    onSave({
      date,
      kind,
      leave_type_id: leaveTypeIdNum,
      leave_code: leaveCode,
      notes: notes.trim() || null,
    })
  }

  const showLeaveType = kind === 'FIRST_HALF_LEAVE' || kind === 'SECOND_HALF_LEAVE' || kind === 'FULL_DAY_LEAVE'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4">
          <div className="text-xs uppercase tracking-wide text-slate-500">{monthLabel}</div>
          <div className="text-lg font-semibold text-slate-900 dark:text-slate-50">{dateLabel}</div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">Plan type</label>
            <div className="grid grid-cols-2 gap-2">
              {(['WFH', 'FIRST_HALF_LEAVE', 'SECOND_HALF_LEAVE', 'FULL_DAY_LEAVE'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                    kind === k
                      ? 'border-brand-500 bg-brand-50 text-brand-900 dark:border-brand-700 dark:bg-brand-950/40 dark:text-brand-100'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                  }`}
                >
                  <div className="text-base">{KIND_ICON[k]}</div>
                  <div className="text-[11px] font-medium uppercase tracking-wide">{KIND_LABEL[k]}</div>
                </button>
              ))}
            </div>
          </div>

          {showLeaveType && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Leave type <span className="text-red-600">*</span>
              </label>
              <select
                value={leaveTypeId}
                onChange={(e) => setLeaveTypeId(e.target.value)}
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="">Select…</option>
                {leaveTypes.map((lt) => (
                  <option key={lt.id} value={lt.id}>{lt.code} — {lt.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Doctor's appointment, family event, focus day at home"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
        </div>

        <p className="mt-3 text-[11px] text-slate-500">
          This adds the day to your draft. Click <strong>Save</strong> on the calendar bar (or press Ctrl+S) to persist all changes.
        </p>

        <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          {plan ? (
            <button
              type="button"
              onClick={onClear}
              className="text-sm font-medium text-red-700 hover:underline dark:text-red-400"
            >
              Clear day
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={apply}
              disabled={!kind || (showLeaveType && !leaveTypeId)}
              className="h-9 rounded-md bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:opacity-60"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
