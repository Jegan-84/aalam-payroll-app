import Link from 'next/link'

type SearchParams = Record<string, string | string[] | undefined>

type Props = {
  page: number
  totalPages: number
  basePath: string
  /** Current searchParams — all non-`page` keys are preserved on Prev/Next links. */
  searchParams: SearchParams
  /** Total rows across all pages (for the "Page X of Y · N total" readout). */
  total: number
  /** Noun for the total readout. Defaults to "row" / "rows". */
  noun?: { singular: string; plural: string }
}

export function Pagination({ page, totalPages, basePath, searchParams, total, noun }: Props) {
  if (totalPages <= 1 && total <= 0) return null
  const n = noun ?? { singular: 'row', plural: 'rows' }

  const href = (p: number) => {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(searchParams)) {
      if (k === 'page' || v == null) continue
      if (Array.isArray(v)) v.forEach((vv) => params.append(k, vv))
      else params.set(k, v)
    }
    params.set('page', String(p))
    return `${basePath}?${params.toString()}`
  }

  return (
    <div className="flex items-center justify-between text-sm">
      <div className="text-slate-500">
        {totalPages > 1 ? `Page ${page} of ${totalPages} · ` : ''}
        {total} {total === 1 ? n.singular : n.plural}
      </div>
      {totalPages > 1 && (
        <div className="flex gap-2">
          {page > 1 ? (
            <Link
              href={href(page - 1)}
              className="rounded-md border border-slate-300 bg-white px-3 py-1 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
            >
              Prev
            </Link>
          ) : (
            <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1 text-slate-400 dark:border-slate-800 dark:bg-slate-900/50">
              Prev
            </span>
          )}
          {page < totalPages ? (
            <Link
              href={href(page + 1)}
              className="rounded-md border border-slate-300 bg-white px-3 py-1 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
            >
              Next
            </Link>
          ) : (
            <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1 text-slate-400 dark:border-slate-800 dark:bg-slate-900/50">
              Next
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export function computePagination(total: number, page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const clamped = Math.min(Math.max(1, page), totalPages)
  const from = (clamped - 1) * pageSize
  const to = from + pageSize - 1
  return { page: clamped, totalPages, from, to, pageSize }
}
