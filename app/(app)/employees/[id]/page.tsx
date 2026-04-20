import { notFound } from 'next/navigation'
import { getEmployee, getMasterOptions } from '@/lib/employees/queries'
import { updateEmployeeAction } from '@/lib/employees/actions'
import { EmployeeForm } from '../_components/employee-form'
import { PageHeader } from '@/components/ui/page-header'
import { ButtonLink } from '@/components/ui/button'

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
        title={emp.full_name_snapshot}
        back={{ href: '/employees', label: 'Employees' }}
        subtitle={`Code: ${emp.employee_code}`}
        actions={
          <>
            <ButtonLink href={`/employees/${id}/salary`} variant="outline" size="md">Salary structure →</ButtonLink>
            <ButtonLink href={`/employees/${id}/declaration`} variant="outline" size="md">Tax declaration →</ButtonLink>
            <ButtonLink href={`/employees/${id}/components`} variant="outline" size="md">Recurring components →</ButtonLink>
            <ButtonLink href={`/employees/${id}/loans`} variant="outline" size="md">Loans →</ButtonLink>
            <ButtonLink href={`/employees/${id}/fnf`} variant="outline" size="md">F&amp;F settlement →</ButtonLink>
          </>
        }
      />
      <EmployeeForm
        mode="edit"
        action={boundAction}
        masters={masters}
        defaults={emp as Record<string, string | number | boolean | null>}
        cancelHref="/employees"
      />
    </div>
  )
}
