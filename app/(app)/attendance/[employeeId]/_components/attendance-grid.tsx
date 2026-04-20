'use client'

import { useMemo, useState } from 'react'
import { useBlockingTransition } from '@/lib/ui/action-blocker'
import { saveAttendanceCells } from '@/lib/attendance/actions'
import {
  MONTH_NAMES,
  summarizeMonth,
  type AttendanceCell,
  type AttendanceStatus,
} from '@/lib/attendance/engine'

type Props = {
  employeeId: string
  year: number
  month: number
  initialCells: AttendanceCell[]
  leaveTypes: { id: number; code: string; name: string }[]
}

const CYCLE: AttendanceStatus[] = ['P', 'A', 'H', 'HOL', 'WO', 'LEAVE', 'LOP', 'NA']

const STATUS_STYLES: Record<AttendanceStatus, string> = {
  P:     'bg-green-100 text-green-800 border-green-200 dark:bg-green-950/60 dark:text-green-300 dark:border-green-900',
  A:     'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-900',
  H:     'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900',
  HOL:   'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-900',
  WO:    'bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  LEAVE: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-900',
  LOP:   'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-900',
  NA:    'bg-slate-50 text-slate-400 border-slate-200 dark:bg-slate-900 dark:text-slate-600 dark:border-slate-800',
}

