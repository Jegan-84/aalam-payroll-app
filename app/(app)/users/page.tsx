import Link from 'next/link'
import { listUsers } from '@/lib/users/queries'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ButtonLink } from '@/components/ui/button'
import { Pagination } from '@/components/ui/pagination'

export const metadata = { title: 'Users' }

type SP = Promise<{ page?: string }>

export default async function UsersListPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams
  const pageNum = sp.page ? Number(sp.page) : 1
  const { rows, total, page, totalPages } = await listUsers({ page: pageNum })
  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        subtitle={`${total} total · admin-only`}
        actions={<ButtonLink href="/users/new" variant="primary">+ New user</ButtonLink>}
      />

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
              <tr>
                <Th>Email</Th>
                <Th>Name</Th>
                <Th>Roles</Th>
                <Th>Status</Th>
                <Th>Created</Th>
                <Th>{' '}</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {rows.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-500">No users yet.</td></tr>
              )}
              {rows.map((u) => (
                <tr key={u.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-950">
                  <Td>
                    <Link href={`/users/${u.id}`} className="font-medium text-slate-900 hover:text-brand-700 hover:underline dark:text-slate-100">
                      {u.email}
                    </Link>
                  </Td>
                  <Td>{u.full_name ?? '—'}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {u.roles.length === 0 && <span className="text-xs text-slate-400">none</span>}
                      {u.roles.map((r) => <Badge key={r.code} tone="brand">{r.code}</Badge>)}
                    </div>
                  </Td>
                  <Td><Badge tone={u.is_active ? 'success' : 'neutral'}>{u.is_active ? 'active' : 'inactive'}</Badge></Td>
                  <Td className="text-xs text-slate-500">{new Date(u.created_at).toLocaleDateString('en-IN')}</Td>
                  <Td><Link href={`/users/${u.id}`} className="text-xs font-medium text-brand-700 hover:underline">Edit →</Link></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        basePath="/users"
        searchParams={sp}
        noun={{ singular: 'user', plural: 'users' }}
      />
    </div>
  )
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 ${className}`}>{children}</th>
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-slate-900 dark:text-slate-100 ${className}`}>{children}</td>
}
