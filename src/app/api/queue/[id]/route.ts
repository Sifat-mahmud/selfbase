import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, notFoundResponse } from '@/lib/api-utils';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/queue/[id] - Get single request status
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const request = await db.deferredRequest.findUnique({ where: { id } });
    if (!request) return notFoundResponse('Deferred request');

    return successResponse(request);
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}

/**
 * DELETE /api/queue/[id] - Cancel a queued request
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const request = await db.deferredRequest.findUnique({ where: { id } });
    if (!request) return notFoundResponse('Deferred request');

    if (request.status !== 'queued' && request.status !== 'processing') {
      return errorResponse(`Cannot cancel a request with status: ${request.status}`);
    }

    await db.deferredRequest.update({
      where: { id },
      data: { status: 'expired' },
    });

    return successResponse({ cancelled: true, id });
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}
