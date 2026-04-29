import { getUserWithRoles, getCurrentEmployee } from '@/lib/auth/dal'
import { EssSidebar } from './_components/ess-sidebar'
import { SnackbarProvider } from '@/components/ui/snackbar'
import { ActionBlocker } from '@/components/ui/action-blocker'
import { NotificationBellServer } from '@/components/ui/notification-bell-server'
import { getApprovalScope } from '@/lib/timesheet/approval-queries'

export default async function EssLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Anyone with an employee record can use /me/* — including admin/HR/payroll
  // users who are also employees of the org. getCurrentEmployee() bounces to
  // /dashboard for users with no employee row (admin-only seats).
  const me = await getUserWithRoles()
  await getCurrentEmployee()
  // For the "Team timesheets" sidebar entry — show only when there's
  // something to approve (manager with reports, or admin/HR).
  const approvalScope = await getApprovalScope()
  const showApprovals = approvalScope.isAdminish || approvalScope.isManager

  return (
    <SnackbarProvider>
      <div className="flex h-screen overflow-hidden bg-[var(--background)]">
        <EssSidebar email={me.email} fullName={me.fullName} showApprovals={showApprovals} />
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
