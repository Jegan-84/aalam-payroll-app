import Image from 'next/image'
import Link from 'next/link'
import { ForgotPasswordForm } from './forgot-password-form'

export const metadata = { title: 'Forgot password — PeopleStack' }

export default function ForgotPasswordPage() {
  return (
    <div className="w-full max-w-md">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/90 shadow-xl backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/90">
        <div className="flex flex-col items-center px-8 pb-4 pt-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 ring-1 ring-inset ring-brand-200 dark:bg-brand-950/40 dark:ring-brand-900">
            <Image src="/aalamLogo.png" alt="Aalam" width={44} height={44} className="h-11 w-11 object-contain" priority />
          </div>
          <h1 className="mt-4 text-[22px] font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Forgot your password?
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Enter your email and we&apos;ll send a link to reset it.
          </p>
        </div>
        <div className="px-8 pb-8 pt-2">
          <ForgotPasswordForm />
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
