import { requireRouteRoles } from '@/lib/auth/dal'

export default async function LeaveLayout({ children }: { children: React.ReactNode }) {
  await requireRouteRoles('admin', 'hr')
  return <>{children}</>
}
