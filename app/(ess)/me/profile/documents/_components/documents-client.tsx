'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useSnackbar } from '@/components/ui/snackbar'
import { useBlockingTransition } from '@/lib/ui/action-blocker'
import {
  uploadMyDocumentAction,
  deleteMyDocumentAction,
} from '@/lib/employees/self-service'
import {
  DOC_TYPES,
  DOC_TYPE_LABEL,
  type DocType,
  type EmployeeDocumentRow,
} from '@/lib/employees/self-service-constants'

type Doc = EmployeeDocumentRow & { signed_url: string | null }

export function DocumentsClient({
  docs, editable,
}: { docs: Doc[]; editable: boolean }) {
  const router = useRouter()
  const snack = useSnackbar()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [pending, startTransition] = useBlockingTransition()

  const [docType, setDocType] = React.useState<DocType>('aadhaar')
  const [title, setTitle] = React.useState('')

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const file = inputRef.current?.files?.[0]
    if (!file) {
      snack.show({ kind: 'error', message: 'Pick a PDF first.' })
      return
    }
    const fd = new FormData()
    fd.set('doc_type', docType)
    fd.set('title', title)
    fd.set('file', file)
    startTransition(async () => {
      const res = await uploadMyDocumentAction(fd)
      if ('error' in res) snack.show({ kind: 'error', message: res.error })
      else {
        snack.show({ kind: 'success', message: 'Document uploaded.' })
        setTitle('')
        if (inputRef.current) inputRef.current.value = ''
        router.refresh()
      }
    })
  }

  const remove = (id: string) => {
    if (!confirm('Remove this document?')) return
    const fd = new FormData()
    fd.set('id', id)
    startTransition(async () => {
      const res = await deleteMyDocumentAction(fd)
      if ('error' in res) snack.show({ kind: 'error', message: res.error })
      else {
        snack.show({ kind: 'info', message: 'Document removed.' })
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-4">
      {editable && (
        <form
          onSubmit={submit}
          className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
        >
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Upload a document</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">PDF only · up to 5 MB.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-[180px_1fr_auto]">
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as DocType)}
              className={inp}
              aria-label="Document type"
            >
              {DOC_TYPES.map((t) => (
                <option key={t} value={t}>{DOC_TYPE_LABEL[t]}</option>
              ))}
            </select>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title (optional, e.g. ‘Anna University’)"
              className={inp}
            />
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              required
              className="block max-w-xs cursor-pointer rounded-md border border-slate-300 bg-white text-xs file:mr-3 file:rounded-l-md file:border-0 file:bg-brand-600 file:px-3 file:py-2 file:text-xs file:font-medium file:text-white hover:file:bg-brand-700 dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-9 items-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:opacity-60"
            >
              {pending ? 'Uploading…' : 'Upload PDF'}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-50">
          Uploaded documents
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">File</th>
                <th className="px-4 py-3">Uploaded</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">{' '}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {docs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-slate-500">
                    No documents uploaded yet.
                  </td>
                </tr>
              )}
              {docs.map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-3 font-medium">
                    {DOC_TYPE_LABEL[d.doc_type] ?? d.doc_type}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{d.title ?? '—'}</td>
                  <td className="px-4 py-3">
                    {d.signed_url ? (
                      <a
                        href={d.signed_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-700 hover:underline dark:text-brand-400"
                      >
                        {d.file_name}
                      </a>
                    ) : (
                      <span className="text-slate-500">{d.file_name}</span>
                    )}
                    {d.size_bytes && (
                      <span className="ml-2 text-[11px] text-slate-500">
                        ({(d.size_bytes / 1024).toFixed(0)} KB)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {new Date(d.uploaded_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                  </td>
                  <td className="px-4 py-3">
                    {d.verified_at ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                        ✓ Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                        Pending HR review
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {editable && !d.verified_at && (
                      <button
                        type="button"
                        onClick={() => remove(d.id)}
                        disabled={pending}
                        className="text-[11px] font-medium text-slate-600 hover:text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const inp =
  'h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950'
