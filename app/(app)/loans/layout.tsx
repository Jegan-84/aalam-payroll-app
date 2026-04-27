import { requireRouteRoles } from '@/lib/auth/dal'

export default async function LoansLayout({ children }: { children: React.ReactNode }) {
  await requireRouteRoles('admin', 'payroll')
  return <>{children}</>
}
