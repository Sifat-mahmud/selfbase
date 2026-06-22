import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const tables = await db.sbTable.findMany({
      include: { columns: { orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(tables)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch tables' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const table = await db.sbTable.create({
      data: {
        name: body.name,
        displayName: body.displayName || null,
        description: body.description || null,
        priority: body.priority || 2,
        schema: body.schema || '{}',
      },
    })
    return NextResponse.json(table, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create table' }, { status: 500 })
  }
}
