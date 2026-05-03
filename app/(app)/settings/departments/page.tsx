import { listDepartments } from '@/lib/masters/queries'
import { saveDepartmentAction } from '@/lib/masters/actions'
import { MasterRow } from '../_components/master-row'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card'

export const metadata = { title: 'Departments' }

const fields = [
  { key: 'code', label: 'Code', placeholder: 'ENG', upper: true, colWidth: 'w-32', readOnly: 'on-edit' as const },
  { key: 'name', label: 'Name', placeholder: 'Engineering', colWidth: 'w-60' },
  { key: 'is_active', label: 'Active', type: 'checkbox' as const },
]

export default async function DepartmentsPage() {
  const rows = await listDepartments()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Departments"
        back={{ href: '/settings', label: 'Settings' }}
        subtitle="Manage the department list that appears in employee profiles and reports."
      />

      <Card>
        <CardHeader><CardTitle>Add new</CardTitle></CardHeader>
        <CardBody>
          <MasterRow action={saveDepartmentAction} fields={fields} defaults={{ is_active: true }} saveLabel="Add" />
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Existing ({rows.length})</CardTitle></CardHeader>
        <CardBody className="space-y-3">
          {rows.length === 0 && <p className="text-sm text-slate-500">No departments yet.</p>}
          {rows.map((r) => (
            <MasterRow
              key={r.id}
              action={saveDepartmentAction}
              fields={fields}
              defaults={{ id: r.id, code: r.code, name: r.name, is_active: r.is_active }}
              saveLabel="Save"
            />
          ))}
        </CardBody>
      </Card>
    </div>
  )
}
