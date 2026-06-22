import { NextRequest, NextResponse } from 'next/server'

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

  // For self-hosted local-first platform, pass through all API requests
  // Auth can be enabled by adding JWT/API key checks here
  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
