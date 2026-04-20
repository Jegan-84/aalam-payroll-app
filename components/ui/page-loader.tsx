import { Spinner } from './spinner'

export function PageLoader({ message = 'Loading…' }: { message?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-white/70 backdrop-blur-sm dark:bg-slate-950/70"
    >
      <Spinner size="lg" />
      <div className="text-sm font-medium text-slate-700 dark:text-slate-300">{message}</div>
    </div>
  )
}

export function InlineLoader({ message }: { message?: string }) {
  return (
    <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
      <Spinner size="sm" />
      {message && <span>{message}</span>}
    </div>
  )
}
