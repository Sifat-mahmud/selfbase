import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const level = searchParams.get('level')
    const source = searchParams.get('source')
    const limit = parseInt(searchParams.get('limit') || '100')

    const errors = await db.sourceError.findMany({
      where: {
        ...(level ? { errorType: level } : {}),
      },
      orderBy: { occurredAt: 'desc' },
      take: limit,
    })
    return NextResponse.json(errors)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 })
  }
}
