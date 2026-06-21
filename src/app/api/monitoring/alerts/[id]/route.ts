import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  serverErrorResponse,
} from '@/lib/api-utils';

// PUT /api/monitoring/alerts/[id] - Update an alert config
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await db.alertConfig.findUnique({ where: { id } });
    if (!existing) {
      return notFoundResponse('Alert config');
    }

    const body = await request.json();
    const { metricType, threshold, operator, duration, webhookUrl, emailTo, isEnabled } = body;

    const updateData: Record<string, unknown> = {};
    if (metricType !== undefined) updateData.metricType = metricType;
    if (threshold !== undefined) updateData.threshold = Number(threshold);
    if (operator !== undefined) updateData.operator = operator;
    if (duration !== undefined) updateData.duration = duration;
    if (webhookUrl !== undefined) updateData.webhookUrl = webhookUrl || null;
    if (emailTo !== undefined) updateData.emailTo = emailTo || null;
    if (isEnabled !== undefined) updateData.isEnabled = isEnabled;

    const updated = await db.alertConfig.update({
      where: { id },
      data: updateData,
    });

    return successResponse(updated);
  } catch (error) {
    return serverErrorResponse(error);
  }
}

// DELETE /api/monitoring/alerts/[id] - Delete an alert config
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await db.alertConfig.findUnique({ where: { id } });
    if (!existing) {
      return notFoundResponse('Alert config');
    }

    await db.alertConfig.delete({ where: { id } });

    return successResponse({ deleted: true, id });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
