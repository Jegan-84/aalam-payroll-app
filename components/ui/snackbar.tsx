'use client'

import * as React from 'react'

export type SnackbarKind = 'success' | 'error' | 'info' | 'warn'

type ShowArgs = { message: string; kind?: SnackbarKind; duration?: number }
type Toast = Required<ShowArgs> & { id: number }

type Ctx = { show: (args: ShowArgs) => void }
const SnackbarCtx = React.createContext<Ctx | null>(null)

export function useSnackbar(): Ctx {
  const ctx = React.useContext(SnackbarCtx)
  if (!ctx) {
    // Graceful fallback — allows components to call show() safely even if the provider isn't mounted.
    return {
      show: (args) => {
        if (typeof window !== 'undefined') console.info('[snackbar]', args.kind ?? 'info', args.message)
      },
    }
  }
  return ctx
}

export function SnackbarProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([])
  const idRef = React.useRef(0)

  const show = React.useCallback((args: ShowArgs) => {
    const id = ++idRef.current
    const t: Toast = {
      id,
      message: args.message,
      kind: args.kind ?? 'info',
      duration: args.duration ?? 4500,
    }
    setToasts((prev) => [...prev, t])
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id))
    }, t.duration)
  }, [])

  const dismiss = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id))

  const ctx = React.useMemo<Ctx>(() => ({ show }), [show])

  return (
    <SnackbarCtx.Provider value={ctx}>
      {children}
      {/* Toaster */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex max-w-[380px] flex-col gap-2">
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </SnackbarCtx.Provider>
  )
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const styles: Record<SnackbarKind, string> = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-200',
    error:   'border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/70 dark:text-red-200',
    info:    'border-slate-200 bg-white text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100',
    warn:    'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/70 dark:text-amber-200',
  }
  const icons: Record<SnackbarKind, string> = {
    success: '✓',
    error: '⨯',
    info: 'ℹ',
    warn: '!',
  }
  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-start gap-3 rounded-lg border px-3.5 py-3 text-sm shadow-lg ${styles[toast.kind]}`}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/70 text-xs font-bold dark:bg-black/20">
        {icons[toast.kind]}
      </span>
      <div className="flex-1 leading-snug">{toast.message}</div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="shrink-0 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
      >
        ×
      </button>
    </div>
  )
}
