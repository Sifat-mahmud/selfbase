import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { getUserFromRequest } from '@/lib/auth-utils'

export async function POST(request: Request) {
  try {
    const userInfo = await getUserFromRequest(request)
    if (!userInfo) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { currentPassword, newPassword } = body

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { id: userInfo.id } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // If user has a password, verify current password
    if (user.passwordHash && currentPassword) {
      const valid = await bcrypt.compare(currentPassword, user.passwordHash)
      if (!valid) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })
      }
    } else if (user.passwordHash && !currentPassword) {
      return NextResponse.json({ error: 'Current password is required' }, { status: 400 })
    }

    // Hash and save new password
    const passwordHash = await bcrypt.hash(newPassword, 12)

    await db.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        mustChangePassword: false,
      },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Change password error:', err)
    return NextResponse.json({ error: 'Failed to change password' }, { status: 500 })
  }
}
