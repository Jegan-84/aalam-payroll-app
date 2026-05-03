'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useBlockingTransition } from '@/lib/ui/action-blocker'
import { useConfirm } from '@/components/ui/confirm'
import { uploadPoiAction, deletePoiAction } from '@/lib/poi/actions'
import type { PoiDocumentRow, PoiSection } from '@/lib/poi/queries'

const fmt = (n: number) => '₹ ' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(n))

const SECTIONS: { value: PoiSection; label: string }[] = [
  { value: '80C', label: '80C — PPF / LIC / ELSS / Tuition' },
  { value: '80D', label: '80D — Health insurance' },
  { value: '80CCD1B', label: '80CCD(1B) — NPS additional' },
  { value: '80E', label: '80E — Education loan interest' },
  { value: '80G', label: '80G — Donations' },
  { value: '80TTA', label: '80TTA — Savings interest' },
  { value: 'HRA', label: 'HRA — Rent receipts' },
  { value: '24B', label: '24(b) — Home loan interest' },
  { value: 'LTA', label: 'LTA' },
  { value: 'OTHER', label: 'Other' },
]

const STATUS_TONE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200',
}

export function PoiPanel({
  fyStart,
  fyLabel,
  readonly,
  docs,
}: {
  fyStart: string
  fyLabel: string
  readonly: boolean
  docs: PoiDocumentRow[]
}) {
  const router = useRouter()
  const confirm = useConfirm()
  const [pending, startTransition] = useBlockingTransition()
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const formRef = useRef<HTMLFormElement | null>(null)

  const onUpload = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setMsg(null)
    const fd = new FormData(e.currentTarget)
    fd.set('fy_start', fyStart)
    startTransition(async () => {
      const res = await uploadPoiAction(fd)
      if (res.error) setMsg({ kind: 'err', text: res.error })
      else {
        setMsg({ kind: 'ok', text: 'Uploaded — HR will review.' })
        formRef.current?.reset()
        router.refresh()
      }
    })
  }

  const onDelete = async (id: string) => {
    if (!await confirm({
      title: 'Delete this proof?',
      body: 'You can re-upload it later if needed.',
      confirmLabel: 'Delete',
      tone: 'danger',
    })) return
    setMsg(null)
    const fd = new FormData()
    fd.set('id', id)
    startTransition(async () => {
      const res = await deletePoiAction(fd)
      if (res.error) setMsg({ kind: 'err', text: res.error })
      else {
        setMsg({ kind: 'ok', text: 'Deleted.' })
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Supporting proofs</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Upload rent receipts, premium invoices, 80C certificates, home-loan statements, etc. HR reviews each document and
            approves / rejects it.
          </p>
        </div>
        {msg && (
          <span className={`text-xs ${msg.kind === 'ok' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
            {msg.text}
          </span>
        )}
      </div>

      {docs.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="py-1 text-left font-normal">Section</th>
                <th className="py-1 text-left font-normal">Description</th>
                <th className="py-1 text-right font-normal">Claimed</th>
                <th className="py-1 text-left font-normal">Status</th>
                <th className="py-1 text-left font-normal">File</th>
                <th className="py-1 text-right font-normal">{' '}</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="py-1 font-mono text-xs">{d.section}</td>
                  <td className="py-1">{d.sub_category ?? '—'}</td>
                  <td className="py-1 text-right tabular-nums">{fmt(d.claimed_amount)}</td>
                  <td className="py-1">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_TONE[d.status] ?? ''}`}>
                      {d.status}
                    </span>
                    {d.status === 'rejected' && d.review_notes && (
                      <div className="mt-0.5 text-[11px] text-red-700 dark:text-red-400">{d.review_notes}</div>
                    )}
                  </td>
                  <td className="py-1">
                    <a href={`/api/poi/${d.id}`} target="_blank" rel="noopener" className="text-xs font-medium text-brand-700 hover:underline">
                      {d.file_name}
                    </a>
                  </td>
                  <td className="py-1 text-right">
                    {!readonly && d.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => onDelete(d.id)}
                        disabled={pending}
                        className="text-xs text-red-700 underline disabled:opacity-50 dark:text-red-400"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!readonly && (
        <form ref={formRef} onSubmit={onUpload} encType="multipart/form-data" className="grid gap-2 sm:grid-cols-5">
          <select name="section" required defaultValue="80C" className={inputCls}>
            {SECTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <input name="sub_category" type="text" placeholder="Description (e.g. PPF Apr-Mar)" className={inputCls} />
          <input name="claimed_amount" type="number" min={0} step="0.01" placeholder="Claimed ₹" className={inputCls} required />
          <input
            name="file"
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            required
            className="h-9 w-full cursor-pointer rounded-md border border-slate-300 bg-white px-2 text-sm file:mr-2 file:rounded file:border-0 file:bg-slate-900 file:px-2 file:py-1 file:text-xs file:font-medium file:text-white dark:border-slate-700 dark:bg-slate-950 dark:file:bg-slate-100 dark:file:text-slate-900"
          />
          <button
            type="submit"
            disabled={pending}
            className="h-9 rounded-md bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {pending ? 'Uploading…' : 'Upload'}
          </button>
          <p className="sm:col-span-5 text-[11px] text-slate-500">
            PDF / JPG / PNG / WEBP up to 10 MB · FY {fyLabel}
          </p>
        </form>
      )}
    </div>
  )
}

const inputCls = 'h-9 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950'
