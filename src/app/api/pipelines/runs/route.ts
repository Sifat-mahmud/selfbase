import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  paginatedResponse,
  serverErrorResponse,
  parsePagination,
} from '@/lib/api-utils';

// GET /api/pipelines/runs - List all pipeline runs
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const { page, limit, skip, order } = parsePagination(url);
    // PipelineRun uses startedAt, not createdAt
    const sortField = url.searchParams.get('sort') || 'startedAt';
    const sourceId = url.searchParams.get('sourceId');
    const status = url.searchParams.get('status');

    const where: Record<string, unknown> = {};
    if (sourceId) where.sourceId = sourceId;
    if (status) where.status = status;

    const [runs, total] = await Promise.all([
      db.pipelineRun.findMany({
        skip,
        take: limit,
        orderBy: { [sortField]: order },
        where,
        include: {
          source: {
            select: { id: true, name: true, sourceType: true, url: true },
          },
        },
      }),
      db.pipelineRun.count({ where }),
    ]);

    return paginatedResponse(runs, page, limit, total);
  } catch (error) {
    return serverErrorResponse(error);
  }
}
