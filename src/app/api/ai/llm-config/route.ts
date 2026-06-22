import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const configs = await db.llmConfig.findMany({ orderBy: { createdAt: 'desc' } })
    return NextResponse.json(configs)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch LLM configs' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const config = await db.llmConfig.create({ data: body })
    return NextResponse.json(config, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create LLM config' }, { status: 500 })
  }
}
