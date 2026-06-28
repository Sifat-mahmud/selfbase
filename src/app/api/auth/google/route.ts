import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { randomUUID } from 'crypto'

/**
 * GET /api/auth/google — Initiate Google OAuth flow
 *
 * Redirects the user to Google's consent screen. After authentication,
 * Google redirects back to /api/auth/google/callback.
 *
 * Query params:
 *   redirect — optional path to return to after login (default: /)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams, origin } = request.nextUrl
    const redirectPath = searchParams.get('redirect') || '/'

    // Read Google OAuth config from SystemConfig
    const [enabledCfg, clientIdCfg] = await Promise.all([
      db.systemConfig.findUnique({ where: { key: 'auth.google.enabled' } }),
      db.systemConfig.findUnique({ where: { key: 'auth.google.clientId' } }),
    ])

    const enabled = enabledCfg?.value === 'true'
    const clientId = clientIdCfg?.value

    if (!enabled || !clientId) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      url.search = '?error=google_not_configured'
      return NextResponse.redirect(url)
    }

    const redirectUri = `${origin}/api/auth/google/callback`
    const state = randomUUID()
    const stateParam = btoa(JSON.stringify({ state, redirect: redirectPath }))

    const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    googleAuthUrl.searchParams.set('client_id', clientId)
    googleAuthUrl.searchParams.set('redirect_uri', redirectUri)
    googleAuthUrl.searchParams.set('response_type', 'code')
    googleAuthUrl.searchParams.set('scope', 'openid email profile')
    googleAuthUrl.searchParams.set('state', stateParam)
    googleAuthUrl.searchParams.set('prompt', 'select_account')
    googleAuthUrl.searchParams.set('access_type', 'offline')

    const response = NextResponse.redirect(googleAuthUrl)
    response.cookies.set('sb_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    })

    return response
  } catch (err) {
    console.error('[Google OAuth] Init error:', err)
    const url = request.nextUrl.clone()
    url.pathname = '/'
    url.search = '?error=google_auth_failed'
    return NextResponse.redirect(url)
  }
}
