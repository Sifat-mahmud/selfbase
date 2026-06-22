import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  successResponse,
  serverErrorResponse,
} from '@/lib/api-utils';

// GET /api/monitoring/load - Get current load score
// Computes from active connections, req/s, and CPU (using latest heartbeat)
export async function GET() {
  try {
    // Get the latest heartbeat
    const latestHeartbeat = await db.heartbeat.findFirst({
      orderBy: { recordedAt: 'desc' },
    });

    // Get recent heartbeats for averaging (last 5 minutes)
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentHeartbeats = await db.heartbeat.findMany({
      where: { recordedAt: { gte: fiveMinAgo } },
      orderBy: { recordedAt: 'desc' },
      take: 10,
    });

    // Calculate averages
    const avgCpuTotal =
      recentHeartbeats.length > 0
        ? Math.round(
            recentHeartbeats.reduce((sum, h) => sum + h.cpuTotal, 0) /
              recentHeartbeats.length
          )
        : latestHeartbeat?.cpuTotal ?? 0;

    const avgCpuScraper =
      recentHeartbeats.length > 0
        ? Math.round(
            recentHeartbeats.reduce((sum, h) => sum + h.cpuScraper, 0) /
              recentHeartbeats.length
          )
        : latestHeartbeat?.cpuScraper ?? 0;

    const avgCpuApi =
      recentHeartbeats.length > 0
        ? Math.round(
            recentHeartbeats.reduce((sum, h) => sum + h.cpuApi, 0) /
              recentHeartbeats.length
          )
        : latestHeartbeat?.cpuApi ?? 0;

    const avgCpuFunctions =
      recentHeartbeats.length > 0
        ? Math.round(
            recentHeartbeats.reduce((sum, h) => sum + h.cpuFunctions, 0) /
              recentHeartbeats.length
          )
        : latestHeartbeat?.cpuFunctions ?? 0;

    const avgRamUsedMb =
      recentHeartbeats.length > 0
        ? Math.round(
            recentHeartbeats.reduce((sum, h) => sum + h.ramUsedMb, 0) /
              recentHeartbeats.length
          )
        : latestHeartbeat?.ramUsedMb ?? 0;

    const currentConnections = latestHeartbeat?.activeConnections ?? 0;
    const currentReqPerSec = latestHeartbeat?.reqPerSec ?? 0;

    // Compute load score
    const cpuFactor = avgCpuTotal / 100;
    const ramFactor = Math.min(avgRamUsedMb / 4096, 1);
    const connFactor = Math.min(currentConnections / 100, 1);
    const reqFactor = Math.min(currentReqPerSec / 50, 1);

    const loadScore = Math.round(
      (cpuFactor * 0.4 + ramFactor * 0.2 + connFactor * 0.2 + reqFactor * 0.2) * 100
    );

    // Determine load level
    let loadLevel: 'low' | 'moderate' | 'high' | 'critical';
    if (loadScore <= 25) loadLevel = 'low';
    else if (loadScore <= 50) loadLevel = 'moderate';
    else if (loadScore <= 75) loadLevel = 'high';
    else loadLevel = 'critical';

    // Get active pipeline runs and scrape runs
    const [activePipelineRuns, activeScrapeRuns] = await Promise.all([
      db.pipelineRun.count({ where: { status: 'running' } }),
      db.scrapeRun.count({ where: { status: 'running' } }),
    ]);

    // Get recent error count (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const [recentPipelineErrors, recentScrapeErrors, recentSourceErrors] = await Promise.all([
      db.pipelineRun.count({
        where: { status: 'failed', startedAt: { gte: oneHourAgo } },
      }),
      db.scrapeRun.count({
        where: { status: 'failed', startedAt: { gte: oneHourAgo } },
      }),
      db.sourceError.count({
        where: { occurredAt: { gte: oneHourAgo } },
      }),
    ]);

    return successResponse({
      loadScore,
      loadLevel,
      cpu: {
        total: avgCpuTotal,
        scraper: avgCpuScraper,
        api: avgCpuApi,
        functions: avgCpuFunctions,
      },
      memory: {
        usedMb: avgRamUsedMb,
        totalMb: 4096, // Simulated
        percent: Math.round((avgRamUsedMb / 4096) * 100),
      },
      connections: currentConnections,
      requestsPerSecond: currentReqPerSec,
      activeJobs: {
        pipelines: activePipelineRuns,
        scrapers: activeScrapeRuns,
      },
      recentErrors: {
        pipelines: recentPipelineErrors,
        scrapers: recentScrapeErrors,
        sources: recentSourceErrors,
        total: recentPipelineErrors + recentScrapeErrors + recentSourceErrors,
      },
      lastHeartbeat: latestHeartbeat?.recordedAt.toISOString() ?? null,
    });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
