import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const table = await db.sbTable.findUnique({ where: { id }, select: { versionHash: true } })
    if (!table) return NextResponse.json({ error: 'Table not found' }, { status: 404 })
    return NextResponse.json({ versionHash: table.versionHash })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch version' }, { status: 500 })
  }
}
