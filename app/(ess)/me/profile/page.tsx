import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCurrentEmployee } from '@/lib/auth/dal'
import { getEmployee } from '@/lib/employees/queries'
import { signEmployeeFileUrl } from '@/lib/employees/self-service'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { SelfProfileForm } from './_components/self-profile-form'
import { ProfilePhotoUploader } from './_components/profile-photo-uploader'

export const metadata = { title: 'My Profile' }

export default async function MyProfilePage() {
  const { employeeId } = await getCurrentEmployee()
  const emp = await getEmployee(employeeId)
  if (!emp) notFound()

  const r = emp as Record<string, unknown>
  const editable = Boolean(r.profile_edit_enabled)
  const photoPath = (r.photo_storage_path as string | null) ?? null
  const photoUrl = photoPath ? await signEmployeeFileUrl(photoPath, 60 * 5) : null

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profile"
        subtitle={
          editable
            ? `${emp.employee_code} · self-edit enabled. Tax regime, employment, and pay details remain HR-only.`
            : `${emp.employee_code} · read-only. Ask HR to enable editing if you need to update anything.`
        }
      />

      <ProfilePhotoUploader photoUrl={photoUrl} editable={editable} />

      {editable ? (
        <SelfProfileForm defaults={r as Record<string, string | number | boolean | null | undefined>} />
      ) : (
        <ReadOnlyView r={r} emp={emp} />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Upload Aadhaar, PAN, marksheets, degree, experience letters, and other onboarding documents.
            PDFs only (max 5 MB each).
          </p>
          <Link
            href="/me/profile/documents"
            className="mt-3 inline-flex h-9 items-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
          >
            Manage documents →
          </Link>
        </CardBody>
      </Card>

      {/* Always-visible read-only block: tax + employment + pay info that can't be edited from ESS */}
      <Card>
        <CardHeader>
          <CardTitle>Employment & tax</CardTitle>
        </CardHeader>
        <CardBody>
          <Grid>
            <Field label="Date of joining" value={(r.date_of_joining as string | null) ?? '—'} />
            <Field label="Employment status" value={String(r.employment_status ?? '—').replace('_', ' ')} />
            <Field label="Employment type" value={String(r.employment_type ?? '—').replace('_', ' ')} />
            <Field label="Tax regime" value={(r.tax_regime_code as string | null) ?? '—'} />
            <Field label="Lunch applicable" value={r.lunch_applicable ? 'Yes (₹250/mo)' : 'No'} />
            <Field
              label="Shift allowance"
              value={r.shift_applicable ? `₹${r.shift_allowance_monthly}/mo` : 'No'}
            />
          </Grid>
          <p className="mt-3 text-xs text-slate-500">
            Tax regime is locked from ESS. Contact HR to switch between OLD and NEW.
          </p>
        </CardBody>
      </Card>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Read-only view (when editing is disabled)
// -----------------------------------------------------------------------------
function ReadOnlyView({
  r, emp,
}: { r: Record<string, unknown>; emp: { employee_code: string; full_name_snapshot: string } }) {
  return (
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
