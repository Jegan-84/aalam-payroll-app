import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createTemplateAction } from '@/lib/salary-templates/actions'
import { TemplateForm } from '../_components/template-form'

export const metadata = { title: 'New salary template' }

export default async function NewTemplatePage() {
  const supabase = await createClient()
  const { data: designations } = await supabase
    .from('designations')
    .select('id, name')
    .eq('is_active', true)
    .order('name')

  return (
    <div className="space-y-5">
      <div>
        <Link href="/salary/templates" className="text-sm text-slate-500 hover:underline">← Templates</Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
          New salary template
        </h1>
      </div>
      <TemplateForm
        mode="create"
        action={createTemplateAction}
        designations={(designations ?? []) as { id: number; name: string }[]}
      />
    </div>
  )
}
