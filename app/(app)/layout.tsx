import { verifySession, requireAppAccess, findCurrentEmployee } from '@/lib/auth/dal'
import { Sidebar } from './_components/sidebar'
import { TopBar } from './_components/top-bar'
import { SnackbarProvider } from '@/components/ui/snackbar'
import { ActionBlocker } from '@/components/ui/action-blocker'

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await verifySession()
  // Gate the entire admin app by role. Employee-only users bounce to /me.
  const me = await requireAppAccess()
  // If the admin/HR/payroll user is ALSO an employee in the org, surface the
  // /me/* (ESS) shortcuts in the sidebar so they can file their own
  // timesheet / leave / monthly plan without role-switching accounts.
  const ownEmployee = await findCurrentEmployee()

  return (
    <SnackbarProvider>
      <div className="flex h-screen overflow-hidden bg-[var(--background)]">
        <Sidebar
          email={me.email}
          fullName={me.fullName}
          roles={me.roles}
          hasEmployeeRecord={!!ownEmployee}
        />
        <main className="flex-1 overflow-y-auto">
          <TopBar />
          <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10">{children}</div>
        </main>
      </div>
      <ActionBlocker />
    </SnackbarProvider>
  )
}
