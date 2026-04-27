'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useBlockingTransition } from '@/lib/ui/action-blocker'
import { markNotificationReadAction, markAllNotificationsReadAction, dismissNotificationAction } from '@/lib/notifications/actions'

type Notification = {
  id: string
  kind: string
  title: string
  body: string | null
  href: string | null
  severity: 'info' | 'success' | 'warn' | 'error'
  read_at: string | null
  created_at: string
}

type Props = {
  recent: Notification[]
  unreadCount: number
  /** Base path for the "view all" link. Admin = '/notifications', ESS = '/me/notifications'. */
  listHref: string
}

const SEVERITY_DOT: Record<Notification['severity'], string> = {
  info:    'bg-sky-500',
  success: 'bg-emerald-500',
  warn:    'bg-amber-500',
  error:   'bg-red-500',
}

export function NotificationBell({ recent, unreadCount, listHref }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [, startTransition] = useBlockingTransition()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const markRead = (id: string) => {
    const fd = new FormData()
    fd.set('id', id)
    startTransition(async () => {
      await markNotificationReadAction(fd)
      router.refresh()
    })
  }

  const markAll = () => {
    startTransition(async () => {
      await markAllNotificationsReadAction()
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

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <IconBell />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-none text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-96 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 dark:border-slate-800">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                Notifications {unreadCount > 0 && <span className="text-xs text-slate-500">· {unreadCount} unread</span>}
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAll}
                  className="text-xs font-medium text-brand-700 hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>

            <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
              {recent.length === 0 && (
                <li className="p-6 text-center text-sm text-slate-500">No notifications.</li>
              )}
              {recent.map((n) => {
                const unread = n.read_at == null
                const body = (
                  <div className="flex gap-3">
                    <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${unread ? SEVERITY_DOT[n.severity] : 'bg-slate-300 dark:bg-slate-700'}`} />
                    <div className="flex-1">
                      <div className={`text-sm ${unread ? 'font-medium text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-300'}`}>
                        {n.title}
                      </div>
                      {n.body && <div className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">{n.body}</div>}
                      <div className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">
                        {formatRelative(n.created_at)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); dismiss(n.id) }}
                      className="shrink-0 text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                      aria-label="Dismiss"
                    >
                      ✕
                    </button>
                  </div>
                )
                return (
                  <li key={n.id} className={unread ? 'bg-brand-50/30 dark:bg-brand-950/10' : ''}>
                    {n.href ? (
                      <Link
                        href={n.href}
                        onClick={() => { setOpen(false); if (unread) markRead(n.id) }}
                        className="block px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-900"
                      >
                        {body}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { if (unread) markRead(n.id) }}
                        className="block w-full px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-900"
                      >
                        {body}
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>

            <div className="border-t border-slate-100 bg-slate-50 px-3 py-2 text-right dark:border-slate-800 dark:bg-slate-900/50">
              <Link
                href={listHref}
                onClick={() => setOpen(false)}
                className="text-xs font-medium text-brand-700 hover:underline"
              >
                View all →
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function IconBell() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </svg>
  )
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime()
  const diffSec = Math.floor((Date.now() - t) / 1000)
  if (diffSec < 60) return 'just now'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`
  return new Date(iso).toLocaleDateString('en-IN', { dateStyle: 'medium' })
}
