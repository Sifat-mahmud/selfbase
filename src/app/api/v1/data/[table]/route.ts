import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, notFoundResponse, getParams } from '@/lib/api-utils';
import { createHash } from 'crypto';

interface RouteContext {
  params: Promise<{ table: string }>;
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
