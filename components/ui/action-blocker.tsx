'use client'

import { useActionPendingCount } from '@/lib/ui/action-blocker'
import { PageLoader } from './page-loader'

/**
 * Mounted once at the (app) layout level. Renders a full-screen PageLoader
 * whenever any tracked server action is pending, blocking all underlying
 * interaction by virtue of being `fixed inset-0 z-50`.
 */
export function ActionBlocker() {
  const count = useActionPendingCount()
  if (count <= 0) return null
  return <PageLoader message="Working…" />
}
