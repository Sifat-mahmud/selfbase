import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const scrapers = await db.scraperSitemap.findMany({ orderBy: { createdAt: 'desc' } })

    const items = await Promise.all(scrapers.map(async s => {
      let targetTableName: string | null = null
      if (s.targetTableId) {
        const table = await db.sbTable.findUnique({ where: { id: s.targetTableId } })
        targetTableName = table?.name ?? null
      }

      return {
        name: s.name,
        description: s.description,
        startUrl: s.startUrl,
        selectorTree: (() => { try { return JSON.parse(s.selectorTree || '{}') } catch { return {} } })(),
        paginationType: s.paginationType,
        paginationConfig: (() => { try { return JSON.parse(s.paginationConfig || '{}') } catch { return {} } })(),
        targetTableId: s.targetTableId,
        targetTableName,
        outputFormat: s.outputFormat,
        isActive: s.isActive,
        scheduleCron: s.scheduleCron,
        fetchInterval: s.fetchInterval,
        rateLimitMs: s.rateLimitMs,
        concurrency: s.concurrency,
        respectRobotsTxt: s.respectRobotsTxt,
        proxyConfig: (() => { try { return JSON.parse(s.proxyConfig || '{}') } catch { return {} } })(),
        useStealth: s.useStealth,
        maxPages: s.maxPages,
      }
    }))

    return NextResponse.json({
      selfbase_format: '1.0',
      type: 'scrapers',
      exported_at: new Date().toISOString(),
      items,
    })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to export scrapers' }, { status: 500 })
  }
}
