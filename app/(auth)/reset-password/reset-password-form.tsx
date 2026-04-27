'use client'

import { useActionState } from 'react'
import { updatePasswordAction } from '@/lib/auth/actions'
import { Button } from '@/components/ui/button'

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(updatePasswordAction, undefined)

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

      <Field label="New password" htmlFor="password" error={state?.errors?.password?.[0]}>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="At least 8 characters"
          className={inputCls}
        />
      </Field>

      <Field label="Confirm new password" htmlFor="confirm" error={state?.errors?.confirm?.[0]}>
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="Repeat password"
          className={inputCls}
        />
      </Field>

      <Button type="submit" disabled={pending} className="w-full" size="lg">
        {pending ? 'Updating…' : 'Set new password'}
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
