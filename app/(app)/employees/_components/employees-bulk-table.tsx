'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { useSnackbar } from '@/components/ui/snackbar'
import { useConfirm } from '@/components/ui/confirm'
import { useBlockingTransition } from '@/lib/ui/action-blocker'
import { bulkSetProfileEditEnabledAction } from '@/lib/employees/self-service'
import type { EmployeeListRow } from '@/lib/employees/queries'

const STATUS_TONE: Record<string, 'success' | 'warn' | 'danger' | 'neutral' | 'info'> = {
  active: 'success',
  on_notice: 'warn',
  resigned: 'warn',
  terminated: 'danger',
  exited: 'neutral',
  on_hold: 'info',
}

export function EmployeesBulkTable({ rows }: { rows: EmployeeListRow[] }) {
  const router = useRouter()
  const snack = useSnackbar()
  const confirm = useConfirm()
  const [pending, startTransition] = useBlockingTransition()
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set())

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allOnPageSelected = rows.length > 0 && rows.every((r) => selected.has(r.id))
  const someSelected = rows.some((r) => selected.has(r.id))
  const headerRef = React.useRef<HTMLInputElement>(null)
  React.useEffect(() => {
    if (headerRef.current) {
      headerRef.current.indeterminate = !allOnPageSelected && someSelected
    }
  }, [allOnPageSelected, someSelected])

  const togglePage = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allOnPageSelected) {
        rows.forEach((r) => next.delete(r.id))
      } else {
        rows.forEach((r) => next.add(r.id))
      }
      return next
    })
  }

  const clearSelection = () => setSelected(new Set())

  const apply = async (enabled: boolean) => {
    const ids = Array.from(selected)
    const ok = await confirm({
      title: enabled ? 'Enable self-edit?' : 'Disable self-edit?',
      body: enabled
        ? `${ids.length} ${ids.length === 1 ? 'employee' : 'employees'} will be able to edit their personal, address, statutory, and bank details from /me/profile. Tax regime, employment, and pay fields stay HR-only.`
        : `${ids.length} ${ids.length === 1 ? 'employee' : 'employees'} will lose the ability to edit their profile. Their data is unaffected.`,
      confirmLabel: enabled ? 'Enable for all' : 'Disable for all',
    })
    if (!ok) return

    const fd = new FormData()
    fd.set('ids', ids.join(','))
    fd.set('enabled', enabled ? 'true' : 'false')

    startTransition(async () => {
      const res = await bulkSetProfileEditEnabledAction(fd)
      if ('error' in res) {
        snack.show({ kind: 'error', message: res.error })
        return
      }
      snack.show({
        kind: 'success',
        message: `Self-edit ${enabled ? 'enabled' : 'disabled'} for ${res.updated} ${res.updated === 1 ? 'employee' : 'employees'}.`,
      })
      clearSelection()
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      {selected.size > 0 && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm shadow-sm dark:border-brand-900 dark:bg-brand-950/40">
          <div className="flex items-center gap-3">
            <span className="font-medium text-brand-900 dark:text-brand-100">
              {selected.size} selected
            </span>
            <button
              type="button"
              onClick={clearSelection}
              className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300"
            >
              Clear
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-brand-800 dark:text-brand-200">Bulk update:</span>
            <button
              type="button"
              disabled={pending}
              onClick={() => apply(true)}
              className="inline-flex h-8 items-center rounded-md bg-emerald-600 px-3 text-xs font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
            >
              Enable self-edit
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => apply(false)}
              className="inline-flex h-8 items-center rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Disable self-edit
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
          <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
            <tr>
              <th className="w-10 px-3 py-2.5">
                <input
                  ref={headerRef}
                  type="checkbox"
                  aria-label="Select all on this page"
                  checked={allOnPageSelected}
                  onChange={togglePage}
                  className="h-4 w-4 cursor-pointer rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
              </th>
              <Th nowrap>Code</Th>
              <Th nowrap>Name</Th>
              <Th nowrap>Email</Th>
              <Th nowrap>Department</Th>
              <Th nowrap>Designation</Th>
              <Th nowrap>Status</Th>
              <Th nowrap>Self-edit</Th>
              <Th nowrap>DoJ</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center">
                  <div className="text-sm text-slate-500">No employees yet.</div>
                  <Link href="/employees/new" className="mt-1 inline-block text-sm font-medium text-brand-700 hover:underline">
                    Add your first employee →
                  </Link>
                </td>
              </tr>
            )}
            {rows.map((e) => {
              const checked = selected.has(e.id)
              return (
                <tr
                  key={e.id}
                  className={`transition-colors ${checked ? 'bg-brand-50/60 dark:bg-brand-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-950'}`}
                >
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      aria-label={`Select ${e.employee_code}`}
                      checked={checked}
                      onChange={() => toggle(e.id)}
                      className="h-4 w-4 cursor-pointer rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                  </td>
                  <Td nowrap>
                    <Link href={`/employees/${e.id}`} className="font-medium text-slate-900 underline-offset-2 hover:text-brand-700 hover:underline dark:text-slate-100">
                      {e.employee_code}
                    </Link>
                  </Td>
                  <Td nowrap>{e.full_name_snapshot}</Td>
                  <Td className="max-w-[26ch] truncate text-slate-500" title={e.work_email}>
                    {e.work_email}
                  </Td>
                  <Td nowrap>{e.department?.name ?? '—'}</Td>
                  <Td nowrap>{e.designation?.name ?? '—'}</Td>
                  <Td nowrap>
                    <Badge tone={STATUS_TONE[e.employment_status] ?? 'neutral'}>
                      {e.employment_status.replace('_', ' ')}
                    </Badge>
                  </Td>
                  <Td nowrap>
                    {e.profile_edit_enabled ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                        ✓ On
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        Off
                      </span>
                    )}
                  </Td>
                  <Td nowrap className="tabular-nums">{e.date_of_joining}</Td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Th({ children, className = '', nowrap }: { children: React.ReactNode; className?: string; nowrap?: boolean }) {
  return <th className={`px-4 py-2.5 ${nowrap ? 'whitespace-nowrap' : ''} ${className}`}>{children}</th>
}
function Td({ children, className = '', title, nowrap }: { children: React.ReactNode; className?: string; title?: string; nowrap?: boolean }) {
  return (
    <td title={title} className={`px-4 py-2.5 text-slate-900 dark:text-slate-100 ${nowrap ? 'whitespace-nowrap' : ''} ${className}`}>
      {children}
    </td>
  )
}
