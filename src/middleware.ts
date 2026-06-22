import { NextRequest, NextResponse } from 'next/server'

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  '/api/auth/login',
  '/api/auth/setup',
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

  // Allow public routes (login, setup) without auth
  if (PUBLIC_ROUTES.some(route => pathname === route)) {
    return NextResponse.next()
  }

  // For self-hosted local-first platform, pass through all API requests
  // The frontend handles auth state and redirects to login if needed
  // Auth enforcement can be tightened here by checking the Bearer token
  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
