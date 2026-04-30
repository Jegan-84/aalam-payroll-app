'use client'

import { useEffect, useRef, useState } from 'react'
import { useBlockingActionState, useBlockingTransition } from '@/lib/ui/action-blocker'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useSnackbar } from '@/components/ui/snackbar'
import { useConfirm } from '@/components/ui/confirm'
import {
  enrollTotpAction,
  unenrollFactorAction,
  verifyEnrollmentAction,
  type VerifyEnrollmentState,
} from '@/lib/auth/mfa-actions'

type Factor = { id: string; friendly_name: string | null; status: string; created_at: string }

type Props = {
  factors: Factor[]
  hasVerified: boolean
}

type Enrollment = { factorId: string; qrCode: string; secret: string }

export function EnrollmentWizard({ factors, hasVerified }: Props) {
  const router = useRouter()
  const snack = useSnackbar()
  const confirm = useConfirm()
  const [enrolling, startEnroll] = useBlockingTransition()
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const [verifyState, verifyAction, verifyPending] =
    useBlockingActionState<VerifyEnrollmentState, FormData>(verifyEnrollmentAction, undefined)

  // Side-effect: when the server action succeeded, close the wizard + show toast.
  // Must be in useEffect, not during render, to avoid React's setState-in-render error.
  const handledOkRef = useRef<boolean>(false)
  useEffect(() => {
    if (verifyState?.ok && !handledOkRef.current) {
      handledOkRef.current = true
      snack.show({ kind: 'success', message: 'Two-step verification enabled.' })
      setEnrollment(null)
      router.refresh()
    }
    if (!verifyState?.ok) handledOkRef.current = false
  }, [verifyState?.ok, snack, router])

  const startEnrollment = () => {
    startEnroll(async () => {
      const res = await enrollTotpAction('Authenticator App')
      if (res.error || !res.factorId || !res.qrCode || !res.secret) {
        snack.show({ kind: 'error', message: res.error ?? 'Enrollment failed.' })
        return
      }
      handledOkRef.current = false
      setEnrollment({ factorId: res.factorId, qrCode: res.qrCode, secret: res.secret })
    })
  }

  const cancel = async () => {
    if (!enrollment) return
    const fd = new FormData()
    fd.set('factor_id', enrollment.factorId)
    await unenrollFactorAction(fd)
    setEnrollment(null)
  }

  const onRemove = async (factorId: string) => {
    if (!await confirm({
      title: 'Remove this authenticator?',
      body: 'You will lose 2FA protection on the next login.',
      confirmLabel: 'Remove',
      tone: 'danger',
    })) return
    setRemovingId(factorId)
    try {
      const fd = new FormData()
      fd.set('factor_id', factorId)
      await unenrollFactorAction(fd)
      snack.show({ kind: 'info', message: 'Authenticator removed.' })
      router.refresh()
    } finally {
      setRemovingId(null)
    }
  }

  if (enrollment) {
    return (
      <form action={verifyAction} className="space-y-5">
        <input type="hidden" name="factor_id" value={enrollment.factorId} />

        <section>
          <div className="flex items-center gap-2">
            <StepNumber n={1} />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Scan the QR code</h3>
          </div>
          <p className="mt-1 pl-8 text-xs text-slate-500 dark:text-slate-400">
            Open Google Authenticator, Authy, 1Password, or any TOTP app and scan this code.
          </p>

          <div className="mt-4 grid gap-5 pl-8 sm:grid-cols-[180px_1fr] sm:items-start">
            <div className="flex h-[180px] w-[180px] shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
              <QrImage src={enrollment.qrCode} />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500">Can&apos;t scan? Enter this secret manually:</div>
              <code className="mt-2 block break-all rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-[13px] tracking-wider text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                {formatSecret(enrollment.secret)}
              </code>
              <div className="mt-2 text-[11px] text-slate-500">
                Account name: <span className="font-medium text-slate-700 dark:text-slate-300">Aalam PayFlow</span>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2">
            <StepNumber n={2} />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Enter the 6-digit code</h3>
          </div>
          <p className="mt-1 pl-8 text-xs text-slate-500 dark:text-slate-400">
            Type the current code shown in your authenticator app to confirm.
          </p>
          <div className="mt-3 pl-8">
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
              placeholder="000000"
              className="block h-12 w-full max-w-[240px] rounded-md border border-slate-300 bg-white px-3 text-center text-xl tracking-[0.5em] tabular-nums outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              onInput={(e) => {
                const el = e.currentTarget
                el.value = el.value.replace(/\D/g, '').slice(0, 6)
              }}
            />
            {verifyState?.errors?.code && (
              <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{verifyState.errors.code[0]}</p>
            )}
            {verifyState?.errors?._form && (
              <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{verifyState.errors._form[0]}</p>
            )}
          </div>
        </section>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <Button type="button" variant="outline" onClick={cancel} disabled={verifyPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={verifyPending}>
            {verifyPending ? <><Spinner size="xs" /> Verifying…</> : 'Enable 2FA'}
          </Button>
        </div>
      </form>
    )
  }

  return (
    <div className="space-y-4">
      {factors.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          You don&apos;t have two-step verification set up yet. Add an authenticator app to require a
          6-digit code every time you sign in.
        </p>
      ) : (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Authenticators</h3>
          <ul className="mt-2 space-y-2">
            {factors.map((f) => (
              <li key={f.id} className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
                <div>
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {f.friendly_name || 'Authenticator'}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {f.status === 'verified' ? 'Active' : 'Unverified'} · added {new Date(f.created_at).toLocaleDateString('en-IN')}
                  </div>
                </div>
                <button
                  onClick={() => onRemove(f.id)}
                  disabled={removingId === f.id}
                  className="text-xs font-medium text-red-700 hover:underline disabled:opacity-50 dark:text-red-400"
                >
                  {removingId === f.id ? 'Removing…' : 'Remove'}
                </button>
              </li>
            ))}
          </ul>
          {hasVerified && (
            <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
              2FA is enabled. You&apos;ll be asked for a 6-digit code after password sign-in.
            </p>
          )}
        </div>
      )}

      <Button onClick={startEnrollment} disabled={enrolling}>
        {enrolling ? <><Spinner size="xs" /> Preparing…</> : factors.length === 0 ? 'Set up authenticator' : 'Add another authenticator'}
      </Button>
    </div>
  )
}

/** Supabase returns `qr_code` as a data URL (data:image/svg+xml;utf-8,<svg>...</svg>).
 *  Rendering it via dangerouslySetInnerHTML prints the prefix as text — use <img> instead. */
function QrImage({ src }: { src: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="Scan with your authenticator app" width={164} height={164} className="h-[164px] w-[164px]" />
}

function StepNumber({ n }: { n: number }) {
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-800 dark:bg-brand-950/60 dark:text-brand-300">
      {n}
    </span>
  )
}

/** Insert a space every 4 chars for easier manual entry. */
function formatSecret(s: string): string {
  return s.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim()
}
