'use client'

import { useRouter } from 'next/navigation'
import { useBlockingTransition } from '@/lib/ui/action-blocker'
import { useSnackbar } from '@/components/ui/snackbar'
import { useConfirm } from '@/components/ui/confirm'
import {
  setVerificationAction,
  clearPriorEarningsAction,
} from '@/lib/tax/prior-earnings'

type Props = {
  employeeId: string
  fyStart: string
  fyLabel: string
  prior: {
    gross_salary: number
    pf_deducted: number
    professional_tax_deducted: number
    tds_deducted: number
    prev_employer_name: string | null
    prev_employer_pan: string | null
    prev_employer_tan: string | null
    prev_regime: 'OLD' | 'NEW' | null
    declared_at: string
    verified_at: string | null
    notes: string | null
  } | null
}

export function PriorEarningsHrPanel({ employeeId, fyStart, fyLabel, prior }: Props) {
  const router = useRouter()
  const snack = useSnackbar()
  const confirm = useConfirm()
  const [pending, startTransition] = useBlockingTransition()

  if (!prior) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
        Employee hasn&apos;t submitted Form 12B for FY {fyLabel}. They can add it from <span className="font-medium">/me/declaration</span>, or you can fill it in for them on this page.
      </div>
    )
  }

  const toggleVerify = () => {
    const fd = new FormData()
    fd.set('employee_id', employeeId)
    fd.set('fy_start', fyStart)
    fd.set('verified', prior.verified_at ? 'false' : 'true')
    startTransition(async () => {
      const res = await setVerificationAction(fd)
      if (res.error) snack.show({ kind: 'error', message: res.error })
      else {
        snack.show({
          kind: 'success',
          message: prior.verified_at ? '12B unverified — employee can edit again.' : '12B verified.',
        })
        router.refresh()
      }
    })
  }

  const clear = async () => {
    if (!await confirm({
      title: `Delete the 12B record for FY ${fyLabel}?`,
      body: 'Use this if it was filed by mistake — the employee can re-submit.',
      confirmLabel: 'Delete',
      tone: 'danger',
    })) return
    const fd = new FormData()
    fd.set('employee_id', employeeId)
    fd.set('fy_start', fyStart)
    startTransition(async () => {
      const res = await clearPriorEarningsAction(fd)
      if (res.error) snack.show({ kind: 'error', message: res.error })
      else {
        snack.show({ kind: 'info', message: '12B record cleared.' })
        router.refresh()
      }
    })
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            Form 12B — previous employer · FY {fyLabel}
          </h3>
          <p className="text-[11px] text-slate-500">
            Declared {new Date(prior.declared_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}.
            {prior.verified_at
              ? ` Verified ${new Date(prior.verified_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}.`
              : ' Not yet verified — TDS engine will use these figures regardless, but verifying locks employee edits.'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={toggleVerify}
            disabled={pending}
            className={`inline-flex h-8 items-center rounded-md px-3 text-xs font-medium transition-colors disabled:opacity-60 ${
              prior.verified_at
                ? 'border border-amber-300 text-amber-800 hover:bg-amber-50 dark:border-amber-900 dark:text-amber-300 dark:hover:bg-amber-950/40'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
          >
            {prior.verified_at ? 'Unverify (allow edits)' : '✓ Verify'}
          </button>
          <button
            type="button"
            onClick={clear}
            disabled={pending}
            className="inline-flex h-8 items-center rounded-md border border-red-300 px-3 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
          >
            Clear
          </button>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 px-4 py-3 text-sm sm:grid-cols-3 lg:grid-cols-4">
        <Row label="Gross salary"            value={`₹${formatInr(prior.gross_salary)}`} />
        <Row label="TDS deducted"            value={`₹${formatInr(prior.tds_deducted)}`} />
        <Row label="PF deducted"             value={`₹${formatInr(prior.pf_deducted)}`} />
        <Row label="Professional tax"        value={`₹${formatInr(prior.professional_tax_deducted)}`} />
        <Row label="Employer"                value={prior.prev_employer_name ?? '—'} />
        <Row label="Employer PAN"            value={prior.prev_employer_pan ?? '—'} />
        <Row label="Employer TAN"            value={prior.prev_employer_tan ?? '—'} />
        <Row label="Prev. regime"            value={prior.prev_regime ?? '—'} />
      </dl>

      {prior.notes && (
        <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-400">
          <span className="font-medium">Notes:</span> {prior.notes}
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 font-medium text-slate-900 tabular-nums dark:text-slate-100">{value}</dd>
    </div>
  )
}

function formatInr(n: number): string {
  return Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
