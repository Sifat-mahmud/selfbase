import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  serverErrorResponse,
} from '@/lib/api-utils';

// Helper: Try to parse JSON, return original string if not valid JSON
function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

// GET /api/config/[key] - Get config by key
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params;

    const config = await db.systemConfig.findUnique({ where: { key } });
    if (!config) {
      return notFoundResponse('Config');
    }

    return successResponse({
      ...config,
      value: tryParseJson(config.value),
    });
  } catch (error) {
    return serverErrorResponse(error);
  }
}

// PUT /api/config/[key] - Update config by key
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params;

    const existing = await db.systemConfig.findUnique({ where: { key } });
    if (!existing) {
      return notFoundResponse('Config');
    }

    const body = await request.json();
    const { value, description } = body;

    if (value === undefined && description === undefined) {
      return errorResponse('At least one of value or description must be provided');
    }

    const updateData: Record<string, unknown> = {};
    if (value !== undefined) {
      updateData.value = typeof value === 'string' ? value : JSON.stringify(value);
    }
    if (description !== undefined) {
      updateData.description = description;
    }

    const updated = await db.systemConfig.update({
      where: { key },
      data: updateData,
    });

    return successResponse({
      ...updated,
      value: tryParseJson(updated.value),
    });
  } catch (error) {
    return serverErrorResponse(error);
  }
}

// DELETE /api/config/[key] - Delete config by key
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params;

    const existing = await db.systemConfig.findUnique({ where: { key } });
    if (!existing) {
      return notFoundResponse('Config');
    }

    await db.systemConfig.delete({ where: { key } });

    return successResponse({ deleted: true, key });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
