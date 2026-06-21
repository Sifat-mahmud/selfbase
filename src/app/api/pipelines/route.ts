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

    // Build the create data object with explicit field mapping
    const data: Record<string, unknown> = {
      name: body.name,
      description: body.description || null,
      sourceType: body.sourceType || 'rest',
      url: body.url,
      method: body.method || 'GET',
      headers: body.headers || null,
      authType: body.authType || null,
      authConfig: body.authConfig || null,
      jsonPath: body.jsonPath || null,
      columnMappings: body.columnMappings || '[]',
      fetchInterval: body.fetchInterval || 300,
      scheduleCron: body.scheduleCron || null,
      isActive: body.isActive !== undefined ? body.isActive : true,
      isActiveWindow: body.isActiveWindow || null,
      onConflict: body.onConflict || 'update',
      preRunAction: body.preRunAction || 'none',
      primaryKeyCols: body.primaryKeyCols || '[]',
      paginationMode: body.paginationMode || 'none',
      paginationConfig: body.paginationConfig || null,
      maxPages: body.maxPages || 100,
      maxRetries: body.maxRetries || 3,
      retryBackoff: body.retryBackoff || 2,
      timeoutMs: body.timeoutMs || 30000,
      ssrfProtection: body.ssrfProtection !== undefined ? body.ssrfProtection : true,
      autoSchema: body.autoSchema !== undefined ? body.autoSchema : true,
      validationRules: body.validationRules || null,
    }

    // Handle the targetTable relation - use connect syntax
    if (body.targetTableId) {
      data.targetTable = { connect: { id: body.targetTableId } }
    }

    const pipeline = await db.pipelineSource.create({ data })
    return NextResponse.json(pipeline, { status: 201 })
  } catch (error) {
    console.error('Failed to create pipeline:', error)
    return NextResponse.json({ error: 'Failed to create pipeline' }, { status: 500 })
  }
}
