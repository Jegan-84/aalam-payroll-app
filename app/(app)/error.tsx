'use client'

import { useEffect } from 'react'

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[PayFlow] Unhandled error:', error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300">
        !
      </div>
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Something went wrong</h1>
      <p className="mt-1 max-w-md text-sm text-slate-600 dark:text-slate-400">
        The page couldn&apos;t load. Try again, or check the console for details.
      </p>
      {error.digest && (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-500">Error id: {error.digest}</p>
      )}
      <details className="mt-4 max-w-xl text-left">
        <summary className="cursor-pointer text-xs text-slate-500 dark:text-slate-400">
          Technical details
        </summary>
        <pre className="mt-2 overflow-x-auto rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
{error.message}
        </pre>
      </details>
      <div className="mt-5 flex gap-2">
        <button
          onClick={reset}
          className="inline-flex h-9 items-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
        >
          Try again
        </button>
        <a
          href="/dashboard"
          className="inline-flex h-9 items-center rounded-md border border-slate-300 px-4 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Go to dashboard
        </a>
      </div>
    </div>
  )
}
