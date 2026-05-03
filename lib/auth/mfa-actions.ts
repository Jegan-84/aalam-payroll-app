'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type EnrollResult = {
  ok?: true
  error?: string
  factorId?: string
  qrCode?: string    // SVG string
  secret?: string    // fallback manual entry code
}

/** Enroll a fresh TOTP factor. The user then scans the QR + calls verifyEnrollment. */
export async function enrollTotpAction(friendlyName?: string): Promise<EnrollResult> {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: friendlyName || 'Authenticator',
  })
  if (error || !data) return { error: error?.message ?? 'Enrollment failed' }
  return {
    ok: true,
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
  }
}

export type VerifyEnrollmentState = { errors?: { _form?: string[]; code?: string[] }; ok?: boolean } | undefined

/** Confirm a newly enrolled TOTP factor with the 6-digit code shown in the authenticator app. */
export async function verifyEnrollmentAction(
  _prev: VerifyEnrollmentState,
  formData: FormData,
): Promise<VerifyEnrollmentState> {
  const factorId = String(formData.get('factor_id') ?? '')
  const code = String(formData.get('code') ?? '').trim()
  if (!factorId) return { errors: { _form: ['Missing factor id.'] } }
  if (!/^\d{6}$/.test(code)) return { errors: { code: ['Enter the 6-digit code shown in your app.'] } }

  const supabase = await createClient()
  const { data: chall, error: challErr } = await supabase.auth.mfa.challenge({ factorId })
  if (challErr || !chall) return { errors: { _form: [challErr?.message ?? 'Challenge failed'] } }

  const { error: verErr } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: chall.id,
    code,
  })
  if (verErr) return { errors: { code: ['Invalid or expired code. Try again.'] } }

  revalidatePath('/mfa/setup')
  revalidatePath('/me/security')
  return { ok: true }
}

export type ChallengeState = { errors?: { _form?: string[]; code?: string[] } } | undefined

/** Step-up login: user has an already-verified factor, prove possession to reach AAL2. */
export async function challengeMfaAction(_prev: ChallengeState, formData: FormData): Promise<ChallengeState> {
  const code = String(formData.get('code') ?? '').trim()
  if (!/^\d{6}$/.test(code)) return { errors: { code: ['Enter the 6-digit code.'] } }

  const supabase = await createClient()
  const { data: factorList } = await supabase.auth.mfa.listFactors()
  const totp = (factorList?.totp ?? []).find((f) => f.status === 'verified')
  if (!totp) return { errors: { _form: ['No verified authenticator on your account. Set one up first.'] } }

  const { data: chall, error: challErr } = await supabase.auth.mfa.challenge({ factorId: totp.id })
  if (challErr || !chall) return { errors: { _form: [challErr?.message ?? 'Challenge failed'] } }

  const { error: verErr } = await supabase.auth.mfa.verify({
    factorId: totp.id,
    challengeId: chall.id,
    code,
  })
  if (verErr) return { errors: { code: ['Incorrect code. Try again.'] } }

  redirect('/dashboard')
}

/** Remove a TOTP factor (must be aal2 to do this). */
export async function unenrollFactorAction(formData: FormData): Promise<void> {
  const factorId = String(formData.get('factor_id') ?? '')
  if (!factorId) return
  const supabase = await createClient()
  await supabase.auth.mfa.unenroll({ factorId })
  revalidatePath('/mfa/setup')
  revalidatePath('/me/security')
}
