'use client'

import * as React from 'react'

export type SnackbarKind = 'success' | 'error' | 'info' | 'warn'

export type SnackbarAction = { label: string; onClick: () => void }

type ShowArgs = {
  message: string
  kind?: SnackbarKind
  duration?: number
  action?: SnackbarAction
}
type Toast = Required<Omit<ShowArgs, 'action'>> & { id: number; action?: SnackbarAction }

type Ctx = { show: (args: ShowArgs) => void }
const SnackbarCtx = React.createContext<Ctx | null>(null)

export function useSnackbar(): Ctx {
  const ctx = React.useContext(SnackbarCtx)
  if (!ctx) {
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
      action: args.action,
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
      {/* Toaster — fixed bottom-right, stacks newest at the bottom */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex max-w-[420px] flex-col gap-2.5">
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </SnackbarCtx.Provider>
  )
}

const KIND_STYLE: Record<SnackbarKind, { iconBg: string; actionFg: string }> = {
  success: { iconBg: 'bg-emerald-600', actionFg: 'text-emerald-700 dark:text-emerald-400' },
  error:   { iconBg: 'bg-red-600',     actionFg: 'text-red-700 dark:text-red-400' },
  info:    { iconBg: 'bg-slate-500',   actionFg: 'text-brand-700 dark:text-brand-400' },
  warn:    { iconBg: 'bg-amber-500',   actionFg: 'text-brand-700 dark:text-brand-400' },
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const style = KIND_STYLE[toast.kind]
  return (
    <div
      role="status"
      className="pointer-events-auto flex min-w-[280px] overflow-hidden rounded-md bg-white shadow-lg ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
    >
      {/* Solid colored icon column */}
      <div className={`flex w-12 shrink-0 items-center justify-center ${style.iconBg}`}>
        <KindIcon kind={toast.kind} />
      </div>

      {/* Content */}
      <div className="flex flex-1 items-center gap-3 px-4 py-3">
        <div className="flex-1 text-sm leading-snug text-slate-800 dark:text-slate-100">
          {toast.message}
        </div>
        {toast.action && (
          <button
            type="button"
            onClick={() => {
              toast.action!.onClick()
              onDismiss()
            }}
            className={`shrink-0 text-sm font-medium hover:underline ${style.actionFg}`}
          >
            {toast.action.label}
          </button>
        )}
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 text-slate-400 transition-colors hover:text-slate-700 dark:hover:text-slate-200"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 6 18 18M18 6 6 18" />
          </svg>
        </button>
      </div>
    </div>
  )
}

function KindIcon({ kind }: { kind: SnackbarKind }) {
  const props = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'white',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  switch (kind) {
    case 'success':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="10" />
          <path d="m8 12 3 3 5-6" />
        </svg>
      )
    case 'error':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="10" />
          <path d="M9 9 15 15M15 9 9 15" />
        </svg>
      )
    case 'warn':
      return (
        <svg {...props}>
          <path d="M12 3 22 20H2Z" />
          <path d="M12 10v5" />
          <path d="M12 18h.01" />
        </svg>
      )
    case 'info':
    default:
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8h.01" />
          <path d="M12 12v4" />
        </svg>
      )
  }
}
