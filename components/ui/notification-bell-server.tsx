import { listMyNotifications, countMyUnreadNotifications } from '@/lib/notifications/queries'
import { NotificationBell } from './notification-bell'

/** Server Component — fetches recent notifications and renders the client bell. */
export async function NotificationBellServer({ listHref }: { listHref: string }) {
  const [recent, unreadCount] = await Promise.all([
    listMyNotifications({ limit: 10 }),
    countMyUnreadNotifications(),
  ])
  return <NotificationBell recent={recent} unreadCount={unreadCount} listHref={listHref} />
}
