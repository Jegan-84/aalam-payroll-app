'use client'

import { useConfirm } from '@/components/ui/confirm'
import { deleteTemplateAction } from '@/lib/salary-templates/actions'

export function MarkInactiveButton({ id }: { id: string }) {
  const confirm = useConfirm()

  return (
    <form action={deleteTemplateAction}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        onClick={async (e) => {
          e.preventDefault()
          const button = e.currentTarget
          const ok = await confirm({
            title: 'Mark this template inactive?',
            body: 'Existing salary structures are unaffected. New employees won’t see it in the picker.',
            confirmLabel: 'Mark inactive',
            tone: 'danger',
          })
          if (ok) button.form?.requestSubmit(button)
        }}
        className="inline-flex h-9 items-center rounded-md border border-red-300 bg-red-50 px-4 text-sm font-medium text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
      >
        Mark inactive
      </button>
    </form>
  )
}
