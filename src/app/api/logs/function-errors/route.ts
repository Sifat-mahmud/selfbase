import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, getParams } from '@/lib/api-utils';

/**
 * GET /api/logs/function-errors - Get function run errors
 */
export async function GET(request: NextRequest) {
  try {
    const params = getParams(request);

    const page = Math.max(1, parseInt(params.page || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(params.limit || '50')));
    const skip = (page - 1) * limit;

    const where: any = {};

    // Filter by status (failed, timeout)
    if (params.status) {
      where.status = params.status;
    } else {
      // Default: only show failed and timeout runs
      where.status = { in: ['failed', 'timeout'] };
    }

    // Filter by function
    if (params.functionId) where.functionId = params.functionId;

    // Filter by trigger type
    if (params.triggeredBy) where.triggeredBy = params.triggeredBy;

    // Date range
    if (params.from || params.to) {
      where.startedAt = {};
      if (params.from) where.startedAt.gte = new Date(params.from);
      if (params.to) where.startedAt.lte = new Date(params.to);
    }

    // Only include runs with errorPayload
    where.errorPayload = { not: null };

    const [runs, total] = await Promise.all([
      db.functionRun.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip,
        take: limit,
        include: {
          func: {
            select: { id: true, name: true, triggerType: true, runtime: true },
          },
        },
      }),
      db.functionRun.count({ where }),
    ]);

    // Group errors by function for summary
    const functionSummary = await db.functionRun.groupBy({
      by: ['functionId'],
      _count: { id: true },
      where: {
        status: { in: ['failed', 'timeout'] },
        errorPayload: { not: null },
        ...(params.from || params.to
          ? {
              startedAt: {
                gte: params.from ? new Date(params.from) : undefined,
                lte: params.to ? new Date(params.to) : undefined,
              },
            }
          : {}),
      },
    });

    // Get function names
    const functionIds = functionSummary.map((s) => s.functionId);
    const functions = await db.sbFunction.findMany({
      where: { id: { in: functionIds } },
      select: { id: true, name: true, triggerType: true },
    });

    const funcMap = Object.fromEntries(functions.map((f) => [f.id, f]));

    return successResponse({
      errors: runs.map((run) => ({
        id: run.id,
        functionId: run.functionId,
        functionName: run.func?.name,
        status: run.status,
        triggeredBy: run.triggeredBy,
        errorPayload: run.errorPayload,
        durationMs: run.durationMs,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        input: run.input,
      })),
      functionSummary: functionSummary.map((s) => ({
        functionId: s.functionId,
        func: funcMap[s.functionId] || null,
        errorCount: s._count.id,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}
