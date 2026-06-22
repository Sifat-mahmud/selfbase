import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, getParams } from '@/lib/api-utils';

/**
 * GET /api/ai/calls - List LLM call history
 */
export async function GET(request: NextRequest) {
  try {
    const params = getParams(request);

    const page = Math.max(1, parseInt(params.page || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(params.limit || '50')));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.configId) where.configId = params.configId;
    if (params.status) where.status = params.status;
    if (params.model) where.model = params.model;

    // Date filtering
    if (params.from || params.to) {
      where.createdAt = {};
      if (params.from) where.createdAt.gte = new Date(params.from);
      if (params.to) where.createdAt.lte = new Date(params.to);
    }

    const [calls, total] = await Promise.all([
      db.llmCall.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          config: {
            select: { id: true, name: true, provider: true, modelName: true },
          },
        },
      }),
      db.llmCall.count({ where }),
    ]);

    return successResponse({
      calls,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}
