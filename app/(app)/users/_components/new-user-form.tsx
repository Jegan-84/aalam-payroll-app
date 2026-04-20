'use client'

import Link from 'next/link'
import { useBlockingActionState } from '@/lib/ui/action-blocker'
import { createUserAction } from '@/lib/users/actions'
import type { CreateUserState } from '@/lib/users/schemas'

type Role = { code: string; name: string; description: string | null }

export function NewUserForm({ roles }: { roles: Role[] }) {
  const [state, action, pending] = useBlockingActionState<CreateUserState, FormData>(createUserAction, undefined)
  const err = (k: string) =>
    (state?.errors as Record<string, string[] | undefined> | undefined)?.[k]?.[0]

  return (
    <form action={action} className="max-w-xl space-y-4">
      {state?.errors?._form && (
        <div role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {state.errors._form[0]}
        </div>
      )}

      <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <Field label="Email" required error={err('email')}>
          <input name="email" type="email" required className={inputCls} />
        </Field>
        <Field label="Full name" required error={err('full_name')}>
          <input name="full_name" required className={inputCls} />
        </Field>
        <Field label="Initial password" required error={err('password')}>
          <input name="password" type="text" required minLength={8} className={inputCls} />
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Min 8 chars. Share this out-of-band; the user should change it after first sign-in.
          </p>
        </Field>
        <Field label="Roles" error={err('roles')}>
          <div className="space-y-1">
            {roles.map((r) => (
              <label key={r.code} className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="roles" value={r.code} defaultChecked={r.code === 'employee'} />
                <span>
                  <strong className="text-slate-900 dark:text-slate-100">{r.name}</strong>
                  {r.description && <span className="ml-1 text-xs text-slate-500">— {r.description}</span>}
                </span>
              </label>
            ))}
          </div>
        </Field>
      </div>

      <div className="flex justify-end gap-2">
        <Link href="/users" className="inline-flex h-9 items-center rounded-md border border-slate-300 px-4 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
          Cancel
        </Link>
        <button type="submit" disabled={pending} className="inline-flex h-9 items-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200">
          {pending ? 'Creating…' : 'Create user'}
        </button>
      </div>
    </form>
  )
}

const inputCls = 'block h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:focus:border-slate-100 dark:focus:ring-slate-100'

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
        {label}{required && <span className="text-red-600"> *</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}
