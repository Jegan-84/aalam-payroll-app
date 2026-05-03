'use client'

import * as React from 'react'
import Papa from 'papaparse'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { useSnackbar } from '@/components/ui/snackbar'
import { useBlockingTransition } from '@/lib/ui/action-blocker'
import {
  importTimesheetEntriesAction,
  type TimesheetImportRow,
} from '@/lib/timesheet/actions'

type Project = { code: string; name: string }
type Activity = { code: string; name: string }

type StagedRow = TimesheetImportRow & {
  __line: number              // 1-based row number from the source file
  __error: string | null      // null = ready to save
  __weekStart: string         // Mon (UTC) of the entry_date
}

type WeekGroup = {
  weekStart: string
  weekEnd: string
  rows: StagedRow[]
  validCount: number
  invalidCount: number
  totalHours: number
}

export function ImportClient({
  projects, activities,
}: {
  projects: Project[]
  activities: Activity[]
}) {
  const router = useRouter()
  const snack = useSnackbar()
  const fileRef = React.useRef<HTMLInputElement>(null)
  const [pending, startTransition] = useBlockingTransition()

  const [rows, setRows] = React.useState<StagedRow[]>([])
  const [fileName, setFileName] = React.useState<string | null>(null)
  const [parseError, setParseError] = React.useState<string | null>(null)

  const projectCodes = React.useMemo(
    () => new Set(projects.map((p) => p.code.toUpperCase())),
    [projects],
  )
  const activityCodes = React.useMemo(
    () => new Set(activities.map((a) => a.code.toUpperCase())),
    [activities],
  )

  const reset = () => {
    setRows([])
    setFileName(null)
    setParseError(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const onPick = () => fileRef.current?.click()

  const validateRow = (r: TimesheetImportRow): string | null => {
    if (!r.entry_date || !/^\d{4}-\d{2}-\d{2}$/.test(r.entry_date)) return 'Date must be YYYY-MM-DD'
    if (!r.project_code || !r.activity_code) return 'Project and activity codes required'
    if (!projectCodes.has(String(r.project_code).toUpperCase())) return `Unknown project "${r.project_code}"`
    if (!activityCodes.has(String(r.activity_code).toUpperCase())) return `Unknown activity "${r.activity_code}"`
    const start = (r.start_time ?? '').toString().trim()
    const end = (r.end_time ?? '').toString().trim()
    if (start && !/^\d{2}:\d{2}$/.test(start)) return 'start_time must be HH:MM'
    if (end && !/^\d{2}:\d{2}$/.test(end)) return 'end_time must be HH:MM'
    const hasHours = r.hours !== undefined && String(r.hours).trim() !== ''
    const hasRange = !!start && !!end
    if (!hasHours && !hasRange) return 'Provide hours, or both start_time and end_time'
    if (hasHours) {
      const h = Number(r.hours)
      if (!Number.isFinite(h) || h <= 0 || h > 24) return 'hours must be 0–24'
    }
    if (r.work_mode) {
      const m = String(r.work_mode).toUpperCase()
      if (m !== 'WFH' && m !== 'WFO') return 'work_mode must be WFH or WFO'
    }
    return null
  }

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (res) => {
        if (res.errors.length > 0) {
          setParseError(res.errors.map((x) => x.message).join('; '))
        } else {
          setParseError(null)
        }
        const parsed: StagedRow[] = (res.data ?? []).map((raw, idx) => {
          const r: TimesheetImportRow = {
            entry_date: (raw.entry_date ?? '').trim(),
            project_code: (raw.project_code ?? '').trim(),
            activity_code: (raw.activity_code ?? '').trim(),
            task: (raw.task ?? '').trim() || undefined,
            description: (raw.description ?? '').trim() || undefined,
            hours: (raw.hours ?? '').trim() || undefined,
            start_time: (raw.start_time ?? '').trim() || undefined,
            end_time: (raw.end_time ?? '').trim() || undefined,
            work_mode: (raw.work_mode ?? '').trim() || undefined,
          }
          const error = validateRow(r)
          const weekStart = error ? '' : mondayOf(r.entry_date)
          return { ...r, __line: idx + 1, __error: error, __weekStart: weekStart }
        })
        setRows(parsed)
      },
      error: (err) => {
        setParseError(err.message)
        snack.show({ kind: 'error', message: `Parse failed: ${err.message}` })
      },
    })
    // Reset so picking the same file again still triggers onChange
    e.target.value = ''
  }

  const groups = React.useMemo<WeekGroup[]>(() => {
    const map = new Map<string, WeekGroup>()
    // Bucket invalid rows under a synthetic '___invalid' group when they have
    // no parseable date, otherwise group with their week.
    for (const r of rows) {
      const key = r.__weekStart || '___invalid'
      let g = map.get(key)
      if (!g) {
        const weekEnd = key === '___invalid' ? '' : addDays(key, 6)
        g = { weekStart: key, weekEnd, rows: [], validCount: 0, invalidCount: 0, totalHours: 0 }
        map.set(key, g)
      }
      g.rows.push(r)
      if (r.__error) g.invalidCount += 1
      else g.validCount += 1
      // Only sum hours for valid rows
      if (!r.__error) {
        const h = r.hours !== undefined && r.hours !== ''
          ? Number(r.hours)
          : (r.start_time && r.end_time ? hoursBetween(r.start_time, r.end_time) : 0)
        if (Number.isFinite(h) && h > 0) g.totalHours += h
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      // Push the invalid bucket last
      if (a.weekStart === '___invalid') return 1
      if (b.weekStart === '___invalid') return -1
      return a.weekStart.localeCompare(b.weekStart)
    })
  }, [rows])

  const totalValid = rows.filter((r) => !r.__error).length
  const totalInvalid = rows.length - totalValid

  const onConfirm = () => {
    const valid = rows.filter((r) => !r.__error)
    if (valid.length === 0) {
      snack.show({ kind: 'warn', message: 'Nothing valid to save. Fix the rows first.' })
      return
    }
    startTransition(async () => {
      const payload: TimesheetImportRow[] = valid.map((r) => ({
        entry_date: r.entry_date,
        project_code: r.project_code,
        activity_code: r.activity_code,
        task: r.task,
        description: r.description,
        hours: r.hours,
        start_time: r.start_time,
        end_time: r.end_time,
        work_mode: r.work_mode,
      }))
      try {
        const res = await importTimesheetEntriesAction(payload)
        const skipped = res.skipped ?? []
        if (res.created > 0 && skipped.length === 0) {
          snack.show({ kind: 'success', message: `Created ${res.created} entries.` })
          reset()
          router.push('/me/timesheet')
        } else if (res.created > 0) {
          snack.show({
            kind: 'warn',
            message: `Created ${res.created} · skipped ${skipped.length} (${skipped[0]?.reason ?? 'see preview'}).`,
          })
          // Mark the skipped lines on the staged rows so the user can fix
          const skippedByLine = new Map(skipped.map((s) => [s.row, s.reason]))
          setRows((prev) => prev.map((r) =>
            skippedByLine.has(r.__line)
              ? { ...r, __error: skippedByLine.get(r.__line) ?? 'Skipped' }
              : r,
          ))
        } else {
          snack.show({ kind: 'error', message: `All ${skipped.length} rows failed. ${skipped[0]?.reason ?? ''}` })
        }
      } catch (err) {
        snack.show({ kind: 'error', message: (err as Error).message || 'Import failed.' })
      }
    })
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        onChange={onFile}
        className="hidden"
      />

      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onPick}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
          >
            ⬆ Choose CSV file
          </button>
          {fileName && (
            <span className="text-xs text-slate-600 dark:text-slate-300">
              <span className="font-medium">{fileName}</span> · {rows.length} row{rows.length === 1 ? '' : 's'}
              {' · '}
              <span className="text-emerald-700 dark:text-emerald-400">{totalValid} valid</span>
              {totalInvalid > 0 && <> · <span className="text-red-700 dark:text-red-400">{totalInvalid} with errors</span></>}
            </span>
          )}
          {fileName && (
            <button type="button" onClick={reset} className="ml-auto text-xs text-slate-500 hover:underline">
              Clear &amp; pick another file
            </button>
          )}
        </div>
        {parseError && (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            CSV parse warnings: {parseError}
          </div>
        )}
      </Card>

      {rows.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
              Preview — {groups.length} week{groups.length === 1 ? '' : 's'} affected
            </h2>
            <p className="text-[11px] text-slate-500">
              Rows are grouped by Monday-anchored week. Submitted/approved weeks will be skipped server-side.
            </p>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={reset}
                disabled={pending}
                className="inline-flex h-9 items-center rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={pending || totalValid === 0}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
              >
                {pending ? <><Spinner size="xs" /> Saving…</> : `Confirm & save ${totalValid} row${totalValid === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {groups.map((g) => (
              <WeekGroupCard key={g.weekStart} group={g} />
            ))}
          </div>
        </>
      )}
    </>
  )
}

// -----------------------------------------------------------------------------
function WeekGroupCard({ group }: { group: WeekGroup }) {
  const [expanded, setExpanded] = React.useState(true)
  const isInvalidBucket = group.weekStart === '___invalid'
  const label = isInvalidBucket
    ? 'Rows with bad dates'
    : `Week of ${formatDate(group.weekStart)} – ${formatDate(group.weekEnd)}`

  return (
    <Card className="overflow-hidden p-0">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-3 text-left dark:border-slate-800 dark:bg-slate-950/40"
      >
        <span className={`text-sm font-semibold ${isInvalidBucket ? 'text-red-700 dark:text-red-400' : 'text-slate-900 dark:text-slate-50'}`}>
          {label}
        </span>
        <span className="text-[11px] text-slate-500">
          {group.rows.length} row{group.rows.length === 1 ? '' : 's'}
          {!isInvalidBucket && <> · {group.totalHours.toFixed(2)}h total</>}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {group.validCount > 0 && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
              {group.validCount} ready
            </span>
          )}
          {group.invalidCount > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-800 dark:bg-red-900/40 dark:text-red-200">
              {group.invalidCount} error{group.invalidCount === 1 ? '' : 's'}
            </span>
          )}
          <span className="text-slate-400">{expanded ? '▾' : '▸'}</span>
        </div>
      </button>
      {expanded && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50/40 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/30 dark:text-slate-400">
              <tr>
                <th className="px-3 py-2 w-10">#</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Project</th>
                <th className="px-3 py-2">Activity</th>
                <th className="px-3 py-2">Task</th>
                <th className="px-3 py-2 text-right">Hours</th>
                <th className="px-3 py-2">Start–End</th>
                <th className="px-3 py-2">Mode</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {group.rows.map((r) => (
                <tr key={r.__line} className={r.__error ? 'bg-red-50/40 dark:bg-red-950/20' : ''}>
                  <td className="px-3 py-1.5 text-center text-slate-400 tabular-nums">{r.__line}</td>
                  <td className="px-3 py-1.5 tabular-nums">{r.entry_date || <span className="text-slate-300">—</span>}</td>
                  <td className="px-3 py-1.5 font-medium">{r.project_code || <span className="text-slate-300">—</span>}</td>
                  <td className="px-3 py-1.5 font-medium">{r.activity_code || <span className="text-slate-300">—</span>}</td>
                  <td className="px-3 py-1.5 text-slate-600 dark:text-slate-300">{r.task || <span className="text-slate-300">—</span>}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{r.hours || <span className="text-slate-300">—</span>}</td>
                  <td className="px-3 py-1.5 text-slate-500">{r.start_time || r.end_time ? `${r.start_time ?? ''} – ${r.end_time ?? ''}` : <span className="text-slate-300">—</span>}</td>
                  <td className="px-3 py-1.5 uppercase text-[10px] font-medium text-slate-600 dark:text-slate-300">{r.work_mode || 'WFO'}</td>
                  <td className="px-3 py-1.5 text-[11px]">
                    {r.__error ? (
                      <span className="text-red-700 dark:text-red-400">✗ {r.__error}</span>
                    ) : (
                      <span className="text-emerald-700 dark:text-emerald-400">✓ Ready</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

// -----------------------------------------------------------------------------
function mondayOf(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return ''
  const d = new Date(iso + 'T00:00:00Z')
  const dow = d.getUTCDay()
  const offset = dow === 0 ? 6 : dow - 1
  return new Date(d.getTime() - offset * 86_400_000).toISOString().slice(0, 10)
}

function addDays(iso: string, days: number): string {
  return new Date(new Date(iso + 'T00:00:00Z').getTime() + days * 86_400_000).toISOString().slice(0, 10)
}

function formatDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00Z')
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

function hoursBetween(start: string, end: string): number {
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return 0
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const minutes = (eh * 60 + em) - (sh * 60 + sm)
  return minutes > 0 ? minutes / 60 : 0
}
