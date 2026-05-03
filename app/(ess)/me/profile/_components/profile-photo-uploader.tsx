'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useSnackbar } from '@/components/ui/snackbar'
import { useBlockingTransition } from '@/lib/ui/action-blocker'
import { uploadMyPhotoAction } from '@/lib/employees/self-service'

export function ProfilePhotoUploader({
  photoUrl, editable,
}: { photoUrl: string | null; editable: boolean }) {
  const router = useRouter()
  const snack = useSnackbar()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [pending, startTransition] = useBlockingTransition()

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.set('file', file)
    startTransition(async () => {
      const res = await uploadMyPhotoAction(fd)
      if ('error' in res) snack.show({ kind: 'error', message: res.error })
      else {
        snack.show({ kind: 'success', message: 'Photo updated.' })
        router.refresh()
      }
      if (inputRef.current) inputRef.current.value = ''
    })
  }

  return (
    <div className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="relative h-20 w-20 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="Profile" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-400">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
            </svg>
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">Profile photo</div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          JPG, PNG, or WebP. Max 5 MB. Visible to HR and on your profile.
        </p>
        {editable ? (
          <div className="mt-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onPick}
              disabled={pending}
              className="block w-full max-w-xs cursor-pointer rounded-md border border-slate-300 bg-white text-xs file:mr-3 file:rounded-l-md file:border-0 file:bg-brand-600 file:px-3 file:py-2 file:text-xs file:font-medium file:text-white hover:file:bg-brand-700 dark:border-slate-700 dark:bg-slate-950"
            />
            {pending && <span className="mt-2 block text-xs text-slate-500">Uploading…</span>}
          </div>
        ) : (
          <p className="mt-2 text-xs text-slate-500">Editing locked. Ask HR to enable updates.</p>
        )}
      </div>
    </div>
  )
}
