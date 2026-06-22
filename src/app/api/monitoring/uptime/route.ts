import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
} from '@/lib/api-utils';

// GET /api/monitoring/uptime - Calculate uptime from heartbeat gaps
// A gap > interval * 2 between heartbeats = downtime
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');

    // Default to last 24 hours
    const now = new Date();
    const fromTime = from ? new Date(from) : new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const toTime = to ? new Date(to) : now;

    if (isNaN(fromTime.getTime()) || isNaN(toTime.getTime())) {
      return errorResponse('Invalid date range. Use ISO 8601 format');
    }

    const heartbeats = await db.heartbeat.findMany({
      where: {
        recordedAt: {
          gte: fromTime,
          lte: toTime,
        },
      },
      orderBy: { recordedAt: 'asc' },
    });

    // If no heartbeats, system was down the entire period
    if (heartbeats.length === 0) {
      const totalMs = toTime.getTime() - fromTime.getTime();
      return successResponse({
        range: { from: fromTime.toISOString(), to: toTime.toISOString() },
        totalMs,
        uptimeMs: 0,
        downtimeMs: totalMs,
        uptimePercent: 0,
        downtimePeriods: [{ start: fromTime.toISOString(), end: toTime.toISOString(), durationMs: totalMs }],
        heartbeatCount: 0,
      });
    }

    // Calculate downtime from gaps
    const downtimePeriods: Array<{ start: string; end: string; durationMs: number }> = [];
    let totalDowntimeMs = 0;

    // Check gap from period start to first heartbeat
    const firstHeartbeatTime = heartbeats[0].recordedAt.getTime();
    if (firstHeartbeatTime > fromTime.getTime()) {
      const gapMs = firstHeartbeatTime - fromTime.getTime();
      downtimePeriods.push({
        start: fromTime.toISOString(),
        end: new Date(firstHeartbeatTime).toISOString(),
        durationMs: gapMs,
      });
      totalDowntimeMs += gapMs;
    }

    // Check gaps between heartbeats
    for (let i = 1; i < heartbeats.length; i++) {
      const prev = heartbeats[i - 1];
      const curr = heartbeats[i];
      const gapMs = curr.recordedAt.getTime() - prev.recordedAt.getTime();
      const expectedInterval = (prev.intervalSec || 60) * 1000;
      const threshold = expectedInterval * 2;

      if (gapMs > threshold) {
        const downtimeStart = new Date(prev.recordedAt.getTime() + expectedInterval);
        const downtimeEnd = new Date(curr.recordedAt.getTime() - expectedInterval);
        const downtimeMs = downtimeEnd.getTime() - downtimeStart.getTime();

        if (downtimeMs > 0) {
          downtimePeriods.push({
            start: downtimeStart.toISOString(),
            end: downtimeEnd.toISOString(),
            durationMs: downtimeMs,
          });
          totalDowntimeMs += downtimeMs;
        }
      }
    }

    // Check gap from last heartbeat to period end
    const lastHeartbeatTime = heartbeats[heartbeats.length - 1].recordedAt.getTime();
    const lastInterval = (heartbeats[heartbeats.length - 1].intervalSec || 60) * 1000;
    if (toTime.getTime() - lastHeartbeatTime > lastInterval * 2) {
      const downtimeStart = new Date(lastHeartbeatTime + lastInterval);
      const downtimeMs = toTime.getTime() - downtimeStart.getTime();

      if (downtimeMs > 0) {
        downtimePeriods.push({
          start: downtimeStart.toISOString(),
          end: toTime.toISOString(),
          durationMs: downtimeMs,
        });
        totalDowntimeMs += downtimeMs;
      }
    }

    const totalMs = toTime.getTime() - fromTime.getTime();
    const uptimeMs = totalMs - totalDowntimeMs;
    const uptimePercent = totalMs > 0 ? (uptimeMs / totalMs) * 100 : 100;

    return successResponse({
      range: { from: fromTime.toISOString(), to: toTime.toISOString() },
      totalMs,
      uptimeMs,
      downtimeMs: totalDowntimeMs,
      uptimePercent: Math.round(uptimePercent * 100) / 100,
      downtimePeriods,
      heartbeatCount: heartbeats.length,
    });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
