import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const metrics = await db.tableCall.findMany({
      orderBy: { windowStart: 'desc' },
      take: 100,
    })
    return NextResponse.json(metrics)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 })
  }
}
