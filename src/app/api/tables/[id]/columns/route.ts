import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const table = await db.sbTable.findUnique({ where: { id } })
    if (!table) return NextResponse.json({ error: 'Table not found' }, { status: 404 })

    const maxOrder = await db.sbColumn.findFirst({
      where: { tableId: id },
      orderBy: { order: 'desc' },
      select: { order: true },
    })

    const column = await db.sbColumn.create({
      data: {
        tableId: id,
        name: body.name,
        type: body.type || 'TEXT',
        nullable: body.nullable !== undefined ? body.nullable : true,
        isPrimaryKey: body.isPrimaryKey || false,
        isUnique: body.isUnique || false,
        isIndexed: body.isIndexed || false,
        defaultValue: body.defaultValue || null,
        order: body.order ?? (maxOrder?.order ?? -1) + 1,
      },
    })
    return NextResponse.json(column, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error && 'code' in err && (err as { code?: string }).code === 'P2002'
      ? 'A column with this name already exists'
      : 'Failed to create column'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
