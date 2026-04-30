'use client'

import { useRouter } from 'next/navigation'
import { useBlockingTransition } from '@/lib/ui/action-blocker'
import { useSnackbar } from '@/components/ui/snackbar'
import { useConfirm } from '@/components/ui/confirm'
import { seedFyBalancesAction } from '@/lib/leave/actions'

export function SeedFyButton({ fyStart, fyLabel }: { fyStart: string; fyLabel: string }) {
  const router = useRouter()
  const snack = useSnackbar()
  const confirm = useConfirm()
  const [pending, startTransition] = useBlockingTransition()

  const onClick = async () => {
    if (!await confirm({
      title: `Seed opening balances — FY ${fyLabel}?`,
      body: 'Adds rows for every active employee × paid leave type. Existing rows are left untouched.',
      confirmLabel: 'Seed',
    })) return
    startTransition(async () => {
      const fd = new FormData()
      fd.set('fy_start', fyStart)
      const res = await seedFyBalancesAction(fd)
      if (res.error) snack.show({ kind: 'error', message: res.error })
      else {
        snack.show({
          kind: 'success',
          message: `Seeded ${res.inserted ?? 0} row(s). Existing balances were left untouched.`,
        })
        router.refresh()
      }
    })
  }

  return (
    <button
      onClick={onClick}
      disabled={pending}
      className="inline-flex h-9 items-center rounded-md border border-slate-300 px-3 text-sm font-medium hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
    >
      {pending ? 'Seeding…' : `Seed FY ${fyLabel}`}
    </button>
  )
}
