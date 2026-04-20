import { NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/dal'
import { createClient } from '@/lib/supabase/server'
import { MONTH_NAMES } from '@/lib/attendance/engine'

export const runtime = 'nodejs'

export type SearchItem = {
  id: string
  kind: 'employee' | 'company' | 'department' | 'designation' | 'cycle' | 'leave' | 'page'
  title: string
  subtitle?: string
  href: string
}
export type SearchGroup = { label: string; items: SearchItem[] }
export type SearchResponse = { groups: SearchGroup[] }

const STATIC_PAGES: SearchItem[] = [
  { id: 'page:dashboard',       kind: 'page', title: 'Dashboard',              href: '/dashboard' },
  { id: 'page:employees',       kind: 'page', title: 'Employees',              href: '/employees' },
  { id: 'page:salary',          kind: 'page', title: 'Salary Structures',      href: '/salary' },
  { id: 'page:salary/tpl',      kind: 'page', title: 'Salary Templates',       href: '/salary/templates' },
  { id: 'page:attendance',      kind: 'page', title: 'Attendance',             href: '/attendance' },
  { id: 'page:leave',           kind: 'page', title: 'Leave',                  href: '/leave' },
  { id: 'page:leave/bal',       kind: 'page', title: 'Leave Balances',         href: '/leave/balances' },
  { id: 'page:payroll',         kind: 'page', title: 'Payroll Runs',           href: '/payroll' },
  { id: 'page:declarations',    kind: 'page', title: 'Tax Declarations',       href: '/declarations' },
  { id: 'page:tds',             kind: 'page', title: 'TDS & Form 16',          href: '/tds' },
  { id: 'page:reports',         kind: 'page', title: 'Statutory Reports',      href: '/reports' },
  { id: 'page:users',           kind: 'page', title: 'Users',                  href: '/users' },
  { id: 'page:settings',        kind: 'page', title: 'Settings',               href: '/settings' },
  { id: 'page:settings/co',     kind: 'page', title: 'Companies (settings)',   href: '/settings/companies' },
  { id: 'page:settings/dept',   kind: 'page', title: 'Departments (settings)', href: '/settings/departments' },
  { id: 'page:settings/desig',  kind: 'page', title: 'Designations (settings)',href: '/settings/designations' },
  { id: 'page:settings/tax',    kind: 'page', title: 'Tax slabs (settings)',   href: '/settings/tax' },
]

function matchesPage(q: string, page: SearchItem): boolean {
  const needle = q.toLowerCase()
  return page.title.toLowerCase().includes(needle) || page.href.toLowerCase().includes(needle)
}

function monthMatches(q: string, year: number, month: number): boolean {
  const needle = q.toLowerCase().trim()
  const monthName = MONTH_NAMES[month - 1].toLowerCase()
  const shortMonth = monthName.slice(0, 3)
  const yymm = `${year}-${String(month).padStart(2, '0')}`
  const nice = `${monthName} ${year}`
  return (
    nice.includes(needle) ||
    yymm.includes(needle) ||
    needle.includes(monthName) ||
    needle.includes(shortMonth) ||
    needle === String(year) ||
    needle === String(month)
  )
}

export async function GET(req: Request) {
  await verifySession()
  const q = new URL(req.url).searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return NextResponse.json<SearchResponse>({ groups: [] })

  const supabase = await createClient()
  const like = `%${q.replace(/%/g, '')}%`

  const [emps, companies, depts, desigs, cycles, leaveApps] = await Promise.all([
    supabase
      .from('employees')
      .select('id, employee_code, full_name_snapshot, work_email, employment_status')
      .or(
        `employee_code.ilike.${like},work_email.ilike.${like},first_name.ilike.${like},last_name.ilike.${like}`,
      )
      .limit(6),
    supabase
      .from('companies')
      .select('id, code, legal_name, display_name')
      .or(`code.ilike.${like},legal_name.ilike.${like},display_name.ilike.${like}`)
      .limit(5),
    supabase.from('departments').select('id, code, name').or(`code.ilike.${like},name.ilike.${like}`).limit(5),
    supabase.from('designations').select('id, code, name, grade').or(`code.ilike.${like},name.ilike.${like}`).limit(5),
    supabase
      .from('payroll_cycles')
      .select('id, year, month, status')
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(24),
    supabase
      .from('leave_applications')
      .select(`id, from_date, to_date, status, employee:employees!inner ( employee_code, full_name_snapshot )`)
      .or(
        `employee_code.ilike.${like},full_name_snapshot.ilike.${like}`,
        { foreignTable: 'employees' },
      )
      .order('applied_at', { ascending: false })
      .limit(5),
  ])

  const groups: SearchGroup[] = []

  const empItems: SearchItem[] = (emps.data ?? []).map((e) => ({
    id: `emp:${e.id}`,
    kind: 'employee',
    title: e.full_name_snapshot as string,
    subtitle: `${e.employee_code} · ${e.work_email}`,
    href: `/employees/${e.id}`,
  }))
  if (empItems.length) groups.push({ label: 'Employees', items: empItems })

  const coItems: SearchItem[] = (companies.data ?? []).map((c) => ({
    id: `co:${c.id}`,
    kind: 'company',
    title: c.legal_name as string,
    subtitle: `${c.code}`,
    href: `/settings/companies/${c.id}`,
  }))
  if (coItems.length) groups.push({ label: 'Companies', items: coItems })

  const deptItems: SearchItem[] = (depts.data ?? []).map((d) => ({
    id: `dept:${d.id}`,
    kind: 'department',
    title: d.name as string,
    subtitle: `Department · ${d.code}`,
    href: `/settings/departments`,
  }))
  if (deptItems.length) groups.push({ label: 'Departments', items: deptItems })

  const desigItems: SearchItem[] = (desigs.data ?? []).map((d) => ({
    id: `desig:${d.id}`,
    kind: 'designation',
    title: d.name as string,
    subtitle: `Designation${d.grade ? ' · ' + d.grade : ''} · ${d.code}`,
    href: `/settings/designations`,
  }))
  if (desigItems.length) groups.push({ label: 'Designations', items: desigItems })

  const cycleItems: SearchItem[] = (cycles.data ?? [])
    .filter((c) => monthMatches(q, c.year as number, c.month as number) || (c.status as string).toLowerCase().includes(q.toLowerCase()))
    .slice(0, 5)
    .map((c) => ({
      id: `cyc:${c.id}`,
      kind: 'cycle',
      title: `${MONTH_NAMES[(c.month as number) - 1]} ${c.year}`,
      subtitle: `Payroll cycle · ${c.status}`,
      href: `/payroll/${c.id}`,
    }))
  if (cycleItems.length) groups.push({ label: 'Payroll cycles', items: cycleItems })

  type LeaveRow = {
    id: string; from_date: string; to_date: string; status: string
    employee: { employee_code: string; full_name_snapshot: string } | { employee_code: string; full_name_snapshot: string }[] | null
  }
  const leaveItems: SearchItem[] = ((leaveApps.data ?? []) as unknown as LeaveRow[]).map((l) => {
    const emp = Array.isArray(l.employee) ? l.employee[0] : l.employee
    return {
      id: `leave:${l.id}`,
      kind: 'leave',
      title: emp ? `${emp.full_name_snapshot} (${emp.employee_code})` : 'Leave application',
      subtitle: `Leave · ${l.from_date} → ${l.to_date} · ${l.status}`,
      href: `/leave/${l.id}`,
    }
  })
  if (leaveItems.length) groups.push({ label: 'Leave applications', items: leaveItems })

  const pageItems = STATIC_PAGES.filter((p) => matchesPage(q, p))
  if (pageItems.length) groups.push({ label: 'Navigate', items: pageItems.slice(0, 6) })

  return NextResponse.json<SearchResponse>({ groups })
}
