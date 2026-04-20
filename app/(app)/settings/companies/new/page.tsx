import Link from 'next/link'
import { CompanyForm } from '../_components/company-form'

export const metadata = { title: 'New company' }

export default function NewCompanyPage() {
  return (
    <div className="space-y-5">
      <div>
        <Link href="/settings/companies" className="text-sm text-slate-500 hover:underline">← Companies</Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">New company</h1>
      </div>
      <CompanyForm mode="create" defaults={{ is_active: true, country: 'India', display_order: 100 }} />
    </div>
  )
}
