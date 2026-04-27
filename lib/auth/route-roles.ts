/**
 * Role-based access for admin-side routes.
 *
 * Single source of truth used by:
 *   - `requireRouteRoles(...)` — server-side gate at each section layout.tsx
 *   - Sidebar — filters nav items so users never see links they can't open.
 *   - Settings index — filters tiles by the user's roles.
 *
 * ROLES:
 *   admin   — everything, including settings + user management
 *   hr      — employee master, leave, attendance, declarations, F&F, reimbursements
 *   payroll — payroll cycles, salary structures, loans, TDS, statutory reports,
 *             reimbursements, F&F, attendance, declarations
 *
 * Everything under `/me/*` is governed by the `(ess)` layout and is NOT in this map.
 */

export type AdminRole = 'admin' | 'hr' | 'payroll'

export const ROUTE_ROLES: Record<string, AdminRole[]> = {
  '/dashboard':      ['admin', 'hr', 'payroll'],
  '/notifications':  ['admin', 'hr', 'payroll'],

  '/employees':      ['admin', 'hr'],
  '/attendance':     ['admin', 'hr', 'payroll'],
  '/leave':          ['admin', 'hr'],

  '/salary':         ['admin', 'payroll'],
  '/payroll':        ['admin', 'payroll'],
  '/loans':          ['admin', 'payroll'],
  '/reimbursements': ['admin', 'hr', 'payroll'],
  '/fnf':            ['admin', 'hr', 'payroll'],
  '/declarations':   ['admin', 'hr', 'payroll'],
  '/tds':            ['admin', 'payroll'],
  '/reports':        ['admin', 'payroll'],

  '/users':          ['admin'],
  '/settings':       ['admin'],
  '/comp-off':       ['admin', 'hr'],
  '/docs':           ['admin', 'hr', 'payroll'],
}

/** Return true if the given path is accessible to ANY of the roles. */
export function canAccess(path: string, userRoles: string[]): boolean {
  const prefix = matchPrefix(path)
  if (!prefix) return true // unlisted paths default to any admin role (covered by (app) gate)
  const allowed = ROUTE_ROLES[prefix]
  return allowed.some((r) => userRoles.includes(r))
}

function matchPrefix(path: string): string | null {
  // Find the longest ROUTE_ROLES key that is a prefix of `path`.
  let best: string | null = null
  for (const k of Object.keys(ROUTE_ROLES)) {
    if (path === k || path.startsWith(k + '/')) {
      if (best == null || k.length > best.length) best = k
    }
  }
  return best
}
