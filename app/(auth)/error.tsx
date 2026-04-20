'use client'

export default function AuthError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="w-full max-w-sm rounded-xl border border-red-200 bg-white p-6 shadow-sm dark:border-red-900 dark:bg-slate-900">
      <h1 className="text-base font-semibold text-red-800 dark:text-red-300">Sign-in unavailable</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        We couldn&apos;t reach the auth service. Check your Supabase env vars and try again.
      </p>
      {error.digest && (
        <p className="mt-2 text-xs text-slate-500">Error id: {error.digest}</p>
      )}
      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-slate-500">Technical details</summary>
        <pre className="mt-2 whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
{error.message}
        </pre>
      </details>
      <button
        onClick={reset}
        className="mt-4 inline-flex h-9 items-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
      >
        Try again
      </button>
    </div>
  )
}
