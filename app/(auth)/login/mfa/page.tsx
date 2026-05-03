import Image from 'next/image'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMfaStatus } from '@/lib/auth/mfa'
import { MfaChallengeForm } from './_components/mfa-challenge-form'

export const metadata = { title: 'Two-step verification — PeopleStack' }

export default async function MfaChallengePage() {
  // The user must already be signed in (AAL1) to see this page.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const mfa = await getMfaStatus()
  // If they're already aal2 (no challenge needed) or they have NO factors, send them home.
  if (!mfa.needsChallenge) redirect('/dashboard')

  return (
    <div className="w-full max-w-md">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/90 shadow-xl backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/90">
        <div className="flex flex-col items-center px-8 pb-4 pt-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 ring-1 ring-inset ring-brand-200 dark:bg-brand-950/40 dark:ring-brand-900">
            <Image src="/aalamLogo.png" alt="Aalam" width={44} height={44} className="h-11 w-11 object-contain" priority />
          </div>
          <h1 className="mt-4 text-[22px] font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Two-step verification
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Enter the 6-digit code from your authenticator app.
          </p>
        </div>
        <div className="px-8 pb-8 pt-2">
          <MfaChallengeForm />
        </div>
      </div>
    </div>
  )
}
