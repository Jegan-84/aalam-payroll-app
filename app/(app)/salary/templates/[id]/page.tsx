import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getTemplate } from '@/lib/salary-templates/queries'
import { updateTemplateAction } from '@/lib/salary-templates/actions'
import { TemplateForm } from '../_components/template-form'
import { MarkInactiveButton } from './_components/mark-inactive-button'

type PP = Promise<{ id: string }>

export async function generateMetadata({ params }: { params: PP }) {
  const { id } = await params
  const t = await getTemplate(id)
  return { title: t ? `${t.code} — ${t.name}` : 'Template' }
}

export default async function EditTemplatePage({ params }: { params: PP }) {
  const { id } = await params
  const [t, { data: designations }] = await Promise.all([
    getTemplate(id),
    (async () => {
      const supabase = await createClient()
      return supabase.from('designations').select('id, name').eq('is_active', true).order('name')
    })(),
  ])
  if (!t) notFound()

  const boundAction = updateTemplateAction.bind(null, id)

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href="/salary/templates" className="text-sm text-slate-500 hover:underline">← Templates</Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            {t.name} <span className="text-base font-normal text-slate-500">({t.code})</span>
          </h1>
        </div>
        <MarkInactiveButton id={id} />
      </div>
      <TemplateForm
        mode="edit"
        action={boundAction}
        designations={(designations ?? []) as { id: number; name: string }[]}
        defaults={t as Record<string, string | number | boolean | null>}
      />
    </div>
  )
}
