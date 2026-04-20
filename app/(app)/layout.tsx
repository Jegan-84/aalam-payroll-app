import { verifySession, getUserWithRoles } from '@/lib/auth/dal'
import { Sidebar } from './_components/sidebar'
import { TopBar } from './_components/top-bar'
import { SnackbarProvider } from '@/components/ui/snackbar'
import { ActionBlocker } from '@/components/ui/action-blocker'

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await verifySession()
  const me = await getUserWithRoles()

  return (
    <SnackbarProvider>
      <div className="flex h-screen overflow-hidden bg-[var(--background)]">
        <Sidebar email={me.email} fullName={me.fullName} />
        <main className="flex-1 overflow-y-auto">
          <TopBar />
          <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10">{children}</div>
        </main>
      </div>
      <ActionBlocker />
    </SnackbarProvider>
  )
}
