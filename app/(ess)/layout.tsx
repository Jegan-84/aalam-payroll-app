import { requireRole, getCurrentEmployee } from '@/lib/auth/dal'
import { EssSidebar } from './_components/ess-sidebar'
import { SnackbarProvider } from '@/components/ui/snackbar'
import { ActionBlocker } from '@/components/ui/action-blocker'
import { NotificationBellServer } from '@/components/ui/notification-bell-server'

export default async function EssLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const me = await requireRole('employee')
  await getCurrentEmployee()

  return (
    <SnackbarProvider>
      <div className="flex h-screen overflow-hidden bg-[var(--background)]">
        <EssSidebar email={me.email} fullName={me.fullName} />
        <main className="flex-1 overflow-y-auto">
          <div className="sticky top-0 z-30 flex items-center justify-end gap-4 border-b border-slate-200 bg-white/80 px-6 py-3 backdrop-blur lg:px-10 dark:border-slate-800 dark:bg-slate-950/80">
            <NotificationBellServer listHref="/me/notifications" />
          </div>
          <div className="mx-auto max-w-5xl px-6 py-8 lg:px-10">{children}</div>
        </main>
      </div>
      <ActionBlocker />
    </SnackbarProvider>
  )
}
