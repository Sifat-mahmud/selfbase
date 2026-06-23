import { NextResponse } from 'next/server'

/**
 * GET /api/realtime/health - Proxy to the realtime Socket.IO service health endpoint.
 * This allows the API Playground to check realtime service status without
 * needing to know the internal port.
 */
export async function GET() {
  try {
    const res = await fetch('http://localhost:3003/health', {
      signal: AbortSignal.timeout(3000),
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json(
      {
        status: 'offline',
        connections: 0,
        rooms: [],
        subscriptions: 0,
        error: 'Realtime service unavailable',
      },
      { status: 503 }
    )
  }
}
