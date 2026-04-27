import { notFound } from 'next/navigation'
import { getCurrentEmployee } from '@/lib/auth/dal'
import { getEmployee } from '@/lib/employees/queries'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

export const metadata = { title: 'My Profile' }

export default async function MyProfilePage() {
  const { employeeId } = await getCurrentEmployee()
  const emp = await getEmployee(employeeId)
  if (!emp) notFound()

  const r = emp as Record<string, unknown>

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profile"
        subtitle={`${emp.employee_code} · read-only. Contact HR for corrections.`}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Identity</CardTitle></CardHeader>
          <CardBody>
            <Grid>
              <Field label="Full name" value={emp.full_name_snapshot} />
              <Field label="Employee code" value={emp.employee_code} />
              <Field label="Work email" value={r.work_email as string} />
              <Field label="Personal email" value={(r.personal_email as string | null) ?? '—'} />
              <Field label="Phone" value={(r.personal_phone as string | null) ?? '—'} />
              <Field label="Gender" value={(r.gender as string | null) ?? '—'} />
              <Field label="Date of birth" value={(r.date_of_birth as string | null) ?? '—'} />
              <Field label="PAN" value={(r.pan_number as string | null) ?? '—'} />
              <Field label="Aadhaar (last 4)" value={maskAadhaar(r.aadhaar_number as string | null)} />
              <Field label="UAN" value={(r.uan_number as string | null) ?? '—'} />
              <Field label="ESI number" value={(r.esi_number as string | null) ?? '—'} />
            </Grid>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Employment</CardTitle></CardHeader>
          <CardBody>
            <Grid>
              <Field label="Date of joining" value={(r.date_of_joining as string | null) ?? '—'} />
              <Field label="Employment status" value={String(r.employment_status ?? '—').replace('_', ' ')} />
              <Field label="Employment type" value={String(r.employment_type ?? '—').replace('_', ' ')} />
              <Field label="Tax regime" value={(r.tax_regime_code as string | null) ?? '—'} />
              <Field label="Lunch applicable" value={r.lunch_applicable ? 'Yes (₹250/mo)' : 'No'} />
              <Field label="Shift allowance" value={r.shift_applicable ? `₹${r.shift_allowance_monthly}/mo` : 'No'} />
            </Grid>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Bank</CardTitle></CardHeader>
          <CardBody>
            <Grid>
              <Field label="Bank" value={(r.bank_name as string | null) ?? '—'} />
              <Field label="Account number (last 4)" value={maskAccount(r.bank_account_number as string | null)} />
              <Field label="IFSC" value={(r.bank_ifsc as string | null) ?? '—'} />
              <Field label="Account type" value={(r.bank_account_type as string | null) ?? '—'} />
            </Grid>
            <p className="mt-3 text-xs text-slate-500">
              Account and IFSC are what Finance uses to credit your salary. If incorrect, email HR urgently.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Address</CardTitle></CardHeader>
          <CardBody>
            <Grid>
              <Field label="Current address" value={joinAddress(r, 'current')} />
              <Field label="Permanent address" value={joinAddress(r, 'permanent')} />
            </Grid>
          </CardBody>
        </Card>
      </div>

      <p className="text-xs text-slate-500">
        Need to update anything? Reach out to HR — send a <Link href="mailto:hr@aalamsoft.com" className="underline">note</Link>.
      </p>
    </div>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</dl>
}
function Field({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-900 dark:text-slate-100">{value || '—'}</dd>
    </div>
  )
}

function maskAadhaar(v: string | null) {
  if (!v) return '—'
  return 'XXXX XXXX ' + v.slice(-4)
}
function maskAccount(v: string | null) {
  if (!v) return '—'
  return 'XXXX' + v.slice(-4)
}
function joinAddress(r: Record<string, unknown>, prefix: 'current' | 'permanent'): string {
  const parts = [
    r[`${prefix}_address_line1`],
    r[`${prefix}_address_line2`],
    [r[`${prefix}_address_city`], r[`${prefix}_address_state`], r[`${prefix}_address_pincode`]].filter(Boolean).join(' '),
    r[`${prefix}_address_country`],
  ].filter(Boolean) as string[]
  return parts.join(', ') || '—'
}
