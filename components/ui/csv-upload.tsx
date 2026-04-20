'use client'

import * as React from 'react'
import Papa from 'papaparse'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { useSnackbar } from '@/components/ui/snackbar'

export type Column<T> = {
  key: keyof T & string
  label: string
  width?: string
  editor?: 'text' | 'date' | 'select' | 'checkbox'
  options?: string[]                    // for select
  required?: boolean
}

type BulkResponse = {
  created: number
  skipped: Array<{ row: number; reason: string }>
}

type Props<T extends Record<string, unknown>> = {
  /** Label on the "Upload" button in the header. */
  label?: string
  /** Download URL for the blank CSV template. */
  templateHref: string
  /** Column definitions — order determines both CSV header mapping and preview columns. */
  columns: Column<T>[]
  /** Quick client-side validator; return an error message or null. */
  validate?: (row: T, idx: number, all: T[]) => string | null
  /** Server action to invoke with the final parsed rows. */
  onSave: (rows: T[]) => Promise<BulkResponse & { skipped: Array<{ row: number; reason: string } | { row: number; code?: string; employee_code?: string; reason: string }> }>
  /** Dialog title. */
  title: string
  /** Optional long-form help shown below title. */
  subtitle?: string
}

export function CsvUpload<T extends Record<string, unknown>>({
  label = 'Upload CSV',
  templateHref,
  columns,
  validate,
  onSave,
  title,
  subtitle,
}: Props<T>) {
  const router = useRouter()
  const snack = useSnackbar()
  const fileRef = React.useRef<HTMLInputElement>(null)

  const [open, setOpen] = React.useState(false)
  const [rows, setRows] = React.useState<T[]>([])
  const [parseError, setParseError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  const onPick = () => fileRef.current?.click()

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
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
        const parsed = (res.data ?? []).map((r) => {
          const out: Record<string, unknown> = {}
          for (const c of columns) {
            const raw = (r[c.key] ?? '').toString().trim()
            if (c.editor === 'checkbox') {
              const s = raw.toLowerCase()
              out[c.key] = s === 'true' || s === 'yes' || s === 'y' || s === '1'
            } else {
              out[c.key] = raw
            }
          }
          return out as T
        })
        setRows(parsed)
        setOpen(true)
      },
      error: (err) => {
        setParseError(err.message)
        snack.show({ message: `CSV parse failed: ${err.message}`, kind: 'error' })
      },
    })
    // reset so same-file re-upload triggers onChange
    e.target.value = ''
  }

  const rowErrors: (string | null)[] = React.useMemo(
    () => rows.map((r, i) => {
      for (const c of columns) {
        if (c.required && !String(r[c.key] ?? '').trim()) return `${c.label} is required`
      }
      return validate ? validate(r, i, rows) : null
    }),
    [rows, columns, validate],
  )

  const invalidCount = rowErrors.filter(Boolean).length
  const validCount = rows.length - invalidCount

  const updateCell = (idx: number, key: string, value: unknown) => {
    setRows((prev) => {
      const next = [...prev]
      next[idx] = { ...next[idx], [key]: value }
      return next
    })
  }

  const removeRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx))
  }

  const onSubmit = async () => {
    const toSave = rows.filter((_, i) => !rowErrors[i])
    if (toSave.length === 0) {
      snack.show({ message: 'Nothing valid to save. Fix the rows first.', kind: 'warn' })
      return
    }
    setSaving(true)
    try {
      const res = await onSave(toSave)
      if (res.created > 0) {
        snack.show({
          kind: res.skipped.length === 0 ? 'success' : 'warn',
          message: `Created ${res.created}${res.skipped.length ? ` · ${res.skipped.length} skipped` : ''}`,
        })
      } else if (res.skipped.length > 0) {
        snack.show({ kind: 'error', message: `All ${res.skipped.length} rows failed. ${res.skipped[0]?.reason ?? ''}` })
      }
      setOpen(false)
      setRows([])
      router.refresh()
    } catch (err) {
      snack.show({ kind: 'error', message: (err as Error).message || 'Bulk save failed.' })
    } finally {
      setSaving(false)
    }
  }

  const close = () => {
    if (saving) return
    setOpen(false)
    setRows([])
    setParseError(null)
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
      <div className="flex items-center gap-2">
        <a
          href={templateHref}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
        >
          <IconDownload /> Template
        </a>
        <Button variant="outline" size="md" onClick={onPick}>
          <IconUpload /> {label}
        </Button>
      </div>

      <Dialog
        open={open}
        onClose={close}
        size="full"
        title={title}
        subtitle={subtitle ?? `${rows.length} row(s) · ${validCount} valid · ${invalidCount} with errors`}
        footer={
          <>
            <div className="mr-auto text-xs text-slate-500">
              Review and edit inline. Only valid rows will be saved.
            </div>
            <Button variant="outline" onClick={close} disabled={saving}>Cancel</Button>
            <Button variant="primary" onClick={onSubmit} disabled={saving || validCount === 0}>
              {saving ? <><Spinner size="xs" /> Saving…</> : `Save ${validCount} row${validCount === 1 ? '' : 's'}`}
            </Button>
          </>
        }
      >
        {parseError && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            CSV parse warnings: {parseError}
          </div>
        )}
        {rows.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">No rows parsed.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/80 dark:text-slate-400">
                <tr>
                  <th className="w-10 px-2 py-2">#</th>
                  {columns.map((c) => (
                    <th key={c.key} className="px-2 py-2" style={{ minWidth: c.width ?? '140px' }}>
                      {c.label}{c.required && <span className="text-red-500"> *</span>}
                    </th>
                  ))}
                  <th className="w-[260px] px-2 py-2">Status</th>
                  <th className="w-10 px-2 py-2">{' '}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((r, i) => {
                  const err = rowErrors[i]
                  return (
                    <tr key={i} className={err ? 'bg-red-50/40 dark:bg-red-950/20' : ''}>
                      <td className="px-2 py-1.5 text-center text-xs text-slate-400 tabular-nums">{i + 1}</td>
                      {columns.map((c) => (
                        <td key={c.key} className="px-2 py-1.5">
                          {c.editor === 'checkbox' ? (
                            <input
                              type="checkbox"
                              checked={Boolean(r[c.key])}
                              onChange={(e) => updateCell(i, c.key, e.target.checked)}
                            />
                          ) : c.editor === 'select' && c.options ? (
                            <select
                              value={String(r[c.key] ?? '')}
                              onChange={(e) => updateCell(i, c.key, e.target.value)}
                              className={selectCls}
                            >
                              <option value="">—</option>
                              {c.options.map((o) => <option key={o} value={o}>{o}</option>)}
                            </select>
                          ) : c.editor === 'date' ? (
                            <input
                              type="date"
                              value={String(r[c.key] ?? '')}
                              onChange={(e) => updateCell(i, c.key, e.target.value)}
                              className={inputCls}
                            />
                          ) : (
                            <input
                              type="text"
                              value={String(r[c.key] ?? '')}
                              onChange={(e) => updateCell(i, c.key, e.target.value)}
                              className={inputCls}
                            />
                          )}
                        </td>
                      ))}
                      <td className="px-2 py-1.5 text-xs">
                        {err ? (
                          <span className="text-red-700 dark:text-red-400">✗ {err}</span>
                        ) : (
                          <span className="text-emerald-700 dark:text-emerald-400">✓ Ready</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <button
                          type="button"
                          onClick={() => removeRow(i)}
                          title="Remove row"
                          className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-red-600 dark:hover:bg-slate-800"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Dialog>
    </>
  )
}

const inputCls = 'h-8 w-full min-w-[120px] rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-950'
const selectCls = 'h-8 w-full min-w-[120px] rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950'

const iconProps = { width: 14, height: 14, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, viewBox: '0 0 24 24' }
function IconDownload() { return <svg {...iconProps}><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg> }
function IconUpload()   { return <svg {...iconProps}><path d="M12 21V9"/><path d="m7 14 5-5 5 5"/><path d="M5 3h14"/></svg> }
