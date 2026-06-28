import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { randomUUID } from 'crypto'

/**
 * GET /api/auth/google/callback — Handle Google OAuth callback
 *
 * Google redirects here with ?code=...&state=...
 * We exchange the code for tokens, get user info, and create a session.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams, origin } = request.nextUrl
    const code = searchParams.get('code')
    const stateParam = searchParams.get('state')
    const error = searchParams.get('error')

    // Handle Google-side errors (user denied consent, etc.)
    if (error) {
      return redirectToHome(`?error=google_${error}`)
    }

    if (!code || !stateParam) {
      return redirectToHome('?error=google_missing_params')
    }

    // Verify state
    let stateData: { state: string; redirect: string }
    try {
      stateData = JSON.parse(atob(stateParam))
    } catch {
      return redirectToHome('?error=google_invalid_state')
    }

    const cookieState = request.cookies.get('sb_oauth_state')?.value
    if (!cookieState || cookieState !== stateData.state) {
      return redirectToHome('?error=google_state_mismatch')
    }

    // Read config
    const [clientIdCfg, clientSecretCfg] = await Promise.all([
      db.systemConfig.findUnique({ where: { key: 'auth.google.clientId' } }),
      db.systemConfig.findUnique({ where: { key: 'auth.google.clientSecret' } }),
    ])

    const clientId = clientIdCfg?.value
    const clientSecret = clientSecretCfg?.value

    if (!clientId || !clientSecret) {
      return redirectToHome('?error=google_not_configured')
    }

    const redirectUri = `${origin}/api/auth/google/callback`

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenRes.ok) {
      console.error('[Google OAuth] Token exchange failed:', await tokenRes.text())
      return redirectToHome('?error=google_token_exchange_failed')
    }

    const tokens = await tokenRes.json()

    // Get user info from Google
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })

    if (!userInfoRes.ok) {
      console.error('[Google OAuth] Userinfo fetch failed:', await userInfoRes.text())
      return redirectToHome('?error=google_userinfo_failed')
    }

    const userInfo = await userInfoRes.json()
    // userInfo: { sub, email, email_verified, name, picture, given_name, family_name }

    if (!userInfo.email) {
      return redirectToHome('?error=google_no_email')
    }

    // Find or create user
    let user = await db.user.findUnique({
      where: { email: userInfo.email },
      include: { oauthProviders: true },
    })

    if (!user) {
      // Create new user (OAuth users are regular users, not admin)
      user = await db.user.create({
        data: {
          email: userInfo.email,
          name: userInfo.name || userInfo.given_name || null,
          avatarUrl: userInfo.picture || null,
          role: 'user',
          isActive: true,
          mustChangePassword: false,
          passwordHash: null,
          oauthProviders: {
            create: {
              provider: 'google',
              providerId: userInfo.sub,
              accessToken: tokens.access_token || null,
              refreshToken: tokens.refresh_token || null,
            },
          },
        },
        include: { oauthProviders: true },
      })
    } else {
      // User exists — check if Google provider is linked
      const googleProvider = user.oauthProviders.find(p => p.provider === 'google')
      if (!googleProvider) {
        // Link Google account to existing user
        await db.oAuthProvider.create({
          data: {
            userId: user.id,
            provider: 'google',
            providerId: userInfo.sub,
            accessToken: tokens.access_token || null,
            refreshToken: tokens.refresh_token || null,
          },
        })
      } else {
        // Update tokens
        await db.oAuthProvider.update({
          where: { id: googleProvider.id },
          data: {
            providerId: userInfo.sub,
            accessToken: tokens.access_token || null,
            refreshToken: tokens.refresh_token || null,
          },
        })
      }

      // Update avatar and name if changed
      await db.user.update({
        where: { id: user.id },
        data: {
          name: user.name || userInfo.name || null,
          avatarUrl: userInfo.picture || user.avatarUrl,
          lastLoginAt: new Date(),
        },
      })
    }

    if (!user.isActive) {
      return redirectToHome('?error=account_disabled')
    }

    // Create session
    const sessionToken = randomUUID()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    await db.session.create({
      data: {
        userId: user.id,
        token: sessionToken,
        expiresAt,
      },
    })

    // Determine redirect path (sanitize to prevent open redirect)
    const redirectPath = stateData.redirect && stateData.redirect.startsWith('/')
      ? stateData.redirect
      : '/'

    const response = NextResponse.redirect(new URL(redirectPath, origin))

    // Set auth cookie
    response.cookies.set('sb_auth_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    })

    // Clear OAuth state cookie
    response.cookies.delete('sb_oauth_state')

    return response
  } catch (err) {
    console.error('[Google OAuth] Callback error:', err)
    return redirectToHome('?error=google_auth_failed')
  }
}

function redirectToHome(search = ''): NextResponse {
  const url = new URL('/' + search, 'http://localhost:3000')
  // Use a relative redirect
  return NextResponse.redirect(url.pathname + url.search, {
    status: 302,
  })
}
