import { requireRouteRoles } from '@/lib/auth/dal'

export default async function PayrollLayout({ children }: { children: React.ReactNode }) {
  await requireRouteRoles('admin', 'payroll')
  return <>{children}</>
}
