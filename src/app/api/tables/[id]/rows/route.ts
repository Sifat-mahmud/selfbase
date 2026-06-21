import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const rows = await db.sbRow.findMany({
      where: { tableId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return NextResponse.json(rows)
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
    return NextResponse.json(row, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create row' }, { status: 500 })
  }
}
