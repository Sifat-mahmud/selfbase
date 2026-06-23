import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateVersionHash } from '@/lib/api-utils'
import { emitRealtimeEvent } from '@/lib/realtime-emit'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const url = new URL(req.url)

    // Pagination params
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
    const pageSize = Math.min(50000, Math.max(1, parseInt(url.searchParams.get('pageSize') || '50')))
    const skip = (page - 1) * pageSize

    // Search param - searches across ALL row data (JSON string contains)
    const search = url.searchParams.get('search')?.trim() || ''

    // Build where clause
    const where: Record<string, unknown> = { tableId: id }
    if (search) {
      where.data = { contains: search }
    }

    // Get total count for pagination
    const total = await db.sbRow.count({ where })

    // Get rows with pagination
    const rows = await db.sbRow.findMany({
      where,
      orderBy: { createdAt: 'desc' as const },
      skip,
      take: pageSize,
    })

    const totalPages = Math.ceil(total / pageSize)

    return NextResponse.json({
      rows,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch rows' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const row = await db.sbRow.create({
      data: {
        tableId: id,
        data: JSON.stringify(body.data || {}),
      },
    })

    // Update table row count and version hash
    const table = await db.sbTable.findUnique({ where: { id } })
    if (table) {
      const newCount = table.rowCount + 1
      const newHash = generateVersionHash(newCount, new Date().toISOString())
      await db.sbTable.update({
        where: { id },
        data: { rowCount: newCount, versionHash: newHash },
      })
    }

    // Emit realtime event (fire-and-forget, only if table has realtime enabled)
    emitRealtimeEvent(id, 'insert', {
      row: { id: row.id, data: JSON.parse(row.data), version: row.version, createdAt: row.createdAt, updatedAt: row.updatedAt },
      rowId: row.id,
    })

    return NextResponse.json(row, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create row' }, { status: 500 })
  }
}
