import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, notFoundResponse, parseBody } from '@/lib/api-utils';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/functions/[id] - Get a single function
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const func = await db.sbFunction.findUnique({
      where: { id },
      include: {
        functionRuns: {
          orderBy: { startedAt: 'desc' },
          take: 10,
        },
        _count: { select: { functionRuns: true } },
      },
    });

    if (!func) return notFoundResponse('Function');

    return successResponse(func);
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}

/**
 * PUT /api/functions/[id] - Update a function
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await parseBody(request);
    if (!body) return errorResponse('Invalid request body');

    const existing = await db.sbFunction.findUnique({ where: { id } });
    if (!existing) return notFoundResponse('Function');

    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.code !== undefined) updateData.code = body.code;
    if (body.runtime !== undefined) updateData.runtime = body.runtime;
    if (body.triggerType !== undefined) updateData.triggerType = body.triggerType;
    if (body.triggerConfig !== undefined) updateData.triggerConfig = JSON.stringify(body.triggerConfig);
    if (body.envVars !== undefined) updateData.envVars = JSON.stringify(body.envVars);
    if (body.timeoutMs !== undefined) updateData.timeoutMs = body.timeoutMs;
    if (body.memoryMb !== undefined) updateData.memoryMb = body.memoryMb;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    const func = await db.sbFunction.update({
      where: { id },
      data: updateData,
    });

    return successResponse(func);
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}

/**
 * DELETE /api/functions/[id] - Delete a function
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const existing = await db.sbFunction.findUnique({ where: { id } });
    if (!existing) return notFoundResponse('Function');

    await db.sbFunction.delete({ where: { id } });

    return successResponse({ deleted: true });
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}
