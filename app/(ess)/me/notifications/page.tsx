import { listMyNotifications } from '@/lib/notifications/queries'
import { PageHeader } from '@/components/ui/page-header'
import { NotificationsList } from '@/components/ui/notifications-list'

export const metadata = { title: 'Notifications' }

export default async function MyNotificationsPage() {
  const rows = await listMyNotifications({ limit: 100 })
  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        subtitle="Events relevant to you — payslips, leave, declarations, and more."
      />
      <NotificationsList rows={rows} />
    </div>
  )
}
