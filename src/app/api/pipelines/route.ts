import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const pipelines = await db.pipelineSource.findMany({
      include: { targetTable: { select: { name: true } }, pipelineRuns: { take: 1, orderBy: { startedAt: 'desc' } } },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(pipelines)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch pipelines' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const pipeline = await db.pipelineSource.create({ data: body })
    return NextResponse.json(pipeline, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create pipeline' }, { status: 500 })
  }
}
