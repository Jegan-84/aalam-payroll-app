'use client'

import { useRouter } from 'next/navigation'
import { useBlockingTransition } from '@/lib/ui/action-blocker'
import { useSnackbar } from '@/components/ui/snackbar'
import { submitWeekAction } from '@/lib/timesheet/actions'

export function SubmitWeekButton({
  weekStart, totalHours, disabled,
}: { weekStart: string; totalHours: number; disabled?: boolean }) {
  const router = useRouter()
  const snack = useSnackbar()
  const [pending, startTransition] = useBlockingTransition()

  const submit = () => {
    if (!confirm(`Submit week starting ${weekStart} for approval? Total hours: ${totalHours.toFixed(2)}`)) return
    const fd = new FormData()
    fd.set('week_start', weekStart)
    startTransition(async () => {
      const res = await submitWeekAction(fd)
      if (res.error) snack.show({ kind: 'error', message: res.error })
      else {
        snack.show({ kind: 'success', message: 'Week submitted for approval.' })
        router.refresh()
      }
    })
  }

  return (
    <button
      type="button"
      onClick={submit}
      disabled={pending || disabled}
      className="inline-flex h-9 items-center whitespace-nowrap rounded-md bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 disabled:opacity-60"
    >
      {pending ? 'Submitting…' : 'Submit week'}
    </button>
  )
}
