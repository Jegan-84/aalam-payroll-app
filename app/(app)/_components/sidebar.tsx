'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import * as React from 'react'
import { signOutAction } from '@/lib/auth/actions'
import { canAccess } from '@/lib/auth/route-roles'

type NavItem = { href: string; label: string; icon: React.ReactNode; sub?: boolean }
type NavGroup = { heading: string; items: NavItem[] }

const GROUPS: NavGroup[] = [
  {
    heading: 'Main',
    items: [
      { href: '/dashboard',  label: 'Dashboard',  icon: <IconHome /> },
      { href: '/employees',  label: 'Employees',  icon: <IconUsers /> },
    ],
  },
  {
    heading: 'Payroll',
    items: [
      { href: '/salary',            label: 'Salary Structures', icon: <IconCoins /> },
      { href: '/salary/templates',  label: 'Salary Templates',  icon: <IconLayers />, sub: true },
      { href: '/attendance',        label: 'Attendance',        icon: <IconCalendar /> },
      { href: '/leave',             label: 'Leave',             icon: <IconSun /> },
      { href: '/leave/balances',    label: 'Leave Balances',    icon: <IconGauge />, sub: true },
      { href: '/comp-off',          label: 'Comp Off',           icon: <IconSun />, sub: true },
      { href: '/payroll',           label: 'Payroll Runs',      icon: <IconPlay /> },
      { href: '/loans',             label: 'Loans',             icon: <IconBank />, sub: true },
      { href: '/reimbursements',    label: 'Reimbursements',    icon: <IconReceipt />, sub: true },
      { href: '/fnf',               label: 'F&F Settlements',   icon: <IconExit />, sub: true },
    ],
  },
  {
    heading: 'Tax & Reports',
    items: [
      { href: '/declarations', label: 'Tax Declarations',  icon: <IconDoc /> },
      { href: '/tds',          label: 'TDS & Form 16',     icon: <IconReceipt /> },
      { href: '/reports',      label: 'Statutory Reports', icon: <IconFolder /> },
    ],
  },
  {
    heading: 'Admin',
    items: [
      { href: '/users',    label: 'Users',    icon: <IconShield /> },
      { href: '/settings', label: 'Settings', icon: <IconGear /> },
      { href: '/docs',     label: 'Help',     icon: <IconHelp /> },
    ],
  },
]

const STORAGE_KEY = 'payflow.sidebar_collapsed'
const SIDEBAR_EVENT = 'payflow:sidebar-toggle'

function subscribeSidebar(cb: () => void) {
  window.addEventListener(SIDEBAR_EVENT, cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener(SIDEBAR_EVENT, cb)
    window.removeEventListener('storage', cb)
  }
}
function getSidebarSnapshot() {
  return window.localStorage.getItem(STORAGE_KEY) === '1'
}
function getSidebarServerSnapshot() {
  return false
}

