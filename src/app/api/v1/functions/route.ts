import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/api-utils';
import { validateAppToken } from '@/lib/app-auth';

/**
 * GET /api/v1/functions - List active functions for app discovery
 *
 * External apps authenticate with an app token to discover what functions are
 * available to invoke. Only metadata is returned — never the code or env vars.
 *
 * Any permission (read, write, admin) is allowed to list functions.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await validateAppToken(request);
    if (!auth.valid) {
      return errorResponse(auth.error || 'Unauthorized', 401);
    }

    const functions = await db.sbFunction.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        triggerType: true,
        updatedAt: true,
      },
      orderBy: { name: 'asc' },
    });

    return successResponse({
      functions,
      count: functions.length,
    });
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}
