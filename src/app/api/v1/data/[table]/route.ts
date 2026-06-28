import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, notFoundResponse, parseBody, getParams } from '@/lib/api-utils';
import { validateAppToken } from '@/lib/app-auth';
import { emitRealtimeEvent } from '@/lib/realtime-emit';
import { createHash } from 'crypto';

interface RouteContext {
  params: Promise<{ table: string }>;
}

/**
 * Check if the request has permission to perform an action.
 * Requires 'write' or 'admin' permission.
 */
function hasWritePermission(permissions: string[] | undefined): boolean {
  if (!permissions) return false;
  return permissions.includes('write') || permissions.includes('admin');
}

/**
 * GET /api/v1/data/[table] - Fetch table data for SDK clients
 *
 * Implements local-first sync protocol:
 * - Returns rows with version info
 * - Supports If-None-Match header for conditional requests
 * - Returns ETag for caching
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { table: tableName } = await context.params;
    const params = getParams(request);

    // Find the table
    const table = await db.sbTable.findUnique({ where: { name: tableName } });
    if (!table) return notFoundResponse('Table');

    // Parse query parameters
    const limit = Math.min(10000, Math.max(1, parseInt(params.limit || '1000')));
    const offset = Math.max(0, parseInt(params.offset || '0'));
    const since = params.since ? new Date(params.since) : null;

    // Build where clause
    const where: any = { tableId: table.id };
    if (since) {
      where.updatedAt = { gt: since };
    }

    // Fetch rows
    const [rows, totalCount] = await Promise.all([
      db.sbRow.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.sbRow.count({ where }),
    ]);

    // Compute version hash from all row versions
    const allRows = await db.sbRow.findMany({
      where: { tableId: table.id },
      select: { id: true, version: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    });

    const versionString = allRows
      .map((r) => `${r.id}:${r.version}:${r.updatedAt.toISOString()}`)
      .join('|');

    const versionHash = createHash('sha256')
      .update(versionString || table.versionHash)
      .digest('hex')
      .substring(0, 16);

    // Update table's version hash if changed
    if (versionHash !== table.versionHash) {
      await db.sbTable.update({
        where: { id: table.id },
        data: { versionHash },
      });
    }

    // Check If-None-Match header for conditional response
    const ifNoneMatch = request.headers.get('If-None-Match');
    if (ifNoneMatch === `"${versionHash}"`) {
      return new Response(null, {
        status: 304,
        headers: {
          ETag: `"${versionHash}"`,
          'Cache-Control': 'no-cache',
        },
      });
    }

    // Parse row data
    const parsedRows = rows.map((row) => ({
      id: row.id,
      data: JSON.parse(row.data),
      version: row.version,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));

    return successResponse({
      table: {
        id: table.id,
        name: table.name,
        displayName: table.displayName,
        schema: JSON.parse(table.schema),
        versionHash,
        rowCount: table.rowCount,
      },
      rows: parsedRows,
      meta: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + rows.length < totalCount,
      },
    });
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}

/**
 * POST /api/v1/data/[table] - Insert a new row
 *
 * External apps authenticate with an app token and provide the row data as the
 * request body. The row data is stored as JSON in the `data` column.
 *
 * Requires "write" or "admin" permission.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    // Validate app token
    const auth = await validateAppToken(request);
    if (!auth.valid) {
      return errorResponse(auth.error || 'Unauthorized', 401);
    }

    // Check write permission
    if (!hasWritePermission(auth.permissions)) {
      return errorResponse(
        'Insufficient permissions. "write" or "admin" permission required.',
        403
      );
    }

    const { table: tableName } = await context.params;

    // Find the table by name
    const table = await db.sbTable.findUnique({ where: { name: tableName } });
    if (!table) return notFoundResponse('Table');

    // Parse the request body — the body itself is the row data
    const body = await parseBody(request);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return errorResponse('Request body must be a JSON object', 400);
    }

    // Create the row
    const row = await db.sbRow.create({
      data: {
        tableId: table.id,
        data: JSON.stringify(body),
      },
    });

    // Increment the table row count and refresh the version hash
    const newCount = table.rowCount + 1;
    const newHash = createHash('sha256')
      .update(`${newCount}:${new Date().toISOString()}`)
      .digest('hex')
      .substring(0, 16);
    await db.sbTable.update({
      where: { id: table.id },
      data: { rowCount: newCount, versionHash: newHash },
    });

    // Emit realtime event (fire-and-forget, only if table has realtime enabled)
    const rowPayload = {
      id: row.id,
      data: JSON.parse(row.data),
      version: row.version,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
    emitRealtimeEvent(table.id, 'insert', { row: rowPayload, rowId: row.id });

    return successResponse(
      {
        id: row.id,
        tableId: row.tableId,
        data: JSON.parse(row.data),
        version: row.version,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
      201
    );
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}
