import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const keys = await db.apiKey.findMany({ orderBy: { createdAt: 'desc' } })
    return NextResponse.json(keys)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch API keys' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const key = await db.apiKey.create({ data: body })
    return NextResponse.json(key, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 })
  }
}
