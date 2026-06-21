import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const files = await db.storageFile.findMany({ orderBy: { createdAt: 'desc' } })
    return NextResponse.json(files)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch storage files' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const file = await db.storageFile.create({ data: body })
    return NextResponse.json(file, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 })
  }
}
