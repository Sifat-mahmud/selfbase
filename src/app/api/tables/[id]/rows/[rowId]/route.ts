import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  serverErrorResponse,
  generateVersionHash,
} from '@/lib/api-utils';
import { emitRealtimeEvent } from '@/lib/realtime-emit';

// GET /api/tables/[id]/rows/[rowId] - Get a single row
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; rowId: string }> }
) {
  try {
    const { id, rowId } = await params;

    const row = await db.sbRow.findFirst({
      where: { id: rowId, tableId: id },
    });

    if (!row) {
      return notFoundResponse('Row');
    }

    return successResponse({
      ...row,
      data: JSON.parse(row.data),
    });
  } catch (error) {
    return serverErrorResponse(error);
  }
}

// PUT /api/tables/[id]/rows/[rowId] - Update a row
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; rowId: string }> }
) {
  try {
    const { id, rowId } = await params;

    const existing = await db.sbRow.findFirst({
      where: { id: rowId, tableId: id },
    });

    if (!existing) {
      return notFoundResponse('Row');
    }

    const body = await request.json();
    if (!body || typeof body !== 'object') {
      return errorResponse('Row data is required');
    }

    // Merge existing data with new data
    const existingData = JSON.parse(existing.data) as Record<string, unknown>;
    const mergedData = { ...existingData, ...body };

    const updated = await db.sbRow.update({
      where: { id: rowId },
      data: {
        data: JSON.stringify(mergedData),
        version: { increment: 1 },
      },
    });

    // Update table version hash
    const table = await db.sbTable.findUnique({ where: { id } });
    if (table) {
      const newVersionHash = generateVersionHash(table.rowCount, new Date().toISOString());
      await db.sbTable.update({
        where: { id },
        data: { versionHash: newVersionHash },
      });
    }

    // Emit realtime event (fire-and-forget, only if table has realtime enabled)
    emitRealtimeEvent(id, 'update', {
      row: { id: updated.id, data: JSON.parse(updated.data), version: updated.version, createdAt: updated.createdAt, updatedAt: updated.updatedAt },
      rowId: updated.id,
    })

    return successResponse({
      ...updated,
      data: JSON.parse(updated.data),
    });
  } catch (error) {
    return serverErrorResponse(error);
  }
}

// DELETE handler updated below
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; rowId: string }> }
) {
  try {
    const { id, rowId } = await params;

    const existing = await db.sbRow.findFirst({
      where: { id: rowId, tableId: id },
    });

    if (!existing) {
      return notFoundResponse('Row');
    }

    await db.sbRow.delete({ where: { id: rowId } });

    // Update table row count and version hash
    const table = await db.sbTable.findUnique({ where: { id } });
    if (table) {
      const updatedCount = Math.max(0, table.rowCount - 1);
      const newVersionHash = generateVersionHash(updatedCount, new Date().toISOString());
      await db.sbTable.update({
        where: { id },
        data: {
          rowCount: updatedCount,
          versionHash: newVersionHash,
        },
      });
    }

    // Emit realtime event (fire-and-forget, only if table has realtime enabled)
    emitRealtimeEvent(id, 'delete', {
      rowId,
    })

    return successResponse({ deleted: true, id: rowId });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
