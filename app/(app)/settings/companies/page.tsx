import Link from 'next/link'
import { listCompanies } from '@/lib/companies/queries'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ButtonLink } from '@/components/ui/button'

export const metadata = { title: 'Companies' }

export default async function CompaniesPage() {
  const rows = await listCompanies()
  return (
    <div className="space-y-6">
      <PageHeader
        title="Companies"
        back={{ href: '/settings', label: 'Settings' }}
        subtitle="Legal / brand entities. Each employee is assigned to a company, which renders dynamically on their payslip."
        actions={<ButtonLink href="/settings/companies/new" variant="primary">+ New company</ButtonLink>}
      />

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
              <tr>
                <Th>Code</Th>
                <Th>Legal name</Th>
                <Th>City</Th>
                <Th>PAN</Th>
                <Th>TAN</Th>
                <Th>Status</Th>
                <Th>{' '}</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {rows.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-500">No companies yet. Create one to tag employees.</td></tr>
              )}
              {rows.map((c) => (
                <tr key={c.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-950">
                  <Td>
                    <Link href={`/settings/companies/${c.id}`} className="font-medium text-slate-900 hover:text-brand-700 hover:underline dark:text-slate-100">
                      {c.code}
                    </Link>
                  </Td>
                  <Td>{c.legal_name}</Td>
                  <Td>{c.city ?? '—'}</Td>
                  <Td className="tabular-nums">{c.pan ?? '—'}</Td>
                  <Td className="tabular-nums">{c.tan ?? '—'}</Td>
                  <Td><Badge tone={c.is_active ? 'success' : 'neutral'}>{c.is_active ? 'active' : 'inactive'}</Badge></Td>
                  <Td><Link href={`/settings/companies/${c.id}`} className="text-xs font-medium text-brand-700 hover:underline">Edit →</Link></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 ${className}`}>{children}</th>
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-slate-900 dark:text-slate-100 ${className}`}>{children}</td>
}
