import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

interface ScraperItem {
  name: string; description?: string | null; startUrl?: string
  selectorTree?: Record<string, unknown>; paginationType?: string
  paginationConfig?: Record<string, unknown>; targetTableName?: string | null
  outputFormat?: string; isActive?: boolean; scheduleCron?: string
  fetchInterval?: number; rateLimitMs?: number; concurrency?: number
  respectRobotsTxt?: boolean; useStealth?: boolean; maxPages?: number
  [key: string]: unknown
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const items: ScraperItem[] = body.items || []
    const mode: 'append' | 'replace' = body.mode || 'append'
    let imported = 0, skipped = 0
    const errors: string[] = []

    for (const item of items) {
      try {
        if (!item.name) { errors.push('Scraper item missing "name" field'); continue }
        const existing = await db.scraperSitemap.findFirst({ where: { name: item.name } })
        if (existing) {
          if (mode === 'append') { skipped++; continue }
          await db.scraperSitemap.delete({ where: { id: existing.id } })
        }

        let targetTableId: string | null = null
        if (item.targetTableName) {
          const table = await db.sbTable.findUnique({ where: { name: item.targetTableName } })
          targetTableId = table?.id ?? null
        }

        await db.scraperSitemap.create({
          data: {
            name: item.name,
            description: item.description || null,
            startUrl: item.startUrl || '',
            selectorTree: JSON.stringify(item.selectorTree || {}),
            paginationType: item.paginationType || 'none',
            paginationConfig: JSON.stringify(item.paginationConfig || {}),
            targetTableId,
            outputFormat: item.outputFormat || 'json',
            isActive: item.isActive !== undefined ? item.isActive : true,
            scheduleCron: item.scheduleCron || null,
            fetchInterval: item.fetchInterval || 3600,
            rateLimitMs: item.rateLimitMs || 1000,
            concurrency: item.concurrency || 1,
            respectRobotsTxt: item.respectRobotsTxt !== undefined ? item.respectRobotsTxt : true,
            useStealth: item.useStealth || false,
            maxPages: item.maxPages || 10,
            proxyConfig: JSON.stringify((item as Record<string, unknown>).proxyConfig || {}),
          },
        })
        imported++
      } catch (err) {
        errors.push(`Scraper "${item.name}": ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    return NextResponse.json({ imported, skipped, errors })
  } catch (err) {
    console.error('[API] Failed to import scrapers:', err)
    return NextResponse.json({ error: 'Failed to import scrapers' }, { status: 500 })
  }
}
