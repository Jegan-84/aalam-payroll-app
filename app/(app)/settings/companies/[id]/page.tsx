import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCompany } from '@/lib/companies/queries'
import { CompanyForm } from '../_components/company-form'

type PP = Promise<{ id: string }>

export const metadata = { title: 'Edit company' }

export default async function EditCompanyPage({ params }: { params: PP }) {
  const { id } = await params
  const c = await getCompany(id)
  if (!c) notFound()
  return (
    <div className="space-y-5">
      <div>
        <Link href="/settings/companies" className="text-sm text-slate-500 hover:underline">← Companies</Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
          {c.legal_name} <span className="text-base font-normal text-slate-500">({c.code})</span>
        </h1>
      </div>
      <CompanyForm mode="edit" defaults={c as Record<string, string | number | boolean | null>} />
    </div>
  )
}
