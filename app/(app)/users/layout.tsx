import { requireRouteRoles } from '@/lib/auth/dal'

export default async function UsersLayout({ children }: { children: React.ReactNode }) {
  await requireRouteRoles('admin')
  return <>{children}</>
}
