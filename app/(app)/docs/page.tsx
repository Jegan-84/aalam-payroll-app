import { ADMIN_DOCS } from '@/content/docs/admin'
import { DocsIndex } from '@/components/docs/doc-layout'

export const metadata = { title: 'Help — admin' }

export default function AdminDocsIndexPage() {
  return (
    <DocsIndex
      audience="admin"
      basePath="/docs"
      audienceLabel="Help — Admin / HR / Payroll"
      audienceSubtitle="Operating guide for the admin app — setup, monthly payroll, leave administration, statutory."
      articles={ADMIN_DOCS.map((d) => d.meta)}
    />
  )
}
