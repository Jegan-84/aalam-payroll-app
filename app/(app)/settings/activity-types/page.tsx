import { listActivityTypes } from '@/lib/masters/queries'
import { saveActivityTypeAction } from '@/lib/masters/actions'
import { MasterRow } from '../_components/master-row'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card'

export const metadata = { title: 'Activity types' }

const fields = [
  { key: 'code',      label: 'Code',     placeholder: 'DEV',         upper: true, colWidth: 'w-32' },
  { key: 'name',      label: 'Name',     placeholder: 'Development', colWidth: 'w-60' },
  { key: 'is_active', label: 'Active',   type: 'checkbox' as const },
]

export default async function ActivityTypesPage() {
  const rows = await listActivityTypes()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity types"
        back={{ href: '/settings', label: 'Settings' }}
        subtitle="Used by the timesheet module to tag what the time was spent on (Development, Bug fix, Meeting, etc.)."
      />

      <Card>
        <CardHeader><CardTitle>Add new</CardTitle></CardHeader>
        <CardBody>
          <MasterRow
            action={saveActivityTypeAction}
            fields={fields}
            defaults={{ is_active: true }}
            saveLabel="Add"
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Existing ({rows.length})</CardTitle></CardHeader>
        <CardBody className="space-y-3">
          {rows.length === 0 && <p className="text-sm text-slate-500">No activity types yet.</p>}
          {rows.map((r) => (
            <MasterRow
              key={r.id}
              action={saveActivityTypeAction}
              fields={fields}
              defaults={{
                id: r.id,
                code: r.code,
                name: r.name,
                is_active: r.is_active,
              }}
              saveLabel="Save"
            />
          ))}
        </CardBody>
      </Card>
    </div>
  )
}
