import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  paginatedResponse,
  serverErrorResponse,
  parsePagination,
} from '@/lib/api-utils';

// GET /api/scrapers/runs - List all scrape runs
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const { page, limit, skip, order } = parsePagination(url);
    // ScrapeRun uses startedAt, not createdAt
    const sortField = url.searchParams.get('sort') || 'startedAt';
    const sitemapId = url.searchParams.get('sitemapId');
    const status = url.searchParams.get('status');

    const where: Record<string, unknown> = {};
    if (sitemapId) where.sitemapId = sitemapId;
    if (status) where.status = status;

    const [runs, total] = await Promise.all([
      db.scrapeRun.findMany({
        skip,
        take: limit,
        orderBy: { [sortField]: order },
        where,
        include: {
          sitemap: {
            select: { id: true, name: true, startUrl: true },
          },
        },
      }),
      db.scrapeRun.count({ where }),
    ]);

    return paginatedResponse(runs, page, limit, total);
  } catch (error) {
    return serverErrorResponse(error);
  }
}
