import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'

// Check if setup is needed (no admin user exists yet)
export async function GET() {
  try {
    const admin = await db.user.findFirst({ where: { role: 'admin' } })
    return NextResponse.json({ needsSetup: !admin })
  } catch {
    return NextResponse.json({ needsSetup: true })
  }
}

// Create the initial admin user
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password, name } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    // Check if admin already exists
    const existingAdmin = await db.user.findFirst({ where: { role: 'admin' } })
    if (existingAdmin) {
      return NextResponse.json({ error: 'Admin user already exists' }, { status: 409 })
    }

    const passwordHash = await bcrypt.hash(password, 12)

    const user = await db.user.create({
      data: {
        email,
        name: name || 'Admin',
        passwordHash,
        role: 'admin',
        mustChangePassword: false, // They just set their own password
        isActive: true,
      },
    })

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    })
  } catch (err) {
    console.error('Setup error:', err)
    return NextResponse.json({ error: 'Setup failed' }, { status: 500 })
  }
}
