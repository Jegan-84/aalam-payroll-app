'use client'

import * as React from 'react'

// =============================================================================
// Confirm dialog — async, promise-based replacement for window.confirm().
// =============================================================================
// Usage:
//   const confirm = useConfirm()
//
//   const ok = await confirm({
//     title: 'Delete this row?',
//     body: 'Existing payslips are unaffected.',
//     confirmLabel: 'Delete',
//     tone: 'danger',          // optional — colours the confirm button red
//   })
//   if (!ok) return
//
// In a <form action={...}> button you want to gate, do:
//   const onClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
//     e.preventDefault()
//     if (!await confirm({ body: '…' })) return
//     e.currentTarget.form?.requestSubmit(e.currentTarget)   // re-submit the form
//   }
//
// Mount <ConfirmProvider> once per app tree (already done in (app)/layout.tsx
// and (ess)/layout.tsx).
// =============================================================================

export type ConfirmTone = 'default' | 'danger'

export type ConfirmOptions = {
  title?: React.ReactNode
  body: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: ConfirmTone
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>
const ConfirmCtx = React.createContext<ConfirmFn | null>(null)

/**
 * Hook returning the async `confirm(opts)` function. If no provider is
 * mounted, falls back to native `window.confirm()` so non-instrumented call
 * sites still work — but the goal is to avoid that.
 */
export function useConfirm(): ConfirmFn {
  const ctx = React.useContext(ConfirmCtx)
  if (!ctx) {
    return async (opts) => {
      const text = `${opts.title ? `${opts.title}\n\n` : ''}${stringifyBody(opts.body)}`
      return typeof window !== 'undefined' ? window.confirm(text) : false
    }
  }
  return ctx
}

function stringifyBody(node: React.ReactNode): string {
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(stringifyBody).join('')
  return ''
}

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void }

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = React.useState<Pending | null>(null)

  const confirm = React.useCallback<ConfirmFn>((opts) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...opts, resolve })
    })
  }, [])

  const decide = (ok: boolean) => {
    if (!pending) return
    pending.resolve(ok)
    setPending(null)
  }

  // Esc to cancel, Enter to confirm.
  React.useEffect(() => {
    if (!pending) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') decide(false)
      else if (e.key === 'Enter') decide(true)
    }
    window.addEventListener('keydown', onKey)
    const { body } = document
    const prev = body.style.overflow
    body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      body.style.overflow = prev
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending])

  // Focus the confirm button when the dialog opens, for keyboard users.
  const confirmRef = React.useRef<HTMLButtonElement | null>(null)
  React.useEffect(() => {
    if (pending) confirmRef.current?.focus()
  }, [pending])

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {pending && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
        >
          <button
            type="button"
            aria-label="Cancel"
            onClick={() => decide(false)}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start gap-3 px-5 pt-5">
              <span
                aria-hidden
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                  pending.tone === 'danger'
                    ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                }`}
              >
                {pending.tone === 'danger' ? <IconWarn /> : <IconQuestion />}
              </span>
              <div className="min-w-0 flex-1">
                {pending.title && (
                  <h2 id="confirm-dialog-title" className="text-base font-semibold text-slate-900 dark:text-slate-50">
                    {pending.title}
                  </h2>
                )}
                <div className={`whitespace-pre-line text-sm text-slate-700 dark:text-slate-300 ${pending.title ? 'mt-1' : ''}`}>
                  {pending.body}
                </div>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/70 px-5 py-3 dark:border-slate-800 dark:bg-slate-950/40">
              <button
                type="button"
                onClick={() => decide(false)}
                className="inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {pending.cancelLabel ?? 'Cancel'}
              </button>
              <button
                ref={confirmRef}
                type="button"
                onClick={() => decide(true)}
                className={`inline-flex h-9 items-center rounded-md px-4 text-sm font-medium text-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${
                  pending.tone === 'danger'
                    ? 'bg-red-600 hover:bg-red-700 active:bg-red-800 focus-visible:ring-red-500'
                    : 'bg-brand-600 hover:bg-brand-700 active:bg-brand-800 focus-visible:ring-brand-500'
                }`}
              >
                {pending.confirmLabel ?? 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  )
}

const iconProps = {
  width: 20, height: 20, fill: 'none', stroke: 'currentColor', strokeWidth: 2,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, viewBox: '0 0 24 24',
}
function IconQuestion() { return <svg {...iconProps}><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg> }
function IconWarn()     { return <svg {...iconProps}><path d="M12 3 22 20H2Z"/><path d="M12 10v5"/><path d="M12 18h.01"/></svg> }
