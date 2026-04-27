'use client'

import { useActionState } from 'react'
import { requestPasswordResetAction } from '@/lib/auth/actions'
import { Button } from '@/components/ui/button'

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordResetAction, undefined)

  if (state?.sent) {
    return (
      <div
        role="status"
        className="rounded-md border border-green-200 bg-green-50 px-3 py-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-200"
      >
        If that email exists, a reset link is on its way. Check your inbox (and spam folder) — the link is valid for 1 hour.
      </div>
    )
  }

  return (
    <form action={action} className="space-y-4">
      {state?.errors?._form && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          {state.errors._form[0]}
        </div>
      )}

      <Field label="Email" htmlFor="email" error={state?.errors?.email?.[0]}>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@aalam.com"
          className={inputCls}
        />
      </Field>

      <Button type="submit" disabled={pending} className="w-full" size="lg">
        {pending ? 'Sending…' : 'Send reset link'}
      </Button>
    </form>
  )
}

const inputCls =
  'block h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition ' +
  'placeholder:text-slate-400 ' +
  'focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 ' +
  'dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 ' +
  'dark:focus:border-brand-400 dark:focus:ring-brand-400/20'

function Field({
  label, htmlFor, error, children,
}: { label: string; htmlFor: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-xs font-medium text-slate-700 dark:text-slate-300">{label}</label>
      {children}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}
