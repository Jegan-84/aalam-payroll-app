import { notFound } from 'next/navigation'
import { getCurrentEmployee } from '@/lib/auth/dal'
import { getEmployee } from '@/lib/employees/queries'
import { listEmployeeDocuments, signEmployeeFileUrl } from '@/lib/employees/self-service'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { DocumentsClient } from './_components/documents-client'

export const metadata = { title: 'My Documents' }

export default async function MyDocumentsPage() {
  const { employeeId } = await getCurrentEmployee()
  const [emp, docs] = await Promise.all([
    getEmployee(employeeId),
    listEmployeeDocuments(employeeId),
  ])
  if (!emp) notFound()

  const editable = Boolean((emp as Record<string, unknown>).profile_edit_enabled)

  // Filter out the photo entry — that's surfaced on the main profile page.
  const docsExcludingPhoto = docs

  // Pre-sign download URLs (server-side) so the client only sees short-lived links.
  const signed = await Promise.all(
    docsExcludingPhoto.map(async (d) => ({
      ...d,
      signed_url: await signEmployeeFileUrl(d.storage_path, 60 * 5),
    })),
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="My documents"
        back={{ href: '/me/profile', label: 'Profile' }}
        subtitle={
          editable
            ? 'Upload Aadhaar, PAN, education and experience documents. PDF only, max 5 MB each.'
            : 'Document uploads are locked. Ask HR to enable editing.'
        }
      />

      {!editable && (
        <Card>
          <CardHeader><CardTitle>Editing locked</CardTitle></CardHeader>
          <CardBody>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              You can view your already-uploaded documents below, but new uploads are disabled until HR
              enables profile editing for your account.
            </p>
          </CardBody>
        </Card>
      )}

      <DocumentsClient docs={signed} editable={editable} />
    </div>
  )
}
