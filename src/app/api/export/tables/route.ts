import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const tables = await db.sbTable.findMany({
      include: { columns: { orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    })

    const items = []
    for (const table of tables) {
      const rows = await db.sbRow.findMany({ where: { tableId: table.id } })
      items.push({
        name: table.name,
        displayName: table.displayName,
        description: table.description,
        columns: table.columns.map(c => ({
          name: c.name,
          type: c.type,
          nullable: c.nullable,
          defaultValue: c.defaultValue,
          isPrimaryKey: c.isPrimaryKey,
          isUnique: c.isUnique,
          isIndexed: c.isIndexed,
        })),
        rows: rows.map(r => {
          try { return JSON.parse(r.data) } catch { return {} }
        }),
      })
    }

    return NextResponse.json({
      selfbase_format: '1.0',
      type: 'tables',
      exported_at: new Date().toISOString(),
      items,
    })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to export tables' }, { status: 500 })
  }
}
