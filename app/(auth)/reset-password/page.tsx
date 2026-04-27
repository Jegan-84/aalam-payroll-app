import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ResetPasswordForm } from './reset-password-form'

export const metadata = { title: 'Reset password — PayFlow' }

type SP = Promise<{
  code?: string
  error?: string
  error_code?: string
  error_description?: string
}>

export default async function ResetPasswordPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams

  // Supabase hands us a `?code=…` from the reset email. Exchange it server-side
  // so the user has a (short-lived) recovery session — required for updateUser().
  let exchangeError: string | null = null
  if (sp.code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(sp.code)
    if (error) exchangeError = error.message
  }

  // Either we hit the page with no code at all, or the code was invalid/expired.
  // Either way we need a fresh session to call updateUser. Verify here so we
  // can render the right UI.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const sessionReady = Boolean(user)

  const errorMessage = sp.error_description ?? sp.error ?? exchangeError

  return (
    <div className="w-full max-w-md">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/90 shadow-xl backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/90">
        <div className="flex flex-col items-center px-8 pb-4 pt-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 ring-1 ring-inset ring-brand-200 dark:bg-brand-950/40 dark:ring-brand-900">
            <Image src="/aalamLogo.png" alt="Aalam" width={44} height={44} className="h-11 w-11 object-contain" priority />
          </div>
          <h1 className="mt-4 text-[22px] font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Reset your password
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {sessionReady
              ? `Signed in as ${user!.email}. Pick a new password below.`
              : 'The link is invalid or has expired. Request a fresh one.'}
          </p>
        </div>
        <div className="px-8 pb-8 pt-2">
          {sessionReady ? (
            <ResetPasswordForm />
          ) : (
            <div className="space-y-4">
              {errorMessage && (
                <div
                  role="alert"
                  className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                >
                  {errorMessage}
                </div>
              )}
              <Link
                href="/forgot-password"
                className="inline-flex h-10 w-full items-center justify-center rounded-md bg-brand-600 text-sm font-medium text-white shadow-sm hover:bg-brand-700 active:bg-brand-800"
              >
                Request a new link
              </Link>
            </div>
          )}
          <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
            <Link href="/login" className="font-medium text-brand-700 hover:underline dark:text-brand-400">
              ← Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
