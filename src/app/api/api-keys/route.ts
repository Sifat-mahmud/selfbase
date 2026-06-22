import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth-utils'
import { randomUUID } from 'crypto'

// List API keys for the current user
export async function GET(request: Request) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const keys = await db.apiKey.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      name: true,
      prefix: true,
      permissions: true,
      isActive: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ data: keys })
}

// Create a new API key
export async function POST(request: Request) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json()
  const { name, permissions } = body

  if (!name || name.trim().length === 0) {
    return NextResponse.json({ error: 'App name is required' }, { status: 400 })
  }

  // Generate a unique API key: sb_live_xxxxxxxxxxxxxxxx
  const rawKey = `sb_live_${randomUUID().replace(/-/g, '')}`
  const prefix = rawKey.substring(0, 12) // sb_live_xxxx

  const apiKey = await db.apiKey.create({
    data: {
      userId: user.id,
      name: name.trim(),
      keyHash: rawKey, // In production, hash this with bcrypt
      prefix,
      keyPlain: rawKey, // Shown only once
      permissions: permissions || 'read,write',
      isActive: true,
    },
  })

  return NextResponse.json({
    success: true,
    apiKey: {
      id: apiKey.id,
      name: apiKey.name,
      key: rawKey, // Full key shown only on creation
      prefix: apiKey.prefix,
      permissions: apiKey.permissions,
      createdAt: apiKey.createdAt,
    },
    warning: 'Store this API key securely. It will not be shown again.',
  })
}
