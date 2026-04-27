import { requireRouteRoles } from '@/lib/auth/dal'

export default async function TdsLayout({ children }: { children: React.ReactNode }) {
  await requireRouteRoles('admin', 'payroll')
  return <>{children}</>
}
