'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import * as React from 'react'
import { signOutAction } from '@/lib/auth/actions'

type NavItem = { href: string; label: string; icon: React.ReactNode }

function buildNav({ showApprovals }: { showApprovals?: boolean }): NavItem[] {
  const out: NavItem[] = [
    { href: '/me',                label: 'Overview',         icon: <IconHome /> },
    { href: '/me/attendance',     label: 'Attendance',       icon: <IconClock /> },
    { href: '/me/timesheet',      label: 'Timesheet',        icon: <IconClock /> },
    { href: '/me/timesheet/import', label: 'Import Timesheet', icon: <IconUpload /> },
    { href: '/me/plan',           label: 'Monthly Plan',     icon: <IconCalendarDays /> },
  ]
  if (showApprovals) {
    out.push({ href: '/me/timesheet/approvals', label: 'Team timesheets', icon: <IconCheckSquare /> })
    out.push({ href: '/me/leave/approvals',     label: 'Team leave',      icon: <IconCheckSquare /> })
    out.push({ href: '/me/comp-off/approvals',  label: 'Team comp-off',   icon: <IconCheckSquare /> })
  }
  out.push(
    { href: '/me/payslips',       label: 'Payslips',         icon: <IconReceipt /> },
    { href: '/me/leave',          label: 'Leave',            icon: <IconSun /> },
    { href: '/me/comp-off',       label: 'Comp Off',         icon: <IconSun /> },
    { href: '/me/holidays',       label: 'Holidays',         icon: <IconSun /> },
    { href: '/me/declaration',    label: 'Tax Declaration',  icon: <IconDoc /> },
    { href: '/me/reimbursements', label: 'Reimbursements',   icon: <IconWallet /> },
    { href: '/me/loans',          label: 'Loans',            icon: <IconBank /> },
    { href: '/me/fnf',            label: 'F&F',              icon: <IconExit /> },
    { href: '/me/profile',        label: 'Profile',          icon: <IconUser /> },
    { href: '/me/docs',           label: 'Help',             icon: <IconHelp /> },
  )
  return out
}

const STORAGE_KEY = 'payflow.ess_sidebar_collapsed'
const SIDEBAR_EVENT = 'payflow:ess-sidebar-toggle'

function subscribeSidebar(cb: () => void) {
  window.addEventListener(SIDEBAR_EVENT, cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener(SIDEBAR_EVENT, cb)
    window.removeEventListener('storage', cb)
  }
}
function getSnapshot() {
  return window.localStorage.getItem(STORAGE_KEY) === '1'
}
function getServerSnapshot() {
  return false
}

export function EssSidebar({
  email, fullName, showApprovals = false,
}: { email: string; fullName: string | null; showApprovals?: boolean }) {
  const pathname = usePathname()
  const isCollapsed = React.useSyncExternalStore(subscribeSidebar, getSnapshot, getServerSnapshot)
  const NAV = buildNav({ showApprovals })

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
        'dark:border-slate-800 dark:bg-slate-950',
        isCollapsed ? 'w-[68px]' : 'w-60',
      ].join(' ')}
    >
      {/* Brand */}
      <div className={`flex items-center border-b border-slate-100 dark:border-slate-800 ${isCollapsed ? 'justify-center py-4' : 'gap-2 p-4'}`}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 ring-1 ring-inset ring-brand-100 dark:bg-brand-950/40 dark:ring-brand-900">
          <Image src="/aalamLogo.png" alt="Aalam" width={28} height={28} className="h-7 w-7 object-contain" priority />
        </div>
        {!isCollapsed && (
          <div className="leading-tight">
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">PayFlow</div>
            <div className="text-[10px] font-medium uppercase tracking-wide text-brand-600">Employee Portal</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className={`flex-1 overflow-y-auto ${isCollapsed ? 'px-2 py-3' : 'p-3'}`}>
        <ul className="space-y-0.5">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  title={isCollapsed ? item.label : undefined}
                  className={[
                    'flex items-center rounded-md transition-colors',
                    isCollapsed
                      ? 'h-10 w-full justify-center'
                      : 'gap-2 px-2 py-2 text-sm',
                    active
                      ? 'bg-brand-50 font-medium text-brand-700 dark:bg-brand-950/40 dark:text-brand-300'
                      : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'flex items-center justify-center',
                      active ? 'text-brand-600' : 'text-slate-400',
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
      </nav>

      {/* User + actions */}
      <div className="border-t border-slate-100 dark:border-slate-800">
        <div className={`flex items-center ${isCollapsed ? 'justify-center px-2 py-3' : 'gap-3 p-3'}`}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
            {initials}
          </div>
          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-slate-900 dark:text-slate-100">{fullName ?? email}</div>
              {fullName && <div className="truncate text-[10px] text-slate-500">{email}</div>}
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

function getInitials(source: string) {
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const iconProps = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

function IconHome()         { return <svg {...iconProps}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M10 21v-6h4v6" /></svg> }
function IconReceipt()      { return <svg {...iconProps}><path d="M5 4v17l2-2 2 2 2-2 2 2 2-2 2 2V4Z"/><path d="M8 9h8"/><path d="M8 13h5"/></svg> }
function IconSun()          { return <svg {...iconProps}><circle cx="12" cy="12" r="4"/><path d="M12 3v1.5"/><path d="M12 19.5V21"/><path d="M3 12h1.5"/><path d="M19.5 12H21"/><path d="m5.6 5.6 1 1"/><path d="m17.4 17.4 1 1"/><path d="m5.6 18.4 1-1"/><path d="m17.4 6.6 1-1"/></svg> }
function IconDoc()          { return <svg {...iconProps}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M14 3v6h6"/><path d="M8 13h8"/><path d="M8 17h6"/></svg> }
function IconBank()         { return <svg {...iconProps}><path d="M3 10 12 4l9 6"/><path d="M5 10v8"/><path d="M19 10v8"/><path d="M9 14v4"/><path d="M15 14v4"/><path d="M3 20h18"/></svg> }
function IconExit()         { return <svg {...iconProps}><path d="M9 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H9"/><path d="m14 17-5-5 5-5"/><path d="M9 12h10"/></svg> }
function IconUser()         { return <svg {...iconProps}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg> }
function IconWallet()       { return <svg {...iconProps}><path d="M3 7h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M3 7V5a2 2 0 0 1 2-2h12"/><circle cx="16" cy="13" r="1.5"/></svg> }
function IconLogOut()       { return <svg {...iconProps}><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="m10 17-5-5 5-5"/><path d="M15 12H5"/></svg> }
function IconHelp()         { return <svg {...iconProps}><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg> }
function IconChevronLeft()  { return <svg {...iconProps} width={14} height={14}><path d="m15 18-6-6 6-6"/></svg> }
function IconChevronRight() { return <svg {...iconProps} width={14} height={14}><path d="m9 18 6-6-6-6"/></svg> }
function IconClock()        { return <svg {...iconProps}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg> }
function IconCheckSquare()  { return <svg {...iconProps}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="m8 12 3 3 5-7"/></svg> }
function IconUpload()       { return <svg {...iconProps}><path d="M12 21V9"/><path d="m7 14 5-5 5 5"/><path d="M5 3h14"/></svg> }
function IconCalendarDays() { return <svg {...iconProps}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M8 3v4"/><path d="M16 3v4"/><circle cx="8" cy="14.5" r="0.5"/><circle cx="12" cy="14.5" r="0.5"/><circle cx="16" cy="14.5" r="0.5"/></svg> }
