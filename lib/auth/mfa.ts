import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

export type MfaStatus = {
  currentLevel: 'aal1' | 'aal2'
  nextLevel: 'aal1' | 'aal2'
  needsChallenge: boolean  // user has verified factors but session is still aal1
  hasAnyFactor: boolean
  hasVerifiedFactor: boolean
}

export const getMfaStatus = cache(async (): Promise<MfaStatus> => {
  const supabase = await createClient()
  const [{ data: aal }, { data: factors }] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors(),
  ])
  const current = (aal?.currentLevel as 'aal1' | 'aal2') ?? 'aal1'
  const next = (aal?.nextLevel as 'aal1' | 'aal2') ?? 'aal1'
  const totp = factors?.totp ?? []
  return {
    currentLevel: current,
    nextLevel: next,
    needsChallenge: next === 'aal2' && current !== 'aal2',
    hasAnyFactor: totp.length > 0,
    hasVerifiedFactor: totp.some((f) => f.status === 'verified'),
  }
})

export const listTotpFactors = cache(async () => {
  const supabase = await createClient()
  const { data } = await supabase.auth.mfa.listFactors()
  return data?.totp ?? []
})
