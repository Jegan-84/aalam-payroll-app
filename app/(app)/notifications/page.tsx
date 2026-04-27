import { listMyNotifications } from '@/lib/notifications/queries'
import { PageHeader } from '@/components/ui/page-header'
import { NotificationsList } from '@/components/ui/notifications-list'

export const metadata = { title: 'Notifications' }

export default async function NotificationsPage() {
  const rows = await listMyNotifications({ limit: 100 })
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Notifications"
        subtitle="Events relevant to you: leave applications, declarations, payroll runs, and more."
      />
      <NotificationsList rows={rows} />
    </div>
  )
}
