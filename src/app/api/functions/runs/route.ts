import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, getParams } from '@/lib/api-utils';

/**
 * GET /api/functions/runs - List function runs across all functions
 */
export async function GET(request: NextRequest) {
  try {
    const params = getParams(request);

    const page = Math.max(1, parseInt(params.page || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(params.limit || '50')));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.functionId) where.functionId = params.functionId;
    if (params.status) where.status = params.status;
    if (params.triggeredBy) where.triggeredBy = params.triggeredBy;

    // Date filtering
    if (params.from || params.to) {
      where.startedAt = {};
      if (params.from) where.startedAt.gte = new Date(params.from);
      if (params.to) where.startedAt.lte = new Date(params.to);
    }

    const [runs, total] = await Promise.all([
      db.functionRun.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip,
        take: limit,
        include: {
          func: {
            select: { id: true, name: true, triggerType: true },
          },
        },
      }),
      db.functionRun.count({ where }),
    ]);

    return successResponse({
      runs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}
