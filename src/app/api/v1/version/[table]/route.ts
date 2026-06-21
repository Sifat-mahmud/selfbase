import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { notFoundResponse, errorResponse } from '@/lib/api-utils';
import { createHash } from 'crypto';

interface RouteContext {
  params: Promise<{ table: string }>;
}

/**
 * HEAD /api/v1/version/[table] - Check version, return ETag
 *
 * Implements local-first sync protocol:
 * - Returns ETag header with version hash
 * - Client can use this to check if data has changed
 * - Lightweight operation (no row data transferred)
 */
export async function HEAD(request: NextRequest, context: RouteContext) {
  try {
    const { table: tableName } = await context.params;

    // Find the table
    const table = await db.sbTable.findUnique({ where: { name: tableName } });
    if (!table) {
      return new Response(null, { status: 404 });
    }

    // Compute current version hash
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

    // Check If-None-Match header
    const ifNoneMatch = request.headers.get('If-None-Match');
    const status = ifNoneMatch === `"${versionHash}"` ? 304 : 200;

    return new Response(null, {
      status,
      headers: {
        ETag: `"${versionHash}"`,
        'Cache-Control': 'no-cache',
        'X-Row-Count': table.rowCount.toString(),
        'X-Table-Id': table.id,
        'X-Version-Hash': versionHash,
        'X-Last-Updated': allRows.length > 0 ? allRows[0].updatedAt.toISOString() : table.updatedAt.toISOString(),
      },
    });
  } catch (e: any) {
    return new Response(null, {
      status: 500,
      headers: { 'X-Error': e.message },
    });
  }
}
