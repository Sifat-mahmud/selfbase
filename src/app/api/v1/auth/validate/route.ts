import { NextResponse } from 'next/server'
import { validateAppToken } from '@/lib/app-auth'

// POST /api/v1/auth/validate
// Check if a token is still valid
export async function POST(request: Request) {
  try {
    const result = await validateAppToken(request)

    if (!result.valid) {
      return NextResponse.json({
        valid: false,
        error: result.error,
      }, { status: 401 })
    }

    return NextResponse.json({
      valid: true,
      permissions: result.permissions,
      app: result.app,
      expiresAt: result.expiresAt,
    })
  } catch {
    return NextResponse.json({ valid: false, error: 'Validation failed' }, { status: 500 })
  }
}
