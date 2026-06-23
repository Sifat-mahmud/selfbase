import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const pipelines = await db.pipelineSource.findMany({ orderBy: { createdAt: 'desc' } })

    const items = pipelines.map(p => {
      let targetTableName: string | null = null
      if (p.targetTableId) {
        // Resolve targetTableId to name (best effort, sync lookup not possible here)
        targetTableName = null // Will be resolved on import
      }

      return {
        name: p.name,
        description: p.description,
        sourceType: p.sourceType,
        url: p.url,
        method: p.method,
        headers: (() => { try { return JSON.parse(p.headers || '{}') } catch { return {} } })(),
        authType: p.authType,
        authConfig: (() => { try { return JSON.parse(p.authConfig || '{}') } catch { return {} } })(),
        jsonPath: p.jsonPath,
        fetchInterval: p.fetchInterval,
        isActive: p.isActive,
        onConflict: p.onConflict,
        targetTableId: p.targetTableId,
        targetTableName: null as string | null,
        columnMappings: (() => { try { return JSON.parse(p.columnMappings || '[]') } catch { return [] } })(),
        primaryKeyCols: (() => { try { return JSON.parse(p.primaryKeyCols || '[]') } catch { return [] } })(),
        preRunAction: p.preRunAction,
        paginationMode: p.paginationMode,
        paginationConfig: (() => { try { return JSON.parse(p.paginationConfig || '{}') } catch { return {} } })(),
        maxPages: p.maxPages,
        maxRetries: p.maxRetries,
        retryBackoff: p.retryBackoff,
        timeoutMs: p.timeoutMs,
        ssrfProtection: p.ssrfProtection,
      }
    })

    // Resolve target table names
    for (const item of items) {
      if (item.targetTableId) {
        const table = await db.sbTable.findUnique({ where: { id: item.targetTableId } })
        item.targetTableName = table?.name ?? null
      }
    }

    return NextResponse.json({
      selfbase_format: '1.0',
      type: 'pipelines',
      exported_at: new Date().toISOString(),
      items,
    })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to export pipelines' }, { status: 500 })
  }
}
