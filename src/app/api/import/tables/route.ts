import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

interface ColumnDef {
  name: string; type: string; nullable?: boolean; defaultValue?: string | null
  isPrimaryKey?: boolean; isUnique?: boolean; isIndexed?: boolean
}
interface TableItem {
  name: string; displayName?: string | null; description?: string | null
  columns: ColumnDef[]; rows: Record<string, unknown>[]
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const items: TableItem[] = body.items || []
    const mode: 'append' | 'replace' = body.mode || 'append'
    let imported = 0, skipped = 0
    const errors: string[] = []

    for (const item of items) {
      try {
        if (!item.name) { errors.push('Table item missing "name" field'); continue }
        const existing = await db.sbTable.findUnique({ where: { name: item.name } })
        if (existing) {
          if (mode === 'append') { skipped++; continue }
          await db.sbTable.delete({ where: { id: existing.id } })
        }

        const table = await db.sbTable.create({
          data: { name: item.name, displayName: item.displayName || null, description: item.description || null },
        })

        if (item.columns?.length > 0) {
          for (let i = 0; i < item.columns.length; i++) {
            const col = item.columns[i]
            await db.sbColumn.create({
              data: {
                tableId: table.id, name: col.name, type: col.type || 'TEXT',
                nullable: col.nullable !== undefined ? col.nullable : true,
                defaultValue: col.defaultValue || null,
                isPrimaryKey: col.isPrimaryKey || false, isUnique: col.isUnique || false,
                isIndexed: col.isIndexed || false, order: i,
              },
            })
          }
        }

        if (item.rows?.length > 0) {
          const batchSize = 100
          for (let i = 0; i < item.rows.length; i += batchSize) {
            const batch = item.rows.slice(i, i + batchSize)
            await db.sbRow.createMany({
              data: batch.map(row => ({ tableId: table.id, data: JSON.stringify(row) })),
            })
          }
        }

        const rowCount = await db.sbRow.count({ where: { tableId: table.id } })
        await db.sbTable.update({ where: { id: table.id }, data: { rowCount } })
        imported++
      } catch (err) {
        const msg = err instanceof Prisma.PrismaClientKnownRequestError
          ? `Table "${item.name}": ${err.message}`
          : `Table "${item.name}": ${String(err)}`
        errors.push(msg)
      }
    }

    return NextResponse.json({ imported, skipped, errors })
  } catch (err) {
    console.error('[API] Failed to import tables:', err)
    return NextResponse.json({ error: 'Failed to import tables' }, { status: 500 })
  }
}
