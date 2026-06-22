import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  successResponse,
  paginatedResponse,
  serverErrorResponse,
  parsePagination,
} from '@/lib/api-utils';

// GET /api/auth/sessions - List all sessions
export async function GET(request: NextRequest) {
  try {
    const { page, limit, skip, sort, order } = parsePagination(request.url);
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');

    // Only return active (non-expired) sessions by default
    const where = {
      ...(userId ? { userId } : {}),
      expiresAt: { gt: new Date() },
    };

    const [sessions, total] = await Promise.all([
      db.session.findMany({
        skip,
        take: limit,
        orderBy: { [sort]: order },
        where,
        include: {
          user: {
            select: { id: true, email: true, name: true },
          },
        },
      }),
      db.session.count({ where }),
    ]);

    // Mask tokens for security
    const data = sessions.map((s) => ({
      ...s,
      token: `${s.token.substring(0, 8)}...`,
    }));

    return paginatedResponse(data, page, limit, total);
  } catch (error) {
    return serverErrorResponse(error);
  }
}
