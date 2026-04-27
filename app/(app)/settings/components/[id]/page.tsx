import { notFound } from 'next/navigation'
import { getCustomComponent } from '@/lib/pay-components/queries'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardBody } from '@/components/ui/card'
import { CustomComponentForm } from '../_components/component-form'

export const metadata = { title: 'Edit Custom Component' }

type PP = Promise<{ id: string }>

export default async function EditCustomComponentPage({ params }: { params: PP }) {
  const { id } = await params
  const row = await getCustomComponent(Number(id))
  if (!row) notFound()

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title={row.name}
        back={{ href: '/settings/components', label: 'Custom Pay Components' }}
        subtitle={`Code: ${row.code} · ${row.is_active ? 'Active' : 'Inactive'}`}
      />
      <Card>
        <CardBody>
          <CustomComponentForm mode="edit" defaults={row} />
        </CardBody>
      </Card>
    </div>
  )
}
