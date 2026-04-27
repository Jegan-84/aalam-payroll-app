import { PageHeader } from '@/components/ui/page-header'
import { Card, CardBody } from '@/components/ui/card'
import { CustomComponentForm } from '../_components/component-form'

export const metadata = { title: 'New Custom Component' }

export default function NewCustomComponentPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="New custom component"
        back={{ href: '/settings/components', label: 'Custom Pay Components' }}
        subtitle="Define an org-wide earning, deduction, or reimbursement evaluated during every payroll cycle."
      />
      <Card>
        <CardBody>
          <CustomComponentForm mode="create" />
        </CardBody>
      </Card>
    </div>
  )
}
