import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  serverErrorResponse,
} from '@/lib/api-utils';

// GET /api/scrapers/[id] - Get a single sitemap
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const sitemap = await db.scraperSitemap.findUnique({
      where: { id },
      include: {
        targetTable: {
          select: { id: true, name: true, displayName: true },
        },
        scrapeRuns: {
          take: 10,
          orderBy: { startedAt: 'desc' },
        },
      },
    });

    if (!sitemap) {
      return notFoundResponse('Sitemap');
    }

    return successResponse(sitemap);
  } catch (error) {
    return serverErrorResponse(error);
  }
}

// PUT /api/scrapers/[id] - Update a sitemap
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await db.scraperSitemap.findUnique({ where: { id } });
    if (!existing) {
      return notFoundResponse('Sitemap');
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    const stringFields = [
      'name', 'description', 'startUrl', 'paginationType', 'outputFormat', 'scheduleCron',
    ];
    const jsonFields = [
      'selectorTree', 'paginationConfig', 'proxyConfig',
    ];
    const numberFields = [
      'fetchInterval', 'rateLimitMs', 'concurrency', 'maxPages',
    ];
    const booleanFields = ['isActive', 'respectRobotsTxt', 'useStealth'];

    for (const field of stringFields) {
      if (body[field] !== undefined) updateData[field] = body[field] || null;
    }
    for (const field of jsonFields) {
      if (body[field] !== undefined) updateData[field] = body[field] ? JSON.stringify(body[field]) : null;
    }
    for (const field of numberFields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }
    for (const field of booleanFields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }
    if (body.targetTableId !== undefined) {
      if (body.targetTableId) {
        const table = await db.sbTable.findUnique({ where: { id: body.targetTableId } });
        if (!table) {
          return errorResponse('Target table not found');
        }
      }
      updateData.targetTableId = body.targetTableId || null;
    }

    const updated = await db.scraperSitemap.update({
      where: { id },
      data: updateData,
      include: {
        targetTable: {
          select: { id: true, name: true, displayName: true },
        },
      },
    });

    return successResponse(updated);
  } catch (error) {
    return serverErrorResponse(error);
  }
}

// DELETE /api/scrapers/[id] - Delete a sitemap
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await db.scraperSitemap.findUnique({ where: { id } });
    if (!existing) {
      return notFoundResponse('Sitemap');
    }

    await db.scraperSitemap.delete({ where: { id } });

    return successResponse({ deleted: true, id });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
