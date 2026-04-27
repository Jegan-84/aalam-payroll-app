import { GlobalSearch } from './global-search'
import { NotificationBellServer } from '@/components/ui/notification-bell-server'

export function TopBar() {
  return (
    <div className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-slate-200 bg-white/80 px-6 py-3 backdrop-blur lg:px-10 dark:border-slate-800 dark:bg-slate-950/80">
      <GlobalSearch />
      <NotificationBellServer listHref="/notifications" />
    </div>
  )
}
