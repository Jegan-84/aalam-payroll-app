import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getEmployeeComponent } from '@/lib/components/queries'
import { ComponentForm } from '../_components/component-form'

type PP = Promise<{ id: string; componentId: string }>

export const metadata = { title: 'Edit pay component' }

export default async function EditComponentPage({ params }: { params: PP }) {
  const { id, componentId } = await params
  const c = await getEmployeeComponent(componentId)
  if (!c) notFound()
  return (
    <div className="space-y-5">
      <div>
        <Link href={`/employees/${id}/components`} className="text-sm text-slate-500 hover:underline">← Components</Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
          {c.name} <span className="text-base font-normal text-slate-500">({c.code})</span>
        </h1>
      </div>
      <ComponentForm
        employeeId={id}
        componentId={componentId}
        defaults={{
          ...c,
          effective_to: c.effective_to ?? undefined,
          notes: c.notes ?? undefined,
        }}
      />
    </div>
  )
}
