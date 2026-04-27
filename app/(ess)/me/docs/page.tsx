import { ESS_DOCS } from '@/content/docs/ess'
import { DocsIndex } from '@/components/docs/doc-layout'

export const metadata = { title: 'Help' }

export default function EssDocsIndexPage() {
  return (
    <DocsIndex
      audience="ess"
      basePath="/me/docs"
      audienceLabel="Help"
      audienceSubtitle="Guides for using the employee portal — apply leave, read payslips, declare tax, and more."
      articles={ESS_DOCS.map((d) => d.meta)}
    />
  )
}
