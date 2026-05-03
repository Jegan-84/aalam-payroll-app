'use client'

import { useRouter } from 'next/navigation'
import { useBlockingTransition } from '@/lib/ui/action-blocker'
import { useSnackbar } from '@/components/ui/snackbar'
import { copyLastWeekAction } from '@/lib/timesheet/actions'

export function CopyLastWeekButton({ weekStart }: { weekStart: string }) {
  const router = useRouter()
  const snack = useSnackbar()
  const [pending, startTransition] = useBlockingTransition()

  const copy = () => {
    const fd = new FormData()
    fd.set('week_start', weekStart)
    startTransition(async () => {
      const res = await copyLastWeekAction(fd)
      if (res.error) {
        snack.show({ kind: 'error', message: res.error })
        return
      }
      const n = res.copied ?? 0
      snack.show({
        kind: n > 0 ? 'success' : 'info',
        message: n > 0
          ? `Copied ${n} row${n === 1 ? '' : 's'} from last week.`
          : 'Nothing new to copy — last week\'s rows are already here.',
      })
      router.refresh()
    })
  }

  return (
    <button
      type="button"
      onClick={copy}
      disabled={pending}
      className="inline-flex h-9 items-center rounded-md border border-dashed border-slate-300 px-3 text-sm font-medium text-slate-600 hover:border-brand-400 hover:text-brand-700 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand-700 dark:hover:text-brand-400"
    >
      {pending ? 'Copying…' : '↩ Copy last week'}
    </button>
  )
}
