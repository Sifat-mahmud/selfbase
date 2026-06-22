import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const heartbeats = await db.heartbeat.findMany({
      orderBy: { recordedAt: 'desc' },
      take: 60,
    })
    return NextResponse.json(heartbeats)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch heartbeat data' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const heartbeat = await db.heartbeat.create({ data: body })
    return NextResponse.json(heartbeat, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to record heartbeat' }, { status: 500 })
  }
}
