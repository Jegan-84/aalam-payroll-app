import Link from 'next/link'
import { listCycles } from '@/lib/payroll/queries'
import { MONTH_NAMES } from '@/lib/attendance/engine'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const metadata = { title: 'Reports' }

export default async function ReportsPage() {
  const cycles = await listCycles()
  const eligible = cycles.filter((c) => ['approved', 'locked', 'paid'].includes(c.status))
  const currentYear = new Date().getFullYear()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Statutory Reports"
        subtitle="Downloads pull from payroll runs that are at least approved. TN PT and gratuity span multiple months."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>PF ECR (monthly)</CardTitle></CardHeader>
          <CardBody>
            <p className="mb-3 text-xs text-slate-600 dark:text-slate-400">
              EPFO electronic challan-cum-return. Upload on unifiedportal-emp.epfindia.gov.in.
            </p>
            {eligible.length === 0 ? <EmptyHint /> : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {eligible.map((c) => (
                  <li key={c.id} className="flex items-center justify-between py-2">
                    <span className="text-sm">
                      <span className="font-medium">{MONTH_NAMES[c.month - 1]} {c.year}</span>
                      <Badge tone="success" className="ml-2">{c.status}</Badge>
                    </span>
                    <DownloadLink href={`/api/reports/pf-ecr/${c.id}`} label=".txt" />
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>ESI contribution (monthly)</CardTitle></CardHeader>
          <CardBody>
            <p className="mb-3 text-xs text-slate-600 dark:text-slate-400">
              Only employees with monthly gross ≤ ₹21,000 (within ESI coverage).
            </p>
            {eligible.length === 0 ? <EmptyHint /> : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {eligible.map((c) => (
                  <li key={c.id} className="flex items-center justify-between py-2">
                    <span className="text-sm">
                      <span className="font-medium">{MONTH_NAMES[c.month - 1]} {c.year}</span>
                      <Badge tone="success" className="ml-2">{c.status}</Badge>
                    </span>
                    <DownloadLink href={`/api/reports/esi/${c.id}`} label="CSV" />
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Professional Tax — Tamil Nadu (half-yearly)</CardTitle></CardHeader>
          <CardBody>
            <p className="mb-3 text-xs text-slate-600 dark:text-slate-400">
              H1: Apr–Sep, H2: Oct–Mar. Uses locked/approved cycles only.
            </p>
            <div className="flex flex-wrap gap-2">
              <PtLink half="H1" year={currentYear} />
              <PtLink half="H2" year={currentYear} />
              <PtLink half="H1" year={currentYear - 1} />
              <PtLink half="H2" year={currentYear - 1} />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Gratuity register</CardTitle></CardHeader>
          <CardBody>
            <p className="mb-3 text-xs text-slate-600 dark:text-slate-400">
              Snapshot of current eligibility + statutory payable if each employee exited today.
            </p>
            <DownloadLink href="/api/reports/gratuity" label="CSV" />
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

function DownloadLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="inline-flex h-8 items-center rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-brand-950/40 dark:hover:text-brand-300"
    >
      Download {label}
    </a>
  )
}

function PtLink({ half, year }: { half: 'H1' | 'H2'; year: number }) {
  const label = half === 'H1' ? `H1 Apr–Sep ${year}` : `H2 Oct ${year - 1} – Mar ${year}`
  return <DownloadLink href={`/api/reports/pt/${half}/${year}`} label={label} />
}

function EmptyHint() {
  return (
    <p className="text-xs text-slate-500 dark:text-slate-400">
      Approve a payroll cycle from <Link href="/payroll" className="underline">Payroll</Link> to enable downloads.
    </p>
  )
}
