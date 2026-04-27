'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  LoginSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  type LoginFormState,
  type ForgotPasswordFormState,
  type ResetPasswordFormState,
} from '@/lib/auth/schemas'

export async function signInAction(
  _prev: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    return { errors: { _form: ['Invalid email or password.'] } }
  }

  redirect('/dashboard')
}

export async function signOutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

// -----------------------------------------------------------------------------
// requestPasswordReset — emails the user a recovery link.
// We always return `sent: true` so we don't leak which emails exist.
// -----------------------------------------------------------------------------
export async function requestPasswordResetAction(
  _prev: ForgotPasswordFormState,
  formData: FormData,
): Promise<ForgotPasswordFormState> {
  const parsed = ForgotPasswordSchema.safeParse({ email: formData.get('email') })
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors }

  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  const redirectTo = `${proto}://${host}/reset-password`

  const supabase = await createClient()
  // Don't surface the underlying error to the user — silent success either way.
  await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo })

  return { sent: true }
}

// -----------------------------------------------------------------------------
// updatePassword — sets a new password for the authenticated session.
// Caller should already have a recovery session (from /reset-password code exchange).
// -----------------------------------------------------------------------------
export async function updatePasswordAction(
  _prev: ResetPasswordFormState,
  formData: FormData,
): Promise<ResetPasswordFormState> {
  const parsed = ResetPasswordSchema.safeParse({
    password: formData.get('password'),
    confirm:  formData.get('confirm'),
  })
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { errors: { _form: ['Reset link expired or already used. Request a new one from /forgot-password.'] } }
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) {
    return { errors: { _form: [error.message] } }
  }

  // Sign the recovery session out so the user must log in fresh with the new password.
  await supabase.auth.signOut()
  redirect('/login?reset=1')
}
