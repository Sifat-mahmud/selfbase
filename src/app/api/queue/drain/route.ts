import { db } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/api-utils';

/**
 * POST /api/queue/drain - Trigger queue drain
 *
 * Process queued deferred requests based on priority and system load.
 */
export async function POST() {
  try {
    // Get current load score
    const latestHeartbeat = await db.heartbeat.findFirst({
      orderBy: { recordedAt: 'desc' },
    });

    let loadScore = 0;
    if (latestHeartbeat) {
      const cpuNorm = Math.min(latestHeartbeat.cpuTotal / 100, 1);
      const ramNorm = Math.min(latestHeartbeat.ramUsedMb / 4096, 1);
      const connNorm = Math.min(latestHeartbeat.activeConnections / 1000, 1);
      const reqNorm = Math.min(latestHeartbeat.reqPerSec / 1000, 1);
      loadScore = 0.4 * cpuNorm + 0.3 * ramNorm + 0.2 * connNorm + 0.1 * reqNorm;
    }

    // Only drain if load is acceptable
    if (loadScore > 0.8) {
      return successResponse({
        drained: 0,
        message: 'System load too high, drain postponed',
        loadScore,
      });
    }

    // Calculate how many items we can process based on load
    const maxConcurrent = Math.max(1, Math.floor((1 - loadScore) * 20));

    // Fetch queued requests that haven't expired
    const queuedRequests = await db.deferredRequest.findMany({
      where: {
        status: 'queued',
        expiresAt: { gt: new Date() },
      },
      orderBy: [{ priority: 'asc' }, { queuedAt: 'asc' }],
      take: maxConcurrent,
    });

    let processed = 0;
    let failed = 0;
    let expired = 0;

    for (const req of queuedRequests) {
      try {
        // Mark as processing
        await db.deferredRequest.update({
          where: { id: req.id },
          data: { status: 'processing' },
        });

        // Find the table
        const table = await db.sbTable.findUnique({
          where: { name: req.tableName },
        });

        if (!table) {
          await db.deferredRequest.update({
            where: { id: req.id },
            data: {
              status: 'expired',
              result: JSON.stringify({ error: 'Table not found' }),
              completedAt: new Date(),
            },
          });
          expired++;
          continue;
        }

        // Parse query params
        let queryParams: any = {};
        try { queryParams = JSON.parse(req.queryParams); } catch { /* use defaults */ }

        // Execute the query
        const rows = await db.sbRow.findMany({
          where: { tableId: table.id },
          take: queryParams.limit || 1000,
          skip: queryParams.offset || 0,
        });

        // Mark as completed
        await db.deferredRequest.update({
          where: { id: req.id },
          data: {
            status: 'completed',
            result: JSON.stringify(rows),
            completedAt: new Date(),
          },
        });

        processed++;
      } catch (err: any) {
        // Mark as expired/failed
        await db.deferredRequest.update({
          where: { id: req.id },
          data: {
            status: 'expired',
            result: JSON.stringify({ error: err.message }),
            completedAt: new Date(),
          },
        });
        failed++;
      }
    }

    // Also clean up old expired requests
    const expiredResult = await db.deferredRequest.updateMany({
      where: {
        status: 'queued',
        expiresAt: { lte: new Date() },
      },
      data: { status: 'expired' },
    });

    return successResponse({
      drained: processed,
      failed,
      expired: expired + (expiredResult.count || 0),
      loadScore,
      maxConcurrent,
    });
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}
