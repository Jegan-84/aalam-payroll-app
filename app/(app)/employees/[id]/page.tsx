import { notFound } from 'next/navigation'
import { getEmployee, getMasterOptions } from '@/lib/employees/queries'
import { updateEmployeeAction } from '@/lib/employees/actions'
import { listEmployeeDocuments, signEmployeeFileUrl } from '@/lib/employees/self-service'
import { EmployeeForm } from '../_components/employee-form'
import { EmployeeActionsCard } from './_components/employee-actions-card'
import { SelfEditToggle } from './_components/self-edit-toggle'
import { HrDocumentsPanel } from './_components/hr-documents-panel'
import { PageHeader } from '@/components/ui/page-header'

type PP = Promise<{ id: string }>

export async function generateMetadata({ params }: { params: PP }) {
  const { id } = await params
  const emp = await getEmployee(id)
  return { title: emp ? `${emp.employee_code} — ${emp.full_name_snapshot}` : 'Employee' }
}

export default async function EmployeeEditPage({ params }: { params: PP }) {
  const { id } = await params
  const [emp, masters, docs] = await Promise.all([
    getEmployee(id),
    getMasterOptions(),
    listEmployeeDocuments(id),
  ])
  if (!emp) notFound()

  const r = emp as Record<string, unknown>
  const photoPath = (r.photo_storage_path as string | null) ?? null
  const photoUrl = photoPath ? await signEmployeeFileUrl(photoPath, 60 * 5) : null
  const signedDocs = await Promise.all(
    docs.map(async (d) => ({
      ...d,
      signed_url: await signEmployeeFileUrl(d.storage_path, 60 * 5),
    })),
  )

  const boundAction = updateEmployeeAction.bind(null, id)

  return (
    <div className="space-y-6">
      <PageHeader
        title={emp.full_name_snapshot as string}
        back={{ href: '/employees', label: 'Employees' }}
        subtitle={`Code: ${emp.employee_code} · ${emp.employment_type}`}
      />
      <SelfEditToggle employeeId={id} enabled={Boolean(r.profile_edit_enabled)} />
      <EmployeeActionsCard
        employeeId={id}
        employeeLabel={`${emp.full_name_snapshot} (${emp.employee_code})` as string}
        currentType={emp.employment_type as string}
      />
      <HrDocumentsPanel employeeId={id} photoUrl={photoUrl} docs={signedDocs} />
      <EmployeeForm
        mode="edit"
        action={boundAction}
        masters={masters}
        defaults={emp as Record<string, string | number | boolean | null | readonly (string | number)[]>}
        cancelHref="/employees"
      />
    </div>
  )
}
