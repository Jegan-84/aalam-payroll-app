import Link from 'next/link'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'

export type DocMeta = {
  slug: string
  title: string
  summary: string
  group?: string  // section heading in the index sidebar
}

type IndexProps = {
  audience: 'ess' | 'admin'
  basePath: string                  // '/me/docs' or '/docs'
  audienceLabel: string             // 'Employee help' or 'Admin help'
  audienceSubtitle: string
  articles: DocMeta[]
}

export function DocsIndex({ audience, basePath, audienceLabel, audienceSubtitle, articles }: IndexProps) {
  const groups = new Map<string, DocMeta[]>()
  for (const a of articles) {
    const g = a.group ?? 'Articles'
    if (!groups.has(g)) groups.set(g, [])
    groups.get(g)!.push(a)
  }

  return (
    <div className="space-y-6">
      <PageHeader title={audienceLabel} subtitle={audienceSubtitle} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from(groups.entries()).map(([group, items]) => (
          <Card key={group} className="p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{group}</h2>
            <ul className="space-y-2">
              {items.map((a) => (
                <li key={a.slug}>
                  <Link
                    href={`${basePath}/${a.slug}`}
                    className="group block rounded-md border border-transparent px-2 py-1.5 transition-colors hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-800 dark:hover:bg-slate-950"
                  >
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-50 group-hover:text-brand-700 dark:group-hover:text-brand-400">
                      {a.title}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">{a.summary}</div>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      <p className="text-xs text-slate-500">
        {audience === 'ess'
          ? 'These articles cover what you can do from the employee portal. For anything missing, ask HR.'
          : 'Admin articles. For end-user-facing copy, see /me/docs.'}
      </p>
    </div>
  )
}

type ArticleProps = {
  basePath: string
  meta: DocMeta
  prev?: DocMeta
  next?: DocMeta
  children: React.ReactNode
}

export function DocArticle({ basePath, meta, prev, next, children }: ArticleProps) {
  return (
    <div className="space-y-6">
      <PageHeader
        title={meta.title}
        back={{ href: basePath, label: 'Help' }}
        subtitle={meta.summary}
      />

      <Card className="p-6 lg:p-8">
        <div className="prose-doc">{children}</div>
      </Card>

      <div className="flex items-center justify-between text-sm">
        {prev ? (
          <Link href={`${basePath}/${prev.slug}`} className="text-slate-600 hover:text-brand-700 dark:text-slate-400">
            ← {prev.title}
          </Link>
        ) : <span />}
        {next ? (
          <Link href={`${basePath}/${next.slug}`} className="text-slate-600 hover:text-brand-700 dark:text-slate-400">
            {next.title} →
          </Link>
        ) : <span />}
      </div>
    </div>
  )
}