export function AttendanceGrid({ employeeId, year, month, initialCells, leaveTypes }: Props) {
  const [cells, setCells] = useState<AttendanceCell[]>(initialCells)
  const [dirty, setDirty] = useState<Set<string>>(new Set())
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [pending, startTransition] = useBlockingTransition()

  const defaultLeaveTypeId = leaveTypes[0]?.id ?? null

  const summary = useMemo(() => summarizeMonth(year, month, cells), [cells, year, month])
  const weeks = useMemo(() => groupIntoWeeks(cells), [cells])

  const updateCell = (date: string, next: AttendanceStatus) => {
    setCells((prev) =>
      prev.map((c) =>
        c.attendance_date === date
          ? {
              ...c,
              status: next,
              leave_type_id: next === 'LEAVE' ? c.leave_type_id ?? defaultLeaveTypeId : null,
            }
          : c,
      ),
    )
    setDirty((d) => new Set(d).add(date))
  }

  const cycleCell = (cell: AttendanceCell) => {
    if (cell.locked) return
    const idx = CYCLE.indexOf(cell.status)
    const next = CYCLE[(idx + 1) % CYCLE.length]
    updateCell(cell.attendance_date, next)
  }

  const setLeaveType = (date: string, leaveTypeId: number) => {
    setCells((prev) =>
      prev.map((c) => (c.attendance_date === date ? { ...c, leave_type_id: leaveTypeId } : c)),
    )
    setDirty((d) => new Set(d).add(date))
  }

  const saveAll = () => {
    const toSave = cells.filter((c) => dirty.has(c.attendance_date))
    if (toSave.length === 0) return
    setMsg(null)
    startTransition(async () => {
      const result = await saveAttendanceCells(
        employeeId,
        toSave.map((c) => ({
          attendance_date: c.attendance_date,
          status: c.status,
          leave_type_id: c.leave_type_id ?? null,
          note: c.note ?? null,
        })),
      )
      if (result.error) {
        setMsg({ kind: 'err', text: result.error })
      } else {
        setMsg({ kind: 'ok', text: `Saved ${toSave.length} change(s).` })
        setDirty(new Set())
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Working" value={summary.workingDays} />
        <Stat label="Present" value={summary.presentDays} />
        <Stat label="Paid leave" value={summary.paidLeaveDays} />
        <Stat label="LOP" value={summary.lopDays} negative />
        <Stat label="Paid days" value={summary.paidDays} emphasis />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {MONTH_NAMES[month - 1]} {year}
          </h3>
          <div className="flex items-center gap-3">
            {msg && (
              <span
                className={`text-xs ${msg.kind === 'ok' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}
              >
                {msg.text}
              </span>
            )}
            <button
              type="button"
              onClick={saveAll}
              disabled={pending || dirty.size === 0}
              className="inline-flex h-9 items-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
            >
              {pending ? 'Saving…' : `Save ${dirty.size > 0 ? `(${dirty.size})` : ''}`}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-xs">
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => (
            <div key={d} className="py-1 text-center font-medium text-slate-500 dark:text-slate-400">{d}</div>
          ))}
          {weeks.flat().map((slot, idx) =>
            slot.cell ? (
              <button
                key={idx}
                type="button"
                onClick={() => cycleCell(slot.cell!)}
                disabled={slot.cell.locked}
                title={slot.cell.locked ? 'Locked by payroll' : `Click to cycle status`}
                className={`relative flex h-16 flex-col rounded-md border p-1 text-left transition ${
                  STATUS_STYLES[slot.cell.status]
                } ${slot.cell.locked ? 'opacity-70' : 'hover:brightness-95 active:scale-[.98]'} ${
                  dirty.has(slot.cell.attendance_date) ? 'ring-2 ring-offset-1 ring-slate-900 dark:ring-slate-100' : ''
                }`}
              >
                <span className="text-xs font-semibold">{Number(slot.cell.attendance_date.slice(-2))}</span>
                <span className="mt-auto text-[10px] font-medium uppercase tracking-wide">
                  {slot.cell.status}
                </span>
                {slot.cell.locked && <span className="absolute right-1 top-1 text-[10px]">🔒</span>}
              </button>
            ) : (
              <div key={idx} className="h-16 rounded-md bg-slate-50 dark:bg-slate-950" />
            ),
          )}
        </div>

        <div className="mt-4 space-y-2 border-t border-slate-200 pt-3 dark:border-slate-800">
          {cells.some((c) => c.status === 'LEAVE') && (
            <div className="text-xs text-slate-600 dark:text-slate-400">
              <strong className="text-slate-800 dark:text-slate-200">Leave type per day:</strong>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {cells
                  .filter((c) => c.status === 'LEAVE')
                  .map((c) => (
                    <div key={c.attendance_date} className="flex items-center gap-2">
                      <span className="tabular-nums">{c.attendance_date}</span>
                      <select
                        value={c.leave_type_id ?? defaultLeaveTypeId ?? ''}
                        onChange={(e) => setLeaveType(c.attendance_date, Number(e.target.value))}
                        disabled={c.locked}
                        className="h-7 rounded border border-slate-300 bg-white px-1 text-xs dark:border-slate-700 dark:bg-slate-950"
                      >
                        {leaveTypes.map((lt) => (
                          <option key={lt.id} value={lt.id}>{lt.code}</option>
                        ))}
                      </select>
                    </div>
                  ))}
              </div>
            </div>
          )}

          <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-600 dark:text-slate-400">
            <span>Legend:</span>
            {CYCLE.map((s) => (
              <span key={s} className={`rounded border px-1.5 py-0.5 ${STATUS_STYLES[s]}`}>{s}</span>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Click cells to cycle through statuses. LEAVE requires a leave type below the grid.
            Locked cells (🔒) are frozen by a completed payroll run.
          </p>
        </div>
      </div>
    </div>
  )
}

function Stat({
  label, value, emphasis, negative,
}: { label: string; value: number; emphasis?: boolean; negative?: boolean }) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        emphasis
          ? 'border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900'
          : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
      }`}
    >
      <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div
        className={`mt-0.5 text-lg font-semibold ${
          negative && value > 0 ? 'text-red-700 dark:text-red-400' : 'text-slate-900 dark:text-slate-50'
        }`}
      >
        {value}
      </div>
    </div>
  )
}

type WeekSlot = { cell: AttendanceCell | null }

function groupIntoWeeks(cells: AttendanceCell[]): WeekSlot[][] {
  if (cells.length === 0) return []
  const weeks: WeekSlot[][] = []
  let current: WeekSlot[] = []

  const firstDow = new Date(cells[0].attendance_date + 'T00:00:00Z').getUTCDay()
  for (let i = 0; i < firstDow; i++) current.push({ cell: null })

  for (const c of cells) {
    current.push({ cell: c })
    if (current.length === 7) {
      weeks.push(current)
      current = []
    }
  }
  while (current.length > 0 && current.length < 7) current.push({ cell: null })
  if (current.length) weeks.push(current)
  return weeks
}
