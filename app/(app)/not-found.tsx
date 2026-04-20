import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-50">404</h1>
      <p className="mt-1 max-w-md text-sm text-slate-600 dark:text-slate-400">
        The page or record you&apos;re looking for doesn&apos;t exist.
      </p>
      <Link
        href="/dashboard"
        className="mt-5 inline-flex h-9 items-center rounded-md border border-slate-300 px-4 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
      >
        Go to dashboard
      </Link>
    </div>
  )
}
