'use client'

import { useRouter } from 'next/navigation'
import { useBlockingTransition } from '@/lib/ui/action-blocker'
import { useSnackbar } from '@/components/ui/snackbar'
import { syncBiometricDevicesAction } from '@/lib/attendance/device-actions'

export function SyncDevicesButton({ hasDevices }: { hasDevices: boolean }) {
  const router = useRouter()
  const snack = useSnackbar()
  const [pending, startTransition] = useBlockingTransition()

  const sync = () => {
    startTransition(async () => {
      const res = await syncBiometricDevicesAction()
      if (res.error) {
        snack.show({ kind: 'error', message: res.error })
        return
      }
      const r = res.result!
      const errs = r.perDevice.filter((d) => d.error)
      if (errs.length > 0) {
        snack.show({
          kind: 'warn',
          message: `Synced with errors. Inserted ${r.inserted} · ${errs.length} device(s) failed: ${errs.map((d) => d.id).join(', ')}.`,
          duration: 8000,
        })
      } else {
        snack.show({
          kind: 'success',
          message: `Synced ${r.totalFetched} punch(es) — ${r.inserted} new, ${r.matched} matched, ${r.unknown} unknown.`,
        })
      }
      router.refresh()
    })
  }

  return (
    <button
      type="button"
      onClick={sync}
      disabled={pending || !hasDevices}
      className="inline-flex h-9 items-center whitespace-nowrap rounded-md bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 disabled:opacity-60"
    >
      {pending ? 'Syncing…' : 'Sync now'}
    </button>
  )
}
