'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useSnackbar } from '@/components/ui/snackbar'
import { useBlockingTransition } from '@/lib/ui/action-blocker'
import {
  uploadEmployeeDocumentAction,
  deleteEmployeeDocumentAction,
  setDocumentVerifiedAction,
  uploadEmployeePhotoAction,
} from '@/lib/employees/self-service'
import {
  DOC_TYPES,
  DOC_TYPE_LABEL,
  type DocType,
  type EmployeeDocumentRow,
} from '@/lib/employees/self-service-constants'

type Doc = EmployeeDocumentRow & { signed_url: string | null; verified_by_name?: string | null }

export function HrDocumentsPanel({
  employeeId, photoUrl, docs,
}: {
  employeeId: string
  photoUrl: string | null
  docs: Doc[]
}) {
  const router = useRouter()
  const snack = useSnackbar()
  const [pending, startTransition] = useBlockingTransition()

  const fileRef = React.useRef<HTMLInputElement>(null)
  const photoRef = React.useRef<HTMLInputElement>(null)
  const [docType, setDocType] = React.useState<DocType>('aadhaar')
  const [title, setTitle] = React.useState('')

  const upload = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const file = fileRef.current?.files?.[0]
    if (!file) {
      snack.show({ kind: 'error', message: 'Pick a PDF.' })
      return
    }
    const fd = new FormData()
    fd.set('doc_type', docType)
    fd.set('title', title)
    fd.set('file', file)
    startTransition(async () => {
      const res = await uploadEmployeeDocumentAction(employeeId, fd)
      if ('error' in res) snack.show({ kind: 'error', message: res.error })
      else {
        snack.show({ kind: 'success', message: 'Document uploaded.' })
        setTitle('')
        if (fileRef.current) fileRef.current.value = ''
        router.refresh()
      }
    })
  }

  const remove = (id: string) => {
    if (!confirm('Delete this document permanently?')) return
    const fd = new FormData()
    fd.set('id', id)
    startTransition(async () => {
      const res = await deleteEmployeeDocumentAction(employeeId, fd)
      if ('error' in res) snack.show({ kind: 'error', message: res.error })
      else {
        snack.show({ kind: 'info', message: 'Document removed.' })
        router.refresh()
      }
    })
  }

  const setVerified = (id: string, verified: boolean) => {
    const fd = new FormData()
    fd.set('id', id)
    fd.set('verified', verified ? 'true' : 'false')
    startTransition(async () => {
      const res = await setDocumentVerifiedAction(employeeId, fd)
      if ('error' in res) snack.show({ kind: 'error', message: res.error })
      else {
        snack.show({ kind: 'success', message: verified ? 'Marked verified.' : 'Verification cleared.' })
        router.refresh()
      }
    })
  }

  const onPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.set('file', file)
    startTransition(async () => {
      const res = await uploadEmployeePhotoAction(employeeId, fd)
      if ('error' in res) snack.show({ kind: 'error', message: res.error })
      else {
        snack.show({ kind: 'success', message: 'Photo updated.' })
        router.refresh()
      }
      if (photoRef.current) photoRef.current.value = ''
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="relative h-16 w-16 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="Employee" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-400">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
              </svg>
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">Profile photo</div>
          <p className="text-xs text-slate-500 dark:text-slate-400">JPG, PNG, or WebP. Max 5 MB.</p>
          <input
            ref={photoRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={onPhoto}
            disabled={pending}
            className="mt-2 block max-w-xs cursor-pointer rounded-md border border-slate-300 bg-white text-xs file:mr-3 file:rounded-l-md file:border-0 file:bg-brand-600 file:px-3 file:py-2 file:text-xs file:font-medium file:text-white hover:file:bg-brand-700 dark:border-slate-700 dark:bg-slate-950"
          />
        </div>
      </div>

      <form
        onSubmit={upload}
        className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
      >
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Upload document on behalf of employee</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">PDF only · max 5 MB.</p>
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
            placeholder="Title (optional)"
            className={inp}
          />
          <input
            ref={fileRef}
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

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-50">
          Documents
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
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {docs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-slate-500">
                    No documents uploaded.
                  </td>
                </tr>
              )}
              {docs.map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-3 font-medium">{DOC_TYPE_LABEL[d.doc_type] ?? d.doc_type}</td>
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
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      {d.verified_at ? (
                        <button
                          type="button"
                          onClick={() => setVerified(d.id, false)}
                          disabled={pending}
                          className="text-[11px] font-medium text-slate-600 hover:text-amber-700 hover:underline"
                        >
                          Unverify
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setVerified(d.id, true)}
                          disabled={pending}
                          className="text-[11px] font-medium text-emerald-700 hover:underline dark:text-emerald-300"
                        >
                          Verify
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => remove(d.id)}
                        disabled={pending}
                        className="text-[11px] font-medium text-slate-600 hover:text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
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
