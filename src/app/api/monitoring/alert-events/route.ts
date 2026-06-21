import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, serverErrorResponse } from '@/lib/api-utils';

// GET /api/monitoring/alert-events - List recent alert events
// Query params:
//   limit   - number of events to return (1-100, default 50)
//   resolved - 'true' | 'false' | omitted (all)
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)),
    );
    const resolved = url.searchParams.get('resolved'); // 'true', 'false', or null (all)

    const where: { isResolved?: boolean } = {};
    if (resolved === 'true') where.isResolved = true;
    if (resolved === 'false') where.isResolved = false;

    const events = await db.alertEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return successResponse(events);
  } catch (error) {
    return serverErrorResponse(error);
  }
}
