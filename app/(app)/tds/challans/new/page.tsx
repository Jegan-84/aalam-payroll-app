import { PageHeader } from '@/components/ui/page-header'
import { Card, CardBody } from '@/components/ui/card'
import { ChallanForm } from '../_components/challan-form'

export const metadata = { title: 'Record TDS Challan' }

type SP = Promise<{ year?: string; month?: string }>

export default async function NewChallanPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams
  const year = sp.year ? Number(sp.year) : undefined
  const month = sp.month ? Number(sp.month) : undefined

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Record TDS Challan"
        back={{ href: '/tds/challans', label: 'TDS Challans' }}
        subtitle="Enter the details from the ITNS-281 counterfoil received when you deposited TDS at the bank."
      />
      <Card>
        <CardBody>
          <ChallanForm mode="create" defaults={{ year, month }} />
        </CardBody>
      </Card>
    </div>
  )
}
