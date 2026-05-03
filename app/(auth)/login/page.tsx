import Image from 'next/image'
import Link from 'next/link'
import { LoginForm } from './login-form'

export const metadata = { title: 'Sign in — PeopleStack' }

type SP = Promise<{ reset?: string }>

export default async function LoginPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams
  const justReset = sp.reset === '1'

  return (
    <div className="w-full max-w-md">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/90 shadow-xl backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/90">
        <div className="flex flex-col items-center px-8 pb-4 pt-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 ring-1 ring-inset ring-brand-200 dark:bg-brand-950/40 dark:ring-brand-900">
            <Image src="/aalamLogo.png" alt="Aalam" width={44} height={44} className="h-11 w-11 object-contain" priority />
          </div>
          <h1 className="mt-4 text-[22px] font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Welcome to PeopleStack
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Aalam&apos;s in-house payroll console. Sign in to continue.
          </p>
        </div>
        <div className="px-8 pb-8 pt-2">
          {justReset && (
            <div
              role="status"
              className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-200"
            >
              Password updated. Sign in with your new password.
            </div>
          )}
          <LoginForm />
          <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
            <Link href="/forgot-password" className="font-medium text-brand-700 hover:underline dark:text-brand-400">
              Forgot your password?
            </Link>
          </p>
        </div>
      </div>
      <p className="mt-4 text-center text-[11px] text-slate-500 dark:text-slate-400">
        © {new Date().getFullYear()} Aalam Info Solutions. All rights reserved.
      </p>
    </div>
  )
}
