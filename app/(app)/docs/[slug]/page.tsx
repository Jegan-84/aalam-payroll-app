import { notFound } from 'next/navigation'
import { ADMIN_DOCS, ADMIN_DOCS_BY_SLUG } from '@/content/docs/admin'
import { DocArticle } from '@/components/docs/doc-layout'

type PP = Promise<{ slug: string }>

export async function generateMetadata({ params }: { params: PP }) {
  const { slug } = await params
  const entry = ADMIN_DOCS_BY_SLUG[slug]
  return { title: entry ? `Help — ${entry.meta.title}` : 'Help' }
}

export function generateStaticParams() {
  return ADMIN_DOCS.map((d) => ({ slug: d.meta.slug }))
}

export default async function AdminDocArticlePage({ params }: { params: PP }) {
  const { slug } = await params
  const entry = ADMIN_DOCS_BY_SLUG[slug]
  if (!entry) notFound()

  const idx = ADMIN_DOCS.findIndex((d) => d.meta.slug === slug)
  const prev = idx > 0 ? ADMIN_DOCS[idx - 1].meta : undefined
  const next = idx >= 0 && idx < ADMIN_DOCS.length - 1 ? ADMIN_DOCS[idx + 1].meta : undefined

  const Article = entry.Component
  return (
    <DocArticle basePath="/docs" meta={entry.meta} prev={prev} next={next}>
      <Article />
    </DocArticle>
  )
}
