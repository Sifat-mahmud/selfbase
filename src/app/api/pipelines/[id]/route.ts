import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  serverErrorResponse,
} from '@/lib/api-utils';

// GET /api/pipelines/[id] - Get a single pipeline source
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const source = await db.pipelineSource.findUnique({
      where: { id },
      include: {
        targetTable: {
          select: { id: true, name: true, displayName: true },
        },
        pipelineRuns: {
          take: 10,
          orderBy: { startedAt: 'desc' },
        },
        sourceErrors: {
          take: 10,
          orderBy: { occurredAt: 'desc' },
        },
      },
    });

    if (!source) {
      return notFoundResponse('Pipeline source');
    }

    return successResponse(source);
  } catch (error) {
    return serverErrorResponse(error);
  }
}

// PUT /api/pipelines/[id] - Update a pipeline source
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await db.pipelineSource.findUnique({ where: { id } });
    if (!existing) {
      return notFoundResponse('Pipeline source');
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    // Only update fields that are provided
    const stringFields = [
      'name', 'description', 'sourceType', 'url', 'method', 'authType', 'jsonPath',
      'scheduleCron', 'onConflict', 'paginationMode',
    ];
    const jsonFields = [
      'headers', 'authConfig', 'columnMappings', 'isActiveWindow',
      'paginationConfig', 'validationRules',
    ];
    const numberFields = [
      'fetchInterval', 'maxPages', 'maxRetries', 'retryBackoff', 'timeoutMs',
    ];
    const booleanFields = ['isActive', 'ssrfProtection', 'autoSchema'];

    for (const field of stringFields) {
      if (body[field] !== undefined) updateData[field] = body[field] || null;
    }
    for (const field of jsonFields) {
      if (body[field] !== undefined) updateData[field] = body[field] ? JSON.stringify(body[field]) : null;
    }
    for (const field of numberFields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }
    for (const field of booleanFields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }
    if (body.targetTableId !== undefined) {
      if (body.targetTableId) {
        const table = await db.sbTable.findUnique({ where: { id: body.targetTableId } });
        if (!table) {
          return errorResponse('Target table not found');
        }
      }
      updateData.targetTableId = body.targetTableId || null;
    }

    const updated = await db.pipelineSource.update({
      where: { id },
      data: updateData,
      include: {
        targetTable: {
          select: { id: true, name: true, displayName: true },
        },
      },
    });

    return successResponse(updated);
  } catch (error) {
    return serverErrorResponse(error);
  }
}

// DELETE /api/pipelines/[id] - Delete a pipeline source
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await db.pipelineSource.findUnique({ where: { id } });
    if (!existing) {
      return notFoundResponse('Pipeline source');
    }

    await db.pipelineSource.delete({ where: { id } });

    return successResponse({ deleted: true, id });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
