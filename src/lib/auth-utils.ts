import { db } from '@/lib/db'

interface UserInfo {
  id: string
  email: string
  name: string | null
  role: string
  mustChangePassword: boolean
  avatarUrl: string | null
}

/**
 * Extract and validate the user from an incoming request's Authorization header.
 * Returns null if not authenticated.
 */
export async function getUserFromRequest(request: Request): Promise<UserInfo | null> {
  const authHeader = request.headers.get('Authorization')
  const token = authHeader?.replace('Bearer ', '')

  if (!token) return null

  // Check for internal scheduler auth
  const schedulerSecret = request.headers.get('x-scheduler-secret')
  const internalSecret = process.env.SCHEDULER_SECRET || 'scheduler-internal-secret'
  if (schedulerSecret && schedulerSecret === internalSecret) {
    // Return a synthetic admin user for internal scheduler
    return {
      id: 'scheduler-internal',
      email: 'scheduler@selfbase.internal',
      name: 'Scheduler',
      role: 'admin',
      mustChangePassword: false,
      avatarUrl: null,
    }
  }

  try {
    const session = await db.session.findUnique({
      where: { token },
      include: { user: true },
    })

    if (!session) return null

    // Check expiry
    if (session.expiresAt < new Date()) {
      // Clean up expired session
      await db.session.delete({ where: { id: session.id } })
      return null
    }

    if (!session.user.isActive) return null

    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
      mustChangePassword: session.user.mustChangePassword,
      avatarUrl: session.user.avatarUrl,
    }
  } catch {
    return null
  }
}
