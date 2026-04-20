import Image from 'next/image'
import { LoginForm } from './login-form'

export const metadata = { title: 'Sign in — PayFlow' }

export default function LoginPage() {
  return (
    <div className="w-full max-w-md">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/90 shadow-xl backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/90">
        <div className="flex flex-col items-center px-8 pb-4 pt-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 ring-1 ring-inset ring-brand-200 dark:bg-brand-950/40 dark:ring-brand-900">
            <Image src="/aalamLogo.png" alt="Aalam" width={44} height={44} className="h-11 w-11 object-contain" priority />
          </div>
          <h1 className="mt-4 text-[22px] font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Welcome to PayFlow
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Aalam&apos;s in-house payroll console. Sign in to continue.
          </p>
        </div>
        <div className="px-8 pb-8 pt-2">
          <LoginForm />
        </div>
      </div>
      <p className="mt-4 text-center text-[11px] text-slate-500 dark:text-slate-400">
        © {new Date().getFullYear()} Aalam Info Solutions. All rights reserved.
      </p>
    </div>
  )
}
