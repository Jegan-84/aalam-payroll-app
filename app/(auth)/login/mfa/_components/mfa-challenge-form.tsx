'use client'

import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { challengeMfaAction } from '@/lib/auth/mfa-actions'
import { signOutAction } from '@/lib/auth/actions'

export function MfaChallengeForm() {
  const router = useRouter()
  const [state, action, pending] = useActionState(challengeMfaAction, undefined)

  return (
    <form action={action} className="space-y-4">
      {state?.errors?._form && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {state.errors._form[0]}
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="code" className="text-xs font-medium text-slate-700 dark:text-slate-300">
          Verification code
        </label>
        <input
          id="code"
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          autoFocus
          placeholder="123 456"
          className="block h-12 w-full rounded-md border border-slate-300 bg-white px-3 text-center text-xl tracking-[0.5em] tabular-nums outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          onInput={(e) => {
            const el = e.currentTarget
            el.value = el.value.replace(/\D/g, '').slice(0, 6)
          }}
        />
        {state?.errors?.code && <p className="text-xs text-red-600 dark:text-red-400">{state.errors.code[0]}</p>}
      </div>

      <Button type="submit" disabled={pending} className="w-full" size="lg">
        {pending ? 'Verifying…' : 'Verify & continue'}
      </Button>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <button
          type="button"
          onClick={() => router.refresh()}
          className="hover:text-slate-700 hover:underline dark:hover:text-slate-300"
        >
          Didn&apos;t get a code? Refresh.
        </button>
        <button
          type="submit"
          formAction={signOutAction}
          className="hover:text-slate-700 hover:underline dark:hover:text-slate-300"
        >
          Sign out
        </button>
      </div>
    </form>
  )
}
