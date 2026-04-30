import { notFound } from 'next/navigation'
import { getEmployee, getMasterOptions } from '@/lib/employees/queries'
import { updateEmployeeAction } from '@/lib/employees/actions'
import { EmployeeForm } from '../_components/employee-form'
import { EmployeeActionsCard } from './_components/employee-actions-card'
import { PageHeader } from '@/components/ui/page-header'

type PP = Promise<{ id: string }>

export async function generateMetadata({ params }: { params: PP }) {
  const { id } = await params
  const emp = await getEmployee(id)
  return { title: emp ? `${emp.employee_code} — ${emp.full_name_snapshot}` : 'Employee' }
}

export default async function EmployeeEditPage({ params }: { params: PP }) {
  const { id } = await params
  const [emp, masters] = await Promise.all([getEmployee(id), getMasterOptions()])
  if (!emp) notFound()

  const boundAction = updateEmployeeAction.bind(null, id)

  return (
    <div className="space-y-6">
      <PageHeader
        title={emp.full_name_snapshot as string}
        back={{ href: '/employees', label: 'Employees' }}
        subtitle={`Code: ${emp.employee_code} · ${emp.employment_type}`}
      />
      <EmployeeActionsCard
        employeeId={id}
        employeeLabel={`${emp.full_name_snapshot} (${emp.employee_code})` as string}
        currentType={emp.employment_type as string}
      />
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
