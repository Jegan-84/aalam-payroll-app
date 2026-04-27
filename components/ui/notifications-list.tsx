'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useBlockingTransition } from '@/lib/ui/action-blocker'
import { markNotificationReadAction, markAllNotificationsReadAction, dismissNotificationAction } from '@/lib/notifications/actions'
import type { NotificationRow } from '@/lib/notifications/queries'

const SEVERITY_DOT: Record<NotificationRow['severity'], string> = {
  info:    'bg-sky-500',
  success: 'bg-emerald-500',
  warn:    'bg-amber-500',
  error:   'bg-red-500',
}

export function NotificationsList({ rows }: { rows: NotificationRow[] }) {
  const router = useRouter()
  const [, startTransition] = useBlockingTransition()

  const markRead = (id: string) => {
    const fd = new FormData()
    fd.set('id', id)
    startTransition(async () => {
      await markNotificationReadAction(fd)
      router.refresh()
    })
  }
  const dismiss = (id: string) => {
    const fd = new FormData()
    fd.set('id', id)
    startTransition(async () => {
      await dismissNotificationAction(fd)
      router.refresh()
    })
  }
  const markAll = () => {
    startTransition(async () => {
      await markAllNotificationsReadAction()
      router.refresh()
    })
  }

  const hasUnread = rows.some((r) => r.read_at == null)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{rows.length} {rows.length === 1 ? 'notification' : 'notifications'}</p>
        {hasUnread && (
          <button
            type="button"
            onClick={markAll}
            className="text-xs font-medium text-brand-700 hover:underline"
          >
            Mark all as read
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          No notifications.
        </div>
      ) : (
        <ul className="overflow-hidden rounded-lg border border-slate-200 bg-white divide-y divide-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:divide-slate-800">
          {rows.map((n) => {
            const unread = n.read_at == null
            return (
              <li key={n.id} className={unread ? 'bg-brand-50/30 dark:bg-brand-950/10' : ''}>
                <div className="flex items-start gap-3 px-4 py-3">
                  <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${unread ? SEVERITY_DOT[n.severity] : 'bg-slate-300 dark:bg-slate-700'}`} />
                  <div className="flex-1">
                    {n.href ? (
                      <Link
                        href={n.href}
                        onClick={() => { if (unread) markRead(n.id) }}
                        className={`block text-sm hover:underline ${unread ? 'font-medium text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-300'}`}
                      >
                        {n.title}
                      </Link>
                    ) : (
                      <span className={`text-sm ${unread ? 'font-medium text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-300'}`}>
                        {n.title}
                      </span>
                    )}
                    {n.body && <div className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">{n.body}</div>}
                    <div className="mt-1 text-[11px] text-slate-400">
                      {new Date(n.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                      {unread && <span className="ml-2 text-brand-700 dark:text-brand-400">· unread</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {unread && (
                      <button
                        type="button"
                        onClick={() => markRead(n.id)}
                        className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                      >
                        Mark read
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => dismiss(n.id)}
                      className="text-xs text-slate-400 hover:text-red-700 dark:hover:text-red-400"
                      aria-label="Dismiss"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
