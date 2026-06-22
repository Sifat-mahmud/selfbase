import { NextRequest, NextResponse } from 'next/server'

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  '/api/auth/login',
  '/api/auth/setup',
  '/api/v1/auth/login',
]

// Routes that are accessible with any valid auth (admin session OR app token)
const AUTH_REQUIRED_ROUTES_PREFIX = '/api/'

// Routes only for admin sessions (not app tokens)
const ADMIN_ONLY_ROUTES = [
  '/api/auth/',
  '/api/api-keys/',
  '/api/config',
  '/api/export/',
  '/api/import/',
  '/api/auth/users',
  '/api/auth/sessions',
  '/api/auth/change-password',
  '/api/auth/logout',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Only process /api/* routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Allow internal scheduler service via x-scheduler-secret header
  const schedulerSecret = request.headers.get('x-scheduler-secret')
  const internalSecret = process.env.SCHEDULER_SECRET || 'scheduler-internal-secret'
  if (schedulerSecret && schedulerSecret === internalSecret) {
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-auth-method', 'internal-scheduler')
    requestHeaders.set('x-user-role', 'admin')
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  // Allow public routes without auth
  if (PUBLIC_ROUTES.some(route => pathname === route)) {
    return NextResponse.next()
  }

  // Check for Authorization header
  const authHeader = request.headers.get('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // For self-hosted platform, pass through but mark as unauthenticated
    // The route handlers themselves check auth when needed
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-auth-method', 'none')
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  const token = authHeader.replace('Bearer ', '')

  // Determine auth method based on token format
  const requestHeaders = new Headers(request.headers)

  if (token.startsWith('sb_live_')) {
    // API key - only valid for /api/v1/auth/login
    if (pathname === '/api/v1/auth/login') {
      requestHeaders.set('x-auth-method', 'api-key')
    } else {
      // API keys can't be used directly - must login first
      requestHeaders.set('x-auth-method', 'none')
    }
  } else {
    // Either admin session token or app token - pass through
    // Route handlers will validate using auth-utils or app-auth
    requestHeaders.set('x-auth-method', 'bearer-token')
  }

  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: '/api/:path*',
}
