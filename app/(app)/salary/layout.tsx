import { requireRouteRoles } from '@/lib/auth/dal'

export default async function SalaryLayout({ children }: { children: React.ReactNode }) {
  await requireRouteRoles('admin', 'payroll')
  return <>{children}</>
}
