import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, getParams } from '@/lib/api-utils';

/**
 * GET /api/logs/source-errors - Get pipeline/scraper source errors
 */
export async function GET(request: NextRequest) {
  try {
    const params = getParams(request);

    const page = Math.max(1, parseInt(params.page || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(params.limit || '50')));
    const skip = (page - 1) * limit;

    const where: any = {};

    // Filter by source ID
    if (params.sourceId) where.sourceId = params.sourceId;

    // Filter by error type
    if (params.errorType) where.errorType = params.errorType;

    // Filter by table
    if (params.tableId) where.tableId = params.tableId;

    // Date range
    if (params.from || params.to) {
      where.occurredAt = {};
      if (params.from) where.occurredAt.gte = new Date(params.from);
      if (params.to) where.occurredAt.lte = new Date(params.to);
    }

    // Only include errors that have a sourceId (pipeline/scraper errors)
    if (!params.sourceId) {
      where.sourceId = { not: null };
    }

    const [errors, total] = await Promise.all([
      db.sourceError.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        skip,
        take: limit,
        include: {
          source: {
            select: {
              id: true,
              name: true,
              sourceType: true,
              url: true,
            },
          },
          table: {
            select: { id: true, name: true },
          },
        },
      }),
      db.sourceError.count({ where }),
    ]);

    // Group errors by source for summary
    const sourceSummary = await db.sourceError.groupBy({
      by: ['sourceId'],
      _count: { id: true },
      where: {
        sourceId: { not: null },
        ...(params.from || params.to
          ? {
              occurredAt: {
                gte: params.from ? new Date(params.from) : undefined,
                lte: params.to ? new Date(params.to) : undefined,
              },
            }
          : {}),
      },
    });

    // Get source names for summary
    const sourceIds = sourceSummary.map((s) => s.sourceId).filter(Boolean) as string[];
    const sources = await db.pipelineSource.findMany({
      where: { id: { in: sourceIds } },
      select: { id: true, name: true, sourceType: true },
    });

    const sourceMap = Object.fromEntries(sources.map((s) => [s.id, s]));

    return successResponse({
      errors,
      sourceSummary: sourceSummary.map((s) => ({
        sourceId: s.sourceId,
        source: sourceMap[s.sourceId || ''] || null,
        errorCount: s._count.id,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}
