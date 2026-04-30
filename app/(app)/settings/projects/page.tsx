import { listProjects } from '@/lib/masters/queries'
import { saveProjectAction } from '@/lib/masters/actions'
import { MasterRow } from '../_components/master-row'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card'

export const metadata = { title: 'Projects' }

const fields = [
  { key: 'code',      label: 'Code',   placeholder: 'ACME',     upper: true, colWidth: 'w-32', readOnly: 'on-edit' as const },
  { key: 'name',      label: 'Name',   placeholder: 'Acme Platform', colWidth: 'w-60' },
  { key: 'client',    label: 'Client', placeholder: 'Acme Inc. (optional)', colWidth: 'w-52' },
  { key: 'is_active', label: 'Active', type: 'checkbox' as const },
]

export default async function ProjectsPage() {
  const rows = await listProjects()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        back={{ href: '/settings', label: 'Settings' }}
        subtitle="Client / delivery projects. Employees pick one primary project (drives the holiday list) and any number of secondary."
      />

      <Card>
        <CardHeader><CardTitle>Add new</CardTitle></CardHeader>
        <CardBody>
          <MasterRow action={saveProjectAction} fields={fields} defaults={{ is_active: true }} saveLabel="Add" />
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Existing ({rows.length})</CardTitle></CardHeader>
        <CardBody className="space-y-3">
          {rows.length === 0 && <p className="text-sm text-slate-500">No projects yet.</p>}
          {rows.map((r) => (
            <MasterRow
              key={r.id}
              action={saveProjectAction}
              fields={fields}
              defaults={{ id: r.id, code: r.code, name: r.name, client: r.client ?? '', is_active: r.is_active }}
              saveLabel="Save"
            />
          ))}
        </CardBody>
      </Card>
    </div>
  )
}
