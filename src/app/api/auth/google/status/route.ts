import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/auth/google/status — Check if Google OAuth is enabled
 *
 * Public endpoint used by the login page to show/hide the "Sign in with Google" button.
 */
export async function GET() {
  try {
    const [enabledCfg, clientIdCfg, secretCfg] = await Promise.all([
      db.systemConfig.findUnique({ where: { key: 'auth.google.enabled' } }),
      db.systemConfig.findUnique({ where: { key: 'auth.google.clientId' } }),
      db.systemConfig.findUnique({ where: { key: 'auth.google.clientSecret' } }),
    ])

    const enabled = enabledCfg?.value === 'true'
    const hasClientId = !!clientIdCfg?.value
    const hasSecret = !!secretCfg?.value
    const configured = hasClientId && hasSecret

    return NextResponse.json({
      enabled: enabled && configured,
      configured,
    })
  } catch {
    return NextResponse.json({ enabled: false, configured: false })
  }
}
