'use client'

import { useBlockingActionState } from '@/lib/ui/action-blocker'
import { useConfirm } from '@/components/ui/confirm'
import { resetPasswordAction, updateUserAction, deleteUserAction } from '@/lib/users/actions'
import type { ResetPasswordState, UpdateUserState } from '@/lib/users/schemas'

type Role = { code: string; name: string; description: string | null }

type Props = {
  user: {
    id: string
    email: string
    full_name: string | null
    is_active: boolean
    roles: { code: string }[]
  }
  roles: Role[]
  isSelf: boolean
}

export function EditUserForm({ user, roles, isSelf }: Props) {
  const confirm = useConfirm()
  const [updState, updAction, updPending] = useBlockingActionState<UpdateUserState, FormData>(updateUserAction, undefined)
  const [pwdState, pwdAction, pwdPending] = useBlockingActionState<ResetPasswordState, FormData>(resetPasswordAction, undefined)

  const updErr = (k: string) =>
    (updState?.errors as Record<string, string[] | undefined> | undefined)?.[k]?.[0]
  const pwdErr = (k: string) =>
    (pwdState?.errors as Record<string, string[] | undefined> | undefined)?.[k]?.[0]

  const userRoleCodes = new Set(user.roles.map((r) => r.code))

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* Profile + roles */}
      <form action={updAction} className="space-y-4">
        <input type="hidden" name="id" value={user.id} />

        {updState?.errors?._form && (
          <div role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {updState.errors._form[0]}
          </div>
        )}
        {updState?.ok && (
          <div role="status" className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
            Saved.
          </div>
        )}

        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div>
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Email</label>
            <input value={user.email} readOnly className={inputCls + ' bg-slate-50 dark:bg-slate-950'} />
            <p className="mt-0.5 text-[11px] text-slate-500">Email changes require re-invitation; not editable here.</p>
          </div>

          <Field label="Full name" required error={updErr('full_name')}>
            <input name="full_name" defaultValue={user.full_name ?? ''} required className={inputCls} />
          </Field>

          <Field label="Roles" error={updErr('roles')}>
            <div className="space-y-1">
              {roles.map((r) => (
                <label key={r.code} className="flex items-start gap-2 text-sm">
                  <input type="checkbox" name="roles" value={r.code} defaultChecked={userRoleCodes.has(r.code)} disabled={isSelf && r.code === 'admin'} />
                  <span>
                    <strong className="text-slate-900 dark:text-slate-100">{r.name}</strong>
                    {r.description && <span className="ml-1 text-xs text-slate-500">— {r.description}</span>}
                    {isSelf && r.code === 'admin' && <span className="ml-1 text-[11px] text-amber-700 dark:text-amber-400">(can&apos;t remove your own admin)</span>}
                  </span>
                </label>
              ))}
            </div>
          </Field>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="is_active" defaultChecked={user.is_active} disabled={isSelf} />
            Active (sign-in enabled)
            {isSelf && <span className="text-[11px] text-amber-700 dark:text-amber-400">(can&apos;t deactivate yourself)</span>}
          </label>
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={updPending} className="inline-flex h-9 items-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200">
            {updPending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>

      {/* Password reset + delete */}
      <div className="space-y-4">
        <form action={pwdAction} className="space-y-3 rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <input type="hidden" name="id" value={user.id} />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Reset password</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Admins set a new password for the user directly. No email is sent; share it out-of-band.
          </p>

          {pwdState?.errors?._form && (
            <div role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              {pwdState.errors._form[0]}
            </div>
          )}
          {pwdState?.ok && (
            <div role="status" className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-xs text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
              Password updated.
            </div>
          )}

          <Field label="New password" required error={pwdErr('password')}>
            <input name="password" type="text" minLength={8} required className={inputCls} />
          </Field>

          <button type="submit" disabled={pwdPending} className="inline-flex h-9 items-center rounded-md border border-slate-300 px-4 text-sm font-medium hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800">
            {pwdPending ? 'Updating…' : 'Reset password'}
          </button>
        </form>

        {!isSelf && (
          <form action={deleteUserAction} className="rounded-lg border border-red-200 bg-red-50 p-5 dark:border-red-900 dark:bg-red-950/40">
            <input type="hidden" name="id" value={user.id} />
            <h3 className="text-sm font-semibold text-red-900 dark:text-red-200">Danger zone — delete user</h3>
            <p className="mt-1 text-xs text-red-800 dark:text-red-300">
              Removes sign-in access permanently. Historical audit references stay intact.
              Prefer deactivating unless you need to free the email for reuse.
            </p>
            <button
              type="submit"
              onClick={async (e) => {
                e.preventDefault()
                const button = e.currentTarget
                const ok = await confirm({
                  title: `Delete user ${user.email}?`,
                  body: 'Removes sign-in access permanently. Historical audit references stay intact. This cannot be undone.',
                  confirmLabel: 'Delete',
                  tone: 'danger',
                })
                if (ok) button.form?.requestSubmit(button)
              }}
              className="mt-3 inline-flex h-9 items-center rounded-md border border-red-400 bg-white px-4 text-sm font-medium text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300"
            >
              Delete user
            </button>
          </form>
        )}
      </div>
    </div>
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
