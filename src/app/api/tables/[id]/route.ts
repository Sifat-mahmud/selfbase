import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const table = await db.sbTable.findUnique({
      where: { id },
      include: { columns: { orderBy: { order: 'asc' } } },
    })
    if (!table) return NextResponse.json({ error: 'Table not found' }, { status: 404 })
    return NextResponse.json(table)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch table' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const table = await db.sbTable.update({
      where: { id },
      data: body,
      include: { columns: { orderBy: { order: 'asc' } } },
    })
    return NextResponse.json(table)
  } catch {
    return NextResponse.json({ error: 'Failed to update table' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await db.sbTable.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete table' }, { status: 500 })
  }
}
