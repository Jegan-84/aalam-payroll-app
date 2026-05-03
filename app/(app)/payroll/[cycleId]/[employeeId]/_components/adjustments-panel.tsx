'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useBlockingTransition } from '@/lib/ui/action-blocker'
import { saveAdjustmentAction, deleteAdjustmentAction } from '@/lib/components/actions'

const fmt = (n: number) => '₹ ' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(n))

// Statutory components — derived from the salary structure or fixed by rule
// (PF capped at ₹1,800/mo). HR can't override / skip these from the cycle.
// ESI and Gratuity remain editable because they vary with applicability.
//
// Loan lines (LOAN_<id>) are also locked: amount is min(emi, outstanding)
// and writes a ledger row on approve. Manual override would desync the loan
// ledger. Same for loan perquisites (PERQ_<id>) — derived from outstanding.
const STATUTORY_LOCKED_CODES = new Set(['BASIC', 'HRA', 'CONV', 'OTHERALLOW', 'MEDINS', 'PF_EE'])
const isStatutoryLocked = (code: string) => {
  const c = code.toUpperCase()
  return STATUTORY_LOCKED_CODES.has(c) || c.startsWith('LOAN_') || c.startsWith('PERQ_')
}

type ItemComponent = {
  code: string
  name: string
  kind: 'earning' | 'deduction' | 'employer_retiral' | 'reimbursement' | 'variable' | 'perquisite'
  amount: number
}

type Recurring = { code: string; name: string; kind: 'earning' | 'deduction'; monthly_amount: number; prorate: boolean }

type Adjustment = {
  id: string
  code: string
  name: string
  kind: 'earning' | 'deduction'
  amount: number
  action: 'add' | 'override' | 'skip'
  notes: string | null
}

type Props = {
  cycleId: string
  employeeId: string
  cycleStatus: 'draft' | 'computed' | 'approved' | 'locked' | 'paid'
  itemComponents: ItemComponent[]
  recurring: Recurring[]
  adjustments: Adjustment[]
}

