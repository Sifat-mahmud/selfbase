import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { randomUUID } from 'crypto'

// POST /api/v1/auth/login
// External apps authenticate using their API key to get a short-lived token
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        error: 'Missing Authorization header',
        message: 'Include your API key as: Authorization: Bearer sb_live_xxxxxxxx',
      }, { status: 401 })
    }

    const apiKey = authHeader.replace('Bearer ', '')

    if (!apiKey.startsWith('sb_live_')) {
      return NextResponse.json({
        error: 'Invalid API key format',
        message: 'API key must start with sb_live_',
      }, { status: 401 })
    }

    // Find the API key
    const keyRecord = await db.apiKey.findFirst({
      where: { keyHash: apiKey, isActive: true },
      include: { user: true },
    })

    if (!keyRecord) {
      return NextResponse.json({
        error: 'Invalid API key',
        message: 'The provided API key does not exist or has been revoked.',
      }, { status: 401 })
    }

    // Check if API key has expired
    if (keyRecord.expiresAt && keyRecord.expiresAt < new Date()) {
      return NextResponse.json({
        error: 'API key expired',
        message: 'This API key has expired. Generate a new one from the SelfBase dashboard.',
      }, { status: 401 })
    }

    // Check if user is active
    if (!keyRecord.user.isActive) {
      return NextResponse.json({
        error: 'Account suspended',
        message: 'The account associated with this API key has been suspended.',
      }, { status: 403 })
    }

    // Get token expiry from SystemConfig (default 60 minutes)
    let tokenExpiryMinutes = 60
    try {
      const config = await db.systemConfig.findUnique({
        where: { key: 'security.apiTokenExpiryMinutes' },
      })
      if (config) tokenExpiryMinutes = parseInt(config.value) || 60
    } catch { /* use default */ }

    // Create a short-lived app token
    const token = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '')
    const expiresAt = new Date(Date.now() + tokenExpiryMinutes * 60 * 1000)

    await db.appToken.create({
      data: {
        apiKeyId: keyRecord.id,
        token,
        expiresAt,
      },
    })

    // Update last used
    await db.apiKey.update({
      where: { id: keyRecord.id },
      data: { lastUsedAt: new Date() },
    })

    return NextResponse.json({
      success: true,
      token,
      tokenType: 'Bearer',
      expiresIn: tokenExpiryMinutes * 60, // seconds
      expiresAt: expiresAt.toISOString(),
      permissions: keyRecord.permissions.split(','),
      app: {
        name: keyRecord.name,
        prefix: keyRecord.prefix,
      },
    })
  } catch (err) {
    console.error('V1 auth login error:', err)
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 })
  }
}
