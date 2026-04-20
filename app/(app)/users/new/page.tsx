import Link from 'next/link'
import { listAllRoles } from '@/lib/users/queries'
import { NewUserForm } from '../_components/new-user-form'

export const metadata = { title: 'New user' }

export default async function NewUserPage() {
  const roles = await listAllRoles()
  return (
    <div className="space-y-5">
      <div>
        <Link href="/users" className="text-sm text-slate-500 hover:underline">← Users</Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">New user</h1>
      </div>
      <NewUserForm roles={roles} />
    </div>
  )
}
