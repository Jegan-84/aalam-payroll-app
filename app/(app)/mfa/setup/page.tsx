import { listTotpFactors } from '@/lib/auth/mfa'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardBody } from '@/components/ui/card'
import { EnrollmentWizard } from './_components/enrollment-wizard'

export const metadata = { title: 'Two-step verification' }

export default async function MfaSetupPage() {
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
        title="Two-step verification"
        subtitle="Add an authenticator app to protect your PayFlow account with a 6-digit code."
      />
      <Card>
        <CardBody>
          <EnrollmentWizard factors={normalized} hasVerified={hasVerified} />
        </CardBody>
      </Card>
    </div>
  )
}
