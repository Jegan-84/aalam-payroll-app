import Link from 'next/link'
import { PageHeader } from '@/components/ui/page-header'

export const metadata = { title: 'Settings' }

const cards = [
  { href: '/settings/companies',   title: 'Companies',        desc: 'Legal / brand entities. Each employee is tagged to a company, which renders on their payslip dynamically.' },
  { href: '/settings/departments', title: 'Departments',      desc: 'Engineering, Operations, Finance, etc. — used in employee profiles and reports.' },
  { href: '/settings/designations',title: 'Designations',     desc: 'Job titles / grades assigned to employees.' },
  { href: '/settings/projects',    title: 'Projects',          desc: 'Client projects employees are tagged to. Drives per-project holiday calendars.' },
  { href: '/settings/holidays',    title: 'Holiday calendar',  desc: 'Public / restricted holidays, optionally scoped to a project or location.' },
  { href: '/settings/tax',         title: 'Income-tax slabs', desc: 'Manage FY-wise slabs, standard deduction, rebate, surcharge, cess for NEW and OLD regimes.' },
  { href: '/settings/pt',          title: 'Professional Tax', desc: 'Half-yearly PT slabs per state. Roll a new period when the state revises rates.' },
  { href: '/settings/components',  title: 'Custom pay components', desc: 'HR-defined earnings / deductions with fixed, %, or formula calculation. Added on top of statutory components.' },
  { href: '/settings/statutory',   title: 'Statutory configuration', desc: 'BASIC / HRA / Conveyance rates, PF, ESI, and Gratuity percentages. Drives every new payslip.' },
  { href: '/settings/leave-policies', title: 'Leave policies',  desc: 'Per-type accrual, carry-forward, and balance caps. Run monthly accrual from here.' },
  { href: '/users',                title: 'Users & roles',    desc: 'Invite users, assign admin/HR/payroll/employee roles, reset passwords, deactivate.' },
]

export default function SettingsIndex() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Payroll master data that rarely changes — companies, departments, tax slabs, statutory caps, users."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="group flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:border-brand-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-700"
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">{c.title}</div>
              <span className="text-slate-300 transition-colors group-hover:text-brand-600">→</span>
            </div>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{c.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
