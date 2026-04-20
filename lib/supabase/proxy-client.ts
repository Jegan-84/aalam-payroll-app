import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

const MFA_CHALLENGE_PATH = '/login/mfa'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isLoginPage = path === '/login'
  const isMfaChallenge = path === MFA_CHALLENGE_PATH
  const isPublic = isLoginPage || path === '/'

  // Not signed in at all
  if (!user && !isPublic && !isMfaChallenge) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (!user && isMfaChallenge) {
    // No session but someone tried /login/mfa → bounce to /login
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user) {
    // Check if a 2FA step is pending before letting them past /login
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    const needsMfa = aal?.nextLevel === 'aal2' && aal.currentLevel !== 'aal2'

    if (needsMfa) {
      // While AAL1 + factors exist, only the MFA challenge page is reachable
      if (!isMfaChallenge) {
        const url = request.nextUrl.clone()
        url.pathname = MFA_CHALLENGE_PATH
        return NextResponse.redirect(url)
      }
      // Already on /login/mfa → allow
      return response
    }

    // No MFA pending. If they landed on /login or /login/mfa, send them home.
    if (isLoginPage || isMfaChallenge) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  return response
}
