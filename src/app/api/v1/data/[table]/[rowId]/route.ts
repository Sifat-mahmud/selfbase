import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  parseBody,
} from '@/lib/api-utils';
import { validateAppToken } from '@/lib/app-auth';
import { emitRealtimeEvent } from '@/lib/realtime-emit';
import { createHash } from 'crypto';

interface RouteContext {
  params: Promise<{ table: string; rowId: string }>;
}

/**
 * Check if the request has permission to perform a write action.
 * Requires 'write' or 'admin' permission.
 */
function hasWritePermission(permissions: string[] | undefined): boolean {
  if (!permissions) return false;
  return permissions.includes('write') || permissions.includes('admin');
}

/**
 * GET /api/v1/data/[table]/[rowId] - Fetch a single row by ID
 *
 * Requires a valid app token (any permission).
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = await validateAppToken(request);
    if (!auth.valid) {
      return errorResponse(auth.error || 'Unauthorized', 401);
    }

    const { table: tableName, rowId } = await context.params;

    const table = await db.sbTable.findUnique({ where: { name: tableName } });
    if (!table) return notFoundResponse('Table');

    const row = await db.sbRow.findFirst({
      where: { id: rowId, tableId: table.id },
    });
    if (!row) return notFoundResponse('Row');

    return successResponse({
      id: row.id,
      tableId: row.tableId,
      data: JSON.parse(row.data),
      version: row.version,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}

/**
 * PUT /api/v1/data/[table]/[rowId] - Update a row
 *
 * External apps authenticate with an app token and provide the new row data as
 * the request body. The body is merged into the existing row data (partial
 * updates are supported), the row's version is incremented, and a realtime
 * event is emitted.
 *
 * Requires "write" or "admin" permission.
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const auth = await validateAppToken(request);
    if (!auth.valid) {
      return errorResponse(auth.error || 'Unauthorized', 401);
    }

    if (!hasWritePermission(auth.permissions)) {
      return errorResponse(
        'Insufficient permissions. "write" or "admin" permission required.',
        403
      );
    }

    const { table: tableName, rowId } = await context.params;

    const table = await db.sbTable.findUnique({ where: { name: tableName } });
    if (!table) return notFoundResponse('Table');

    const existing = await db.sbRow.findFirst({
      where: { id: rowId, tableId: table.id },
    });
    if (!existing) return notFoundResponse('Row');

    const body = await parseBody(request);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return errorResponse('Request body must be a JSON object', 400);
    }

    // Merge existing data with new data (supports partial updates)
    const existingData = JSON.parse(existing.data) as Record<string, unknown>;
    const mergedData = { ...existingData, ...body };

    const updated = await db.sbRow.update({
      where: { id: rowId },
      data: {
        data: JSON.stringify(mergedData),
        version: { increment: 1 },
      },
    });

    // Refresh the table's version hash
    const newHash = createHash('sha256')
      .update(`${table.rowCount}:${new Date().toISOString()}`)
      .digest('hex')
      .substring(0, 16);
    await db.sbTable.update({
      where: { id: table.id },
      data: { versionHash: newHash },
    });

    // Emit realtime event (fire-and-forget, only if table has realtime enabled)
    const rowPayload = {
      id: updated.id,
      data: JSON.parse(updated.data),
      version: updated.version,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
    emitRealtimeEvent(table.id, 'update', { row: rowPayload, rowId: updated.id });

    return successResponse({
      id: updated.id,
      tableId: updated.tableId,
      data: JSON.parse(updated.data),
      version: updated.version,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    });
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}

/**
 * DELETE /api/v1/data/[table]/[rowId] - Delete a row
 *
 * Requires "write" or "admin" permission. The table's row count is decremented
 * and a realtime 'delete' event is emitted.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const auth = await validateAppToken(request);
    if (!auth.valid) {
      return errorResponse(auth.error || 'Unauthorized', 401);
    }

    if (!hasWritePermission(auth.permissions)) {
      return errorResponse(
        'Insufficient permissions. "write" or "admin" permission required.',
        403
      );
    }

    const { table: tableName, rowId } = await context.params;

    const table = await db.sbTable.findUnique({ where: { name: tableName } });
    if (!table) return notFoundResponse('Table');

    const existing = await db.sbRow.findFirst({
      where: { id: rowId, tableId: table.id },
    });
    if (!existing) return notFoundResponse('Row');

    await db.sbRow.delete({ where: { id: rowId } });

    // Decrement the table row count and refresh the version hash
    const newCount = Math.max(0, table.rowCount - 1);
    const newHash = createHash('sha256')
      .update(`${newCount}:${new Date().toISOString()}`)
      .digest('hex')
      .substring(0, 16);
    await db.sbTable.update({
      where: { id: table.id },
      data: { rowCount: newCount, versionHash: newHash },
    });

    // Emit realtime event (fire-and-forget, only if table has realtime enabled)
    emitRealtimeEvent(table.id, 'delete', { rowId });

    return successResponse({ deleted: true, id: rowId });
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}
