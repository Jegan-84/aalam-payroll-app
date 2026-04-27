import Link from 'next/link'
import { listCycles } from '@/lib/payroll/queries'
import { MONTH_NAMES } from '@/lib/attendance/engine'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const metadata = { title: 'Payroll Journal' }

export default async function PayrollJournalPage() {
  const cycles = await listCycles()
  const eligible = cycles.filter((c) => c.status === 'approved' || c.status === 'locked' || c.status === 'paid')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll Journal"
        back={{ href: '/reports', label: 'Reports' }}
        subtitle="Cycle-level CSV grouped by component code — ready for import into Tally / SAP / Zoho Books. Includes a suggested GL account per component."
      />

      {eligible.length === 0 && (
        <Card className="p-8 text-center text-sm text-slate-500">
          No approved payroll cycles yet. Approve a cycle from <Link href="/payroll" className="underline">Payroll</Link>.
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {eligible.map((c) => (
          <Card key={c.id} className="flex flex-col p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                {MONTH_NAMES[c.month - 1]} {c.year}
              </div>
              <Badge tone={c.status === 'paid' ? 'brand' : 'success'}>{c.status}</Badge>
            </div>
            <p className="mt-1 text-xs text-slate-500">{c.employee_count} employee{c.employee_count === 1 ? '' : 's'}</p>
            <a
              href={`/api/reports/journal/${c.id}`}
              className="mt-3 inline-flex h-8 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-xs font-medium hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
            >
              Download journal CSV
            </a>
          </Card>
        ))}
      </div>
    </div>
  )
}
