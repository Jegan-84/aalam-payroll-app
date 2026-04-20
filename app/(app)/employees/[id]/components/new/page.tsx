import Link from 'next/link'
import { ComponentForm } from '../_components/component-form'

type PP = Promise<{ id: string }>

export const metadata = { title: 'New pay component' }

export default async function NewComponentPage({ params }: { params: PP }) {
  const { id } = await params
  const today = new Date().toISOString().slice(0, 10)
  return (
    <div className="space-y-5">
      <div>
        <Link href={`/employees/${id}/components`} className="text-sm text-slate-500 hover:underline">← Components</Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
          New recurring component
        </h1>
      </div>
      <ComponentForm
        employeeId={id}
        defaults={{ effective_from: today, is_active: true, kind: 'earning', prorate: false, include_in_gross: false }}
      />
    </div>
  )
}
