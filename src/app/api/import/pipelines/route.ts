import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

interface PipelineItem {
  name: string; description?: string | null; sourceType?: string; url?: string
  method?: string; headers?: Record<string, string>; authType?: string
  authConfig?: Record<string, unknown>; jsonPath?: string; fetchInterval?: number
  isActive?: boolean; onConflict?: string; targetTableName?: string | null
  columnMappings?: unknown[]; primaryKeyCols?: string[]; preRunAction?: string
  [key: string]: unknown
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const items: PipelineItem[] = body.items || []
    const mode: 'append' | 'replace' = body.mode || 'append'
    let imported = 0, skipped = 0
    const errors: string[] = []

    for (const item of items) {
      try {
        if (!item.name) { errors.push('Pipeline item missing "name" field'); continue }
        const existing = await db.pipelineSource.findFirst({ where: { name: item.name } })
        if (existing) {
          if (mode === 'append') { skipped++; continue }
          await db.pipelineSource.delete({ where: { id: existing.id } })
        }

        // Resolve targetTableName to targetTableId
        let targetTableId: string | null = null
        if (item.targetTableName) {
          const table = await db.sbTable.findUnique({ where: { name: item.targetTableName } })
          targetTableId = table?.id ?? null
        }

        await db.pipelineSource.create({
          data: {
            name: item.name,
            description: item.description || null,
            sourceType: item.sourceType || 'rest',
            url: item.url || '',
            method: item.method || 'GET',
            headers: JSON.stringify(item.headers || {}),
            authType: item.authType || 'none',
            authConfig: JSON.stringify(item.authConfig || {}),
            jsonPath: item.jsonPath || null,
            fetchInterval: item.fetchInterval || 300,
            isActive: item.isActive !== undefined ? item.isActive : true,
            onConflict: item.onConflict || 'update',
            targetTableId,
            columnMappings: JSON.stringify(item.columnMappings || []),
            primaryKeyCols: JSON.stringify(item.primaryKeyCols || []),
            preRunAction: item.preRunAction || 'none',
            paginationMode: (item as Record<string, unknown>).paginationMode as string || 'none',
            paginationConfig: JSON.stringify((item as Record<string, unknown>).paginationConfig || {}),
            maxPages: ((item as Record<string, unknown>).maxPages as number) || 1,
            maxRetries: ((item as Record<string, unknown>).maxRetries as number) || 3,
            retryBackoff: ((item as Record<string, unknown>).retryBackoff as number) || 1000,
            timeoutMs: ((item as Record<string, unknown>).timeoutMs as number) || 30000,
            ssrfProtection: ((item as Record<string, unknown>).ssrfProtection as boolean) ?? true,
          },
        })
        imported++
      } catch (err) {
        errors.push(`Pipeline "${item.name}": ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    return NextResponse.json({ imported, skipped, errors })
  } catch (err) {
    console.error('[API] Failed to import pipelines:', err)
    return NextResponse.json({ error: 'Failed to import pipelines' }, { status: 500 })
  }
}
