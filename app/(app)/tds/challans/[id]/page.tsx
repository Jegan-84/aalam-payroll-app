import { notFound } from 'next/navigation'
import { getTdsChallan } from '@/lib/tds/challan-queries'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardBody } from '@/components/ui/card'
import { ChallanForm } from '../_components/challan-form'

export const metadata = { title: 'Edit TDS Challan' }

type PP = Promise<{ id: string }>

export default async function EditChallanPage({ params }: { params: PP }) {
  const { id } = await params
  const challan = await getTdsChallan(id)
  if (!challan) notFound()

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title={`Challan ${challan.bsr_code}/${challan.challan_serial_no}`}
        back={{ href: '/tds/challans', label: 'TDS Challans' }}
        subtitle={`${challan.deposit_date} · Q${challan.quarter} FY`}
      />
      <Card>
        <CardBody>
          <ChallanForm mode="edit" defaults={challan} />
        </CardBody>
      </Card>
    </div>
  )
}
