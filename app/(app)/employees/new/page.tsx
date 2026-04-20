import { getMasterOptions } from '@/lib/employees/queries'
import { createEmployeeAction } from '@/lib/employees/actions'
import { EmployeeForm } from '../_components/employee-form'
import { PageHeader } from '@/components/ui/page-header'

export const metadata = { title: 'New employee' }

export default async function NewEmployeePage() {
  const masters = await getMasterOptions()
  return (
    <div className="space-y-6">
      <PageHeader title="New employee" back={{ href: '/employees', label: 'Employees' }} />
      <EmployeeForm
        mode="create"
        action={createEmployeeAction}
        masters={masters}
        cancelHref="/employees"
      />
    </div>
  )
}
