import { requireRouteRoles } from '@/lib/auth/dal'

export default async function EmployeesLayout({ children }: { children: React.ReactNode }) {
  await requireRouteRoles('admin', 'hr')
  return <>{children}</>
}