export function AdjustmentsPanel({
  cycleId, employeeId, cycleStatus, itemComponents, recurring, adjustments,
}: Props) {
  const router = useRouter()
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [pending, startTransition] = useBlockingTransition()

  const readonly = ['approved', 'locked', 'paid'].includes(cycleStatus)

  const skipCodes = useMemo(
    () => new Set(adjustments.filter((a) => a.action === 'skip').map((a) => a.code)),
    [adjustments],
  )
  const overrideByCode = useMemo(() => {
    const m = new Map<string, Adjustment>()
    for (const a of adjustments) if (a.action === 'override') m.set(a.code, a)
    return m
  }, [adjustments])

  type Row = { code: string; name: string; kind: ItemComponent['kind']; amount: number; isRecurring: boolean }
  const rows: Row[] = []
  const seen = new Set<string>()
  for (const c of itemComponents) {
    rows.push({
      code: c.code, name: c.name, kind: c.kind, amount: c.amount,
      isRecurring: recurring.some((r) => r.code === c.code),
    })
    seen.add(c.code)
  }
  // Currently skipped recurring components don't appear in itemComponents — render them so user can unskip.
  for (const r of recurring) {
    if (!seen.has(r.code)) {
      rows.push({ code: r.code, name: r.name, kind: r.kind, amount: 0, isRecurring: true })
    }
  }

  const run = (
    fd: FormData,
    action: (fd: FormData) => Promise<{ ok?: true; error?: string }>,
  ) =>
    startTransition(async () => {
      setMsg(null)
      const res = await action(fd)
      if (res.error) setMsg({ kind: 'err', text: res.error })
      else {
        setMsg({ kind: 'ok', text: 'Saved. Click Recompute on the cycle to refresh the payslip.' })
        router.refresh()
      }
    })

  const saveOverride = (code: string, name: string, kind: 'earning' | 'deduction', amount: number) => {
    const fd = new FormData()
    fd.set('cycle_id', cycleId)
    fd.set('employee_id', employeeId)
    fd.set('code', code)
    fd.set('name', name)
    fd.set('kind', kind)
    fd.set('amount', String(amount))
    fd.set('action', 'override')
    run(fd, saveAdjustmentAction)
  }

  const saveSkip = (code: string, name: string, kind: 'earning' | 'deduction') => {
    const fd = new FormData()
    fd.set('cycle_id', cycleId)
    fd.set('employee_id', employeeId)
    fd.set('code', code)
    fd.set('name', name)
    fd.set('kind', kind)
    fd.set('amount', '0')
    fd.set('action', 'skip')
    run(fd, saveAdjustmentAction)
  }

  const clearAdjustment = (id: string) => {
    const fd = new FormData()
    fd.set('id', id)
    fd.set('cycle_id', cycleId)
    fd.set('employee_id', employeeId)
    run(fd, deleteAdjustmentAction)
  }

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Adjustments</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {readonly ? 'Cycle is locked.' : 'Edit, skip or add any earning/deduction. After changes, Recompute the cycle to apply.'}
          </p>
        </div>
        {msg && (
          <span className={`text-xs ${msg.kind === 'ok' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
            {msg.text}
          </span>
        )}
      </div>

      <div>
        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Payslip lines</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="py-1 text-left font-normal">Code</th>
                <th className="py-1 text-left font-normal">Name</th>
                <th className="py-1 text-left font-normal">Kind</th>
                <th className="py-1 text-right font-normal">Current</th>
                <th className="py-1 text-right font-normal">Adjust</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <EditableRow
                  key={r.code}
                  row={r}
                  skipped={skipCodes.has(r.code)}
                  override={overrideByCode.get(r.code) ?? null}
                  readonly={readonly}
                  pending={pending}
                  onSave={(amt) => {
                    if (r.kind === 'earning' || r.kind === 'deduction') saveOverride(r.code, r.name, r.kind, amt)
                  }}
                  onSkip={() => {
                    if (r.kind === 'earning' || r.kind === 'deduction') saveSkip(r.code, r.name, r.kind)
                  }}
                  onClear={(id) => clearAdjustment(id)}
                />
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
          Retirals &amp; reimbursements are shown for context; they&apos;re recomputed from Basic/Gross and can&apos;t be overridden here.
        </p>
      </div>

    </div>
  )
}

function EditableRow({
  row, skipped, override, readonly, pending, onSave, onSkip, onClear,
}: {
  row: { code: string; name: string; kind: ItemComponent['kind']; amount: number; isRecurring: boolean }
  skipped: boolean
  override: Adjustment | null
  readonly: boolean
  pending: boolean
  onSave: (amount: number) => void
  onSkip: () => void
  onClear: (id: string) => void
}) {
  const editable =
    (row.kind === 'earning' || row.kind === 'deduction') &&
    !isStatutoryLocked(row.code)
  const locked = isStatutoryLocked(row.code)
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState<string>(String(override?.amount ?? row.amount))

  const startEdit = () => {
    setVal(String(override?.amount ?? row.amount))
    setEditing(true)
  }
  const submit = () => {
    const num = Number(val)
    if (!Number.isFinite(num) || num < 0) return
    onSave(Math.round(num))
    setEditing(false)
  }

  return (
    <tr className={skipped ? 'opacity-60' : ''}>
      <td className="py-1 font-mono text-xs">{row.code}</td>
      <td className="py-1">{row.name}</td>
      <td className="py-1 text-xs">
        {row.kind}{row.isRecurring ? ' · recurring' : ''}
      </td>
      <td className="py-1 text-right">
        {editing ? (
          <div className="flex items-center justify-end gap-1">
            <input
              type="number"
              min="0"
              step="1"
              value={val}
              onChange={(e) => setVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setEditing(false) }}
              autoFocus
              className="h-7 w-28 rounded-md border border-slate-300 bg-white px-2 text-right text-xs tabular-nums dark:border-slate-700 dark:bg-slate-950"
            />
            <button onClick={submit} disabled={pending} className="text-xs underline">Save</button>
            <button onClick={() => setEditing(false)} disabled={pending} className="text-xs text-slate-500 underline">Cancel</button>
          </div>
        ) : skipped ? (
          <span className="text-xs italic text-slate-500">skipped</span>
        ) : (
          <div className="flex items-center justify-end gap-1">
            <span className="tabular-nums">{fmt(override?.amount ?? row.amount)}</span>
            {override && <span className="text-[10px] text-amber-600 dark:text-amber-400" title="Overridden this cycle">●</span>}
          </div>
        )}
      </td>
      <td className="py-1 text-right">
        {locked ? (
          <span
            title="Derived from the salary structure / statutory rule. Edit at /salary or /settings/statutory if the base needs to change."
            className="text-[11px] text-slate-400"
          >
            🔒 statutory
          </span>
        ) : !editable ? (
          <span className="text-[11px] text-slate-400">—</span>
        ) : readonly ? (
          <span className="text-[11px] text-slate-400">locked</span>
        ) : editing ? null : skipped ? (
          <button
            onClick={() => {
              const adj = override ?? null
              if (adj) onClear(adj.id)
            }}
            disabled={pending}
            className="text-xs underline"
          >
            Unskip
          </button>
        ) : (
          <div className="space-x-2">
            <button onClick={startEdit} disabled={pending} className="text-xs underline">Edit</button>
            <button onClick={onSkip} disabled={pending} className="text-xs underline">Skip</button>
            {override && (
              <button onClick={() => onClear(override.id)} disabled={pending} className="text-xs underline text-red-700 dark:text-red-400">
                Clear
              </button>
            )}
          </div>
        )}
      </td>
    </tr>
  )
}

