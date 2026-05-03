import { listTotpFactors } from '@/lib/auth/mfa'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardBody } from '@/components/ui/card'
import { EnrollmentWizard } from '@/app/(app)/mfa/setup/_components/enrollment-wizard'

// =============================================================================
// ESS-side mirror of /mfa/setup. Re-uses the same enrollment wizard so the UX
// matches what admin/HR/payroll users see — only the route changes so plain
// employees can reach it without role-gating.
// =============================================================================

export const metadata = { title: 'Security' }

export default async function SecurityPage() {
  const factors = await listTotpFactors()
  const normalized = factors.map((f) => ({
    id: f.id,
    friendly_name: (f.friendly_name as string | null) ?? null,
    status: f.status as string,
    created_at: f.created_at as string,
  }))
  const hasVerified = normalized.some((f) => f.status === 'verified')

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Security — two-step verification"
        back={{ href: '/me', label: 'My Overview' }}
        subtitle="Add an authenticator app (Google Authenticator, 1Password, Authy, etc.) to protect your PeopleStack account with a 6-digit code at every login."
      />
      <Card>
        <CardBody>
          <EnrollmentWizard factors={normalized} hasVerified={hasVerified} />
        </CardBody>
      </Card>
    </div>
  )
}
