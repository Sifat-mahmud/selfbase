import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const functions = await db.sbFunction.findMany({
      include: { functionRuns: { take: 10, orderBy: { startedAt: 'desc' } } },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(functions)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch functions' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const fn = await db.sbFunction.create({ data: body })
    return NextResponse.json(fn, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create function' }, { status: 500 })
  }
}
