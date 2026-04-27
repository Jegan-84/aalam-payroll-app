import { notFound } from 'next/navigation'
import { ESS_DOCS, ESS_DOCS_BY_SLUG } from '@/content/docs/ess'
import { DocArticle } from '@/components/docs/doc-layout'

type PP = Promise<{ slug: string }>

export async function generateMetadata({ params }: { params: PP }) {
  const { slug } = await params
  const entry = ESS_DOCS_BY_SLUG[slug]
  return { title: entry ? `Help — ${entry.meta.title}` : 'Help' }
}

export function generateStaticParams() {
  return ESS_DOCS.map((d) => ({ slug: d.meta.slug }))
}

export default async function EssDocArticlePage({ params }: { params: PP }) {
  const { slug } = await params
  const entry = ESS_DOCS_BY_SLUG[slug]
  if (!entry) notFound()

  const idx = ESS_DOCS.findIndex((d) => d.meta.slug === slug)
  const prev = idx > 0 ? ESS_DOCS[idx - 1].meta : undefined
  const next = idx >= 0 && idx < ESS_DOCS.length - 1 ? ESS_DOCS[idx + 1].meta : undefined

  const Article = entry.Component
  return (
    <DocArticle basePath="/me/docs" meta={entry.meta} prev={prev} next={next}>
      <Article />
    </DocArticle>
  )
}
