import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const scrapers = await db.scraperSitemap.findMany({
      include: { targetTable: { select: { name: true } }, scrapeRuns: { take: 5, orderBy: { startedAt: 'desc' } } },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(scrapers)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch scrapers' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const scraper = await db.scraperSitemap.create({ data: body })
    return NextResponse.json(scraper, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create scraper' }, { status: 500 })
  }
}
