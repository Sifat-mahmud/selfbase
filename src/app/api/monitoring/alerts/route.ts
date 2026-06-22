import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  successResponse,
  paginatedResponse,
  errorResponse,
  serverErrorResponse,
  parsePagination,
} from '@/lib/api-utils';

// GET /api/monitoring/alerts - List all alert configs
export async function GET(request: NextRequest) {
  try {
    const { page, limit, skip, sort, order } = parsePagination(request.url);
    const url = new URL(request.url);
    const metricType = url.searchParams.get('metricType');
    const isEnabled = url.searchParams.get('isEnabled');

    const where: Record<string, unknown> = {};
    if (metricType) where.metricType = metricType;
    if (isEnabled !== null && isEnabled !== undefined) {
      where.isEnabled = isEnabled === 'true';
    }

    const [alerts, total] = await Promise.all([
      db.alertConfig.findMany({
        skip,
        take: limit,
        orderBy: { [sort]: order },
        where,
      }),
      db.alertConfig.count({ where }),
    ]);

    // Get event counts for each alert
    const alertsWithCounts = await Promise.all(
      alerts.map(async (a) => {
        const eventCount = await db.alertEvent.count({
          where: { configId: a.id },
        });
        return { ...a, eventCount };
      })
    );

    const data = alertsWithCounts;

    return paginatedResponse(data, page, limit, total);
  } catch (error) {
    return serverErrorResponse(error);
  }
}

// POST /api/monitoring/alerts - Create a new alert config
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { metricType, threshold, operator, duration, webhookUrl, emailTo, isEnabled } = body;

    if (!metricType) {
      return errorResponse('Metric type is required');
    }

    if (threshold === undefined || threshold === null) {
      return errorResponse('Threshold is required');
    }

    const validMetricTypes = ['cpu', 'req_per_sec', 'error_rate', 'latency', 'disk', 'ram'];
    if (!validMetricTypes.includes(metricType)) {
      return errorResponse(`Invalid metric type. Must be one of: ${validMetricTypes.join(', ')}`);
    }

    const validOperators = ['>', '<', '>=', '<='];
    if (operator && !validOperators.includes(operator)) {
      return errorResponse(`Invalid operator. Must be one of: ${validOperators.join(', ')}`);
    }

    const alert = await db.alertConfig.create({
      data: {
        metricType,
        threshold: Number(threshold),
        operator: operator || '>',
        duration: duration ?? 300,
        webhookUrl: webhookUrl || null,
        emailTo: emailTo || null,
        isEnabled: isEnabled ?? true,
      },
    });

    return successResponse(alert, 201);
  } catch (error) {
    return serverErrorResponse(error);
  }
}
