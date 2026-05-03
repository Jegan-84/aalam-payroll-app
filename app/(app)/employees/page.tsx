import Link from 'next/link'
import { listEmployees, getMasterOptions } from '@/lib/employees/queries'
import { PageHeader } from '@/components/ui/page-header'
import { ButtonLink } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmployeeBulkUpload } from './_components/employee-bulk-upload'
import { EmployeesBulkTable } from './_components/employees-bulk-table'

export const metadata = { title: 'Employees' }

type SP = Promise<{ q?: string; department_id?: string; status?: string; page?: string }>

export default async function EmployeesListPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams
  const filters = {
    q: sp.q,
    department_id: sp.department_id ? Number(sp.department_id) : undefined,
    status: sp.status,
    page: sp.page ? Number(sp.page) : 1,
    pageSize: 25,
  }
  const [{ rows, total, page, totalPages }, masters] = await Promise.all([
    listEmployees(filters),
    getMasterOptions(),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employees"
        subtitle={`${total} ${total === 1 ? 'employee' : 'employees'} on the roll`}
        actions={
          <>
            <EmployeeBulkUpload />
            <ButtonLink href="/employees/new" variant="primary">+ New employee</ButtonLink>
          </>
        }
      />

      <Card className="p-3">
        <form className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col">
            <label className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">Search</label>
            <input
              name="q"
              defaultValue={sp.q ?? ''}
              placeholder="Name, code, or email"
              className={inputCls + ' w-72'}
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">Department</label>
            <select name="department_id" defaultValue={sp.department_id ?? ''} className={selectCls}>
              <option value="">All</option>
              {masters.departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">Status</label>
            <select name="status" defaultValue={sp.status ?? ''} className={selectCls}>
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="on_notice">On notice</option>
              <option value="resigned">Resigned</option>
              <option value="terminated">Terminated</option>
              <option value="exited">Exited</option>
              <option value="on_hold">On hold</option>
            </select>
          </div>
          <button className="h-9 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800">
            Apply
          </button>
        </form>
      </Card>

      <EmployeesBulkTable rows={rows} />

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <div className="text-slate-500">Page {page} of {totalPages}</div>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={buildPageHref(sp, page - 1)} className="rounded-md border border-slate-300 bg-white px-3 py-1 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800">
                Prev
              </Link>
            )}
            {page < totalPages && (
              <Link href={buildPageHref(sp, page + 1)} className="rounded-md border border-slate-300 bg-white px-3 py-1 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800">
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const inputCls = 'h-9 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-950'
const selectCls = 'h-9 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950'

function buildPageHref(sp: Record<string, string | undefined>, page: number) {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(sp)) if (v && k !== 'page') params.set(k, v)
  params.set('page', String(page))
  return `/employees?${params.toString()}`
}
