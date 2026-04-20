import Link from 'next/link'
import { listTemplates } from '@/lib/salary-templates/queries'
import { formatInr } from '@/lib/format'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { ButtonLink } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export const metadata = { title: 'Salary Templates' }

export default async function TemplatesPage() {
  const rows = await listTemplates()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Salary Templates"
        back={{ href: '/salary', label: 'Salary' }}
        subtitle="Reusable presets. Use them to pre-fill a new structure on an employee's salary page."
        actions={<ButtonLink href="/salary/templates/new" variant="primary">+ New template</ButtonLink>}
      />

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
              <tr>
                <Th>Code</Th>
                <Th>Name</Th>
                <Th>Employment type</Th>
                <Th className="text-right">Annual CTC</Th>
                <Th className="text-right">VP %</Th>
                <Th>EPF mode</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {rows.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-500">No templates yet. Create one above.</td></tr>
              )}
              {rows.map((t) => (
                <tr key={t.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-950">
                  <Td>
                    <Link href={`/salary/templates/${t.id}`} className="font-medium text-slate-900 hover:text-brand-700 hover:underline dark:text-slate-100">
                      {t.code}
                    </Link>
                  </Td>
                  <Td>{t.name}</Td>
                  <Td>{t.employment_type ?? '—'}</Td>
                  <Td className="text-right font-medium tabular-nums">{formatInr(t.annual_fixed_ctc)}</Td>
                  <Td className="text-right tabular-nums">{Number(t.variable_pay_percent).toFixed(1)}</Td>
                  <Td>{t.epf_mode}</Td>
                  <Td><Badge tone={t.is_active ? 'success' : 'neutral'}>{t.is_active ? 'active' : 'inactive'}</Badge></Td>
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
