import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/v1/auth/logout
// Invalidate an app token
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 })
    }

    // Delete the app token
    const deleted = await db.appToken.deleteMany({
      where: { token },
    })

    return NextResponse.json({
      success: true,
      revoked: deleted.count > 0,
    })
  } catch {
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 })
  }
}
