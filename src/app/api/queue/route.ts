import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, parseBody, getParams } from '@/lib/api-utils';

/**
 * GET /api/queue - List deferred requests
 */
export async function GET(request: NextRequest) {
  try {
    const params = getParams(request);

    const page = Math.max(1, parseInt(params.page || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(params.limit || '50')));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.status) where.status = params.status;
    if (params.tableName) where.tableName = params.tableName;
    if (params.sessionId) where.sessionId = params.sessionId;
    if (params.userId) where.userId = params.userId;

    // Priority filter
    if (params.minPriority) where.priority = { gte: parseInt(params.minPriority) };

    // Date range
    if (params.from || params.to) {
      where.queuedAt = {};
      if (params.from) where.queuedAt.gte = new Date(params.from);
      if (params.to) where.queuedAt.lte = new Date(params.to);
    }

    const [requests, total] = await Promise.all([
      db.deferredRequest.findMany({
        where,
        orderBy: [{ priority: 'asc' }, { queuedAt: 'asc' }],
        skip,
        take: limit,
      }),
      db.deferredRequest.count({ where }),
    ]);

    // Queue statistics
    const stats = await db.deferredRequest.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    return successResponse({
      requests,
      stats: stats.map((s) => ({ status: s.status, count: s._count.id })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}

/**
 * POST /api/queue - Add a request to the priority queue
 */
export async function POST(request: NextRequest) {
  try {
    const body = await parseBody(request);
    if (!body) return errorResponse('Invalid request body');

    const { tableName, queryParams, priority, userId, sessionId, expiresInSeconds } = body;

    if (!tableName) {
      return errorResponse('tableName is required');
    }

    // Calculate load score from current system metrics
    const latestHeartbeat = await db.heartbeat.findFirst({
      orderBy: { recordedAt: 'desc' },
    });

    let loadScore = 0;
    if (latestHeartbeat) {
      // Weighted load score calculation
      const cpuWeight = 0.4;
      const ramWeight = 0.3;
      const connectionsWeight = 0.2;
      const reqWeight = 0.1;

      const cpuNorm = Math.min(latestHeartbeat.cpuTotal / 100, 1);
      const ramNorm = Math.min(latestHeartbeat.ramUsedMb / 4096, 1); // Assume 4GB max
      const connNorm = Math.min(latestHeartbeat.activeConnections / 1000, 1);
      const reqNorm = Math.min(latestHeartbeat.reqPerSec / 1000, 1);

      loadScore = cpuWeight * cpuNorm + ramWeight * ramNorm + connectionsWeight * connNorm + reqWeight * reqNorm;
    }

    // If load is high, defer; if low, process immediately
    const autoPriority = priority ?? (loadScore > 0.8 ? 4 : loadScore > 0.5 ? 3 : 1);

    // Calculate expiry
    const expiresAt = new Date(
      Date.now() + (expiresInSeconds || 3600) * 1000
    );

    const deferredRequest = await db.deferredRequest.create({
      data: {
        userId: userId || null,
        sessionId: sessionId || null,
        tableName,
        queryParams: JSON.stringify(queryParams || {}),
        priority: autoPriority,
        status: 'queued',
        expiresAt,
      },
    });

    // If system load is low, auto-process
    let autoProcessed = false;
    if (loadScore < 0.3) {
      try {
        const table = await db.sbTable.findUnique({ where: { name: tableName } });
        if (table) {
          const rows = await db.sbRow.findMany({
            where: { tableId: table.id },
            take: 1000,
          });

          await db.deferredRequest.update({
            where: { id: deferredRequest.id },
            data: {
              status: 'completed',
              result: JSON.stringify(rows),
              completedAt: new Date(),
            },
          });

          autoProcessed = true;
        }
      } catch {
        // Auto-processing failed, keep in queue
      }
    }

    return successResponse({
      ...deferredRequest,
      autoProcessed,
      loadScore,
    }, 201);
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}
