import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, getParams } from '@/lib/api-utils';
import { validateAppToken } from '@/lib/app-auth';

interface TableListRow {
  id: string;
  name: string;
  displayName: string | null;
  description: string | null;
  rowCount: number;
  enableRealtime: boolean;
  columns: Array<{
    id: string;
    name: string;
    type: string;
    nullable: boolean;
    isUnique: boolean;
    isPrimaryKey: boolean;
    isIndexed: boolean;
    order: number;
  }>;
  updatedAt: Date;
}

/**
 * GET /api/v1/tables - List tables for app discovery
 *
 * External apps authenticate with an app token to discover what tables exist
 * and their column schemas (for client-side validation / form rendering).
 * Sensitive fields (RLS rules, system flags) are not exposed.
 *
 * Any permission (read, write, admin) is allowed to list tables.
 *
 * Query params:
 *  - includeSystem: "true" to include system tables (default: false)
 *  - search: filter by name/displayName (case-insensitive contains)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await validateAppToken(request);
    if (!auth.valid) {
      return errorResponse(auth.error || 'Unauthorized', 401);
    }

    const params = getParams(request);
    const includeSystem = params.includeSystem === 'true';
    const search = params.search?.trim() || '';

    // Build where clause
    const where: any = {};
    if (!includeSystem) {
      where.isSystem = false;
    }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { displayName: { contains: search } },
      ];
    }

    const tables = await db.sbTable.findMany({
      where,
      select: {
        id: true,
        name: true,
        displayName: true,
        description: true,
        rowCount: true,
        enableRealtime: true,
        updatedAt: true,
        columns: {
          select: {
            id: true,
            name: true,
            type: true,
            nullable: true,
            isUnique: true,
            isPrimaryKey: true,
            isIndexed: true,
            order: true,
          },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    const rows: TableListRow[] = tables;

    return successResponse({
      tables: rows,
      count: rows.length,
    });
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}