export function Sidebar({ email, fullName, roles }: { email: string; fullName: string | null; roles: string[] }) {
  const pathname = usePathname()

  // Filter nav items by the user's roles so HR never sees Payroll-only items and vice versa.
  const visibleGroups: NavGroup[] = GROUPS
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => canAccess(i.href, roles)),
    }))
    .filter((g) => g.items.length > 0)
  const isCollapsed = React.useSyncExternalStore(subscribeSidebar, getSidebarSnapshot, getSidebarServerSnapshot)

  const toggle = () => {
    const next = !isCollapsed
    window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
    window.dispatchEvent(new Event(SIDEBAR_EVENT))
  }

  const initials = getInitials(fullName || email)

  return (
    <aside
      className={[
        'flex h-screen shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-200 ease-out',
        'dark:border-slate-800 dark:bg-slate-900',
        isCollapsed ? 'w-[68px]' : 'w-64',
      ].join(' ')}
    >
      {/* Brand */}
      <div className={`flex items-center border-b border-slate-200 dark:border-slate-800 ${isCollapsed ? 'justify-center py-4' : 'gap-3 px-5 py-4'}`}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 ring-1 ring-inset ring-brand-100 dark:bg-brand-950/40 dark:ring-brand-900">
          <Image src="/aalamLogo.png" alt="Aalam" width={28} height={28} className="h-7 w-7 object-contain" priority />
        </div>
        {!isCollapsed && (
          <div className="leading-tight">
            <div className="text-[15px] font-semibold text-slate-900 dark:text-slate-50">PayFlow</div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-brand-700 dark:text-brand-300">Aalam</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className={`flex-1 overflow-y-auto ${isCollapsed ? 'px-2 py-3' : 'px-3 py-4'}`}>
        {visibleGroups.map((g) => (
          <div key={g.heading} className="mb-4 last:mb-0">
            {!isCollapsed && (
              <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {g.heading}
              </div>
            )}
            <ul className="space-y-0.5">
              {g.items.map((item) => {
                const active = isItemActive(pathname, item.href)
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={isCollapsed ? item.label : undefined}
                      className={[
                        'group flex items-center rounded-md transition-colors',
                        isCollapsed
                          ? 'h-10 w-full justify-center'
                          : item.sub
                            ? 'gap-2.5 px-2.5 py-1.5 pl-8 text-sm'
                            : 'gap-2.5 px-2.5 py-1.5 text-sm',
                        active
                          ? 'bg-brand-50 font-medium text-brand-800 dark:bg-brand-950/50 dark:text-brand-200'
                          : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100',
                      ].join(' ')}
                    >
                      <span
                        className={[
                          'flex h-4 w-4 items-center justify-center',
                          active ? 'text-brand-600 dark:text-brand-300' : 'text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300',
                        ].join(' ')}
                      >
                        {item.icon}
                      </span>
                      {!isCollapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User + actions */}
      <div className="border-t border-slate-200 dark:border-slate-800">
        <div className={`flex items-center ${isCollapsed ? 'justify-center px-2 py-3' : 'gap-3 p-3'}`}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
            {initials}
          </div>
          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-slate-900 dark:text-slate-100">{fullName || email}</div>
              <div className="truncate text-[10px] text-slate-500 dark:text-slate-400">{email}</div>
            </div>
          )}
        </div>

        <div className={`flex gap-2 p-3 pt-0 ${isCollapsed ? 'flex-col items-center' : ''}`}>
          <button
            type="button"
            onClick={toggle}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={[
              'flex items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900',
              'dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800',
              isCollapsed ? 'h-9 w-9' : 'h-9 flex-1 gap-1.5 px-3 text-xs font-medium',
            ].join(' ')}
          >
            {isCollapsed ? <IconChevronRight /> : (<><IconChevronLeft /><span>Collapse</span></>)}
          </button>
          <form action={signOutAction} className={isCollapsed ? '' : 'flex-1'}>
            <button
              type="submit"
              title="Sign out"
              aria-label="Sign out"
              className={[
                'flex items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700',
                'dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-red-900 dark:hover:bg-red-950/40 dark:hover:text-red-400',
                isCollapsed ? 'h-9 w-9' : 'h-9 w-full gap-1.5 px-3 text-xs font-medium',
              ].join(' ')}
            >
              <IconLogOut />
              {!isCollapsed && <span>Sign out</span>}
            </button>
          </form>
        </div>
      </div>
    </aside>
  )
}

function isItemActive(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname === href || pathname.startsWith(href + '/')
}

function getInitials(source: string) {
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/* --- Icons (inline SVG; no extra deps) --- */
const iconProps = {
  width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, viewBox: '0 0 24 24',
}
function IconHome()         { return <svg {...iconProps}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M10 21v-6h4v6" /></svg> }
function IconUsers()        { return <svg {...iconProps}><circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M16 3a4 4 0 0 1 0 8"/><path d="M22 21a7 7 0 0 0-5-6.7"/></svg> }
function IconCoins()        { return <svg {...iconProps}><circle cx="8" cy="8" r="5"/><path d="M16 8a5 5 0 1 1-4 4.9"/><path d="M8 6v4l2 1"/></svg> }
function IconLayers()       { return <svg {...iconProps}><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/></svg> }
function IconCalendar()     { return <svg {...iconProps}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M8 3v4"/><path d="M16 3v4"/></svg> }
function IconSun()          { return <svg {...iconProps}><circle cx="12" cy="12" r="4"/><path d="M12 3v1.5"/><path d="M12 19.5V21"/><path d="M3 12h1.5"/><path d="M19.5 12H21"/><path d="m5.6 5.6 1 1"/><path d="m17.4 17.4 1 1"/><path d="m5.6 18.4 1-1"/><path d="m17.4 6.6 1-1"/></svg> }
function IconGauge()        { return <svg {...iconProps}><path d="M3 12a9 9 0 1 1 18 0"/><path d="m12 12 4-3"/><circle cx="12" cy="12" r="1"/></svg> }
function IconPlay()         { return <svg {...iconProps}><polygon points="6,4 20,12 6,20" /></svg> }
function IconDoc()          { return <svg {...iconProps}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M14 3v6h6"/><path d="M8 13h8"/><path d="M8 17h6"/></svg> }
function IconReceipt()      { return <svg {...iconProps}><path d="M5 4v17l2-2 2 2 2-2 2 2 2-2 2 2V4Z"/><path d="M8 9h8"/><path d="M8 13h5"/></svg> }
function IconFolder()       { return <svg {...iconProps}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/></svg> }
function IconShield()       { return <svg {...iconProps}><path d="M12 3 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6Z"/></svg> }
function IconGear()         { return <svg {...iconProps}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3 1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></svg> }
function IconLogOut()       { return <svg {...iconProps}><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="m10 17-5-5 5-5"/><path d="M15 12H5"/></svg> }
function IconExit()         { return <svg {...iconProps}><path d="M9 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H9"/><path d="m14 17-5-5 5-5"/><path d="M9 12h10"/></svg> }
function IconBank()         { return <svg {...iconProps}><path d="M3 10 12 4l9 6"/><path d="M5 10v8"/><path d="M19 10v8"/><path d="M9 14v4"/><path d="M15 14v4"/><path d="M3 20h18"/></svg> }
function IconChevronLeft()  { return <svg {...iconProps}><path d="m15 18-6-6 6-6"/></svg> }
function IconChevronRight() { return <svg {...iconProps}><path d="m9 18 6-6-6-6"/></svg> }
function IconHelp()         { return <svg {...iconProps}><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg> }
