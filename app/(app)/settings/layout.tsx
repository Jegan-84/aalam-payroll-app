import { requireRouteRoles } from '@/lib/auth/dal'

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireRouteRoles('admin')
  return <>{children}</>
}
