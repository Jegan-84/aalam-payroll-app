import { listDesignations } from '@/lib/masters/queries'
import { saveDesignationAction } from '@/lib/masters/actions'
import { MasterRow } from '../_components/master-row'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card'

export const metadata = { title: 'Designations' }

const fields = [
  { key: 'code',  label: 'Code',  placeholder: 'SE',  upper: true, colWidth: 'w-32', readOnly: 'on-edit' as const },
  { key: 'name',  label: 'Name',  placeholder: 'Software Engineer', colWidth: 'w-60' },
  { key: 'grade', label: 'Grade', placeholder: 'L2',  colWidth: 'w-20' },
  { key: 'is_active', label: 'Active', type: 'checkbox' as const },
]

export default async function DesignationsPage() {
  const rows = await listDesignations()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Designations"
        back={{ href: '/settings', label: 'Settings' }}
        subtitle="Job titles / grades assigned to employees. Changes don't retro-edit historical payslips."
      />

      <Card>
        <CardHeader><CardTitle>Add new</CardTitle></CardHeader>
        <CardBody>
          <MasterRow action={saveDesignationAction} fields={fields} defaults={{ is_active: true }} saveLabel="Add" />
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Existing ({rows.length})</CardTitle></CardHeader>
        <CardBody className="space-y-3">
          {rows.length === 0 && <p className="text-sm text-slate-500">No designations yet.</p>}
          {rows.map((r) => (
            <MasterRow
              key={r.id}
              action={saveDesignationAction}
              fields={fields}
              defaults={{ id: r.id, code: r.code, name: r.name, grade: r.grade, is_active: r.is_active }}
              saveLabel="Save"
            />
          ))}
        </CardBody>
      </Card>
    </div>
  )
}
