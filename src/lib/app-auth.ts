import { db } from '@/lib/db'

interface AppAuthResult {
  valid: boolean
  error?: string
  permissions?: string[]
  app?: { name: string; prefix: string }
  expiresAt?: string
  apiKeyId?: string
}

/**
 * Validate an app token from the Authorization header.
 * This is used by /api/v1/* routes to authenticate external app requests.
 */
export async function validateAppToken(request: Request): Promise<AppAuthResult> {
  const authHeader = request.headers.get('Authorization')
  const token = authHeader?.replace('Bearer ', '')

  if (!token) {
    return { valid: false, error: 'Missing Authorization header' }
  }

  // Check if this is an API key (sb_live_*) - not a valid app token
  if (token.startsWith('sb_live_')) {
    return { valid: false, error: 'Use API key to login first at /api/v1/auth/login, then use the returned token' }
  }

  try {
    const appToken = await db.appToken.findUnique({
      where: { token },
      include: {
        apiKey: {
          select: {
            name: true,
            prefix: true,
            permissions: true,
            isActive: true,
            user: { select: { isActive: true } },
          },
        },
      },
    })

    if (!appToken) {
      return { valid: false, error: 'Invalid token' }
    }

    // Check expiry
    if (appToken.expiresAt < new Date()) {
      // Clean up expired token
      await db.appToken.delete({ where: { id: appToken.id } })
      return { valid: false, error: 'Token expired. Login again at /api/v1/auth/login' }
    }

    // Check if API key is still active
    if (!appToken.apiKey.isActive) {
      return { valid: false, error: 'API key has been revoked' }
    }

    // Check if user is still active
    if (!appToken.apiKey.user.isActive) {
      return { valid: false, error: 'Account suspended' }
    }

    return {
      valid: true,
      permissions: appToken.apiKey.permissions.split(',').map(p => p.trim()),
      app: { name: appToken.apiKey.name, prefix: appToken.apiKey.prefix },
      expiresAt: appToken.expiresAt.toISOString(),
      apiKeyId: appToken.apiKeyId,
    }
  } catch (err) {
    console.error('Token validation error:', err)
    return { valid: false, error: 'Validation failed' }
  }
}

/**
 * Check if a request has valid auth - either admin session or app token.
 * Returns user info for admin, or app info for external apps.
 */
export async function checkAuth(request: Request): Promise<{
  authenticated: boolean
  authType: 'admin' | 'app' | 'scheduler' | null
  permissions?: string[]
  userId?: string
  role?: string
}> {
  const authHeader = request.headers.get('Authorization')
  const token = authHeader?.replace('Bearer ', '')

  if (!token) return { authenticated: false, authType: null }

  // Check scheduler internal auth
  const schedulerSecret = request.headers.get('x-scheduler-secret')
  const internalSecret = process.env.SCHEDULER_SECRET || 'scheduler-internal-secret'
  if (schedulerSecret && schedulerSecret === internalSecret) {
    return { authenticated: true, authType: 'scheduler', permissions: ['admin'], role: 'admin' }
  }

  // Check admin session token
  try {
    const session = await db.session.findUnique({
      where: { token },
      include: { user: true },
    })

    if (session && session.expiresAt > new Date() && session.user.isActive) {
      return {
        authenticated: true,
        authType: 'admin',
        userId: session.user.id,
        role: session.user.role,
        permissions: ['admin'],
      }
    }
  } catch { /* continue */ }

  // Check app token
  const appResult = await validateAppToken(request)
  if (appResult.valid) {
    return {
      authenticated: true,
      authType: 'app',
      permissions: appResult.permissions,
    }
  }

  return { authenticated: false, authType: null }
}
