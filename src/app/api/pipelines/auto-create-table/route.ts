import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, serverErrorResponse } from '@/lib/api-utils';

// ── Types ──────────────────────────────────────────────────────────────

interface ColumnInput {
  name: string;
  type: string; // TEXT, INTEGER, DECIMAL, BOOLEAN, TIMESTAMP, JSON
  isPrimaryKey?: boolean;
  isUnique?: boolean;
  isIndexed?: boolean;
  nullable?: boolean;
  defaultValue?: string;
}

interface AutoCreateTableBody {
  name: string;
  columns: ColumnInput[];
  displayName?: string;
  description?: string;
}

// ── Route Handler ──────────────────────────────────────────────────────

// POST /api/pipelines/auto-create-table
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body = (await request.json().catch(() => ({}))) as AutoCreateTableBody;

    const { name, columns, displayName, description } = body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return errorResponse('Table name is required');
    }

    if (!columns || !Array.isArray(columns) || columns.length === 0) {
      return errorResponse('At least one column is required');
    }

    // Validate table name format (alphanumeric + underscores)
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      return errorResponse(
        'Table name must start with a letter or underscore and contain only alphanumeric characters and underscores'
      );
    }

    // Check if table with this name already exists
    const existing = await db.sbTable.findUnique({ where: { name } });
    if (existing) {
      return errorResponse(`Table with name "${name}" already exists`);
    }

    // Validate column names
    for (const col of columns) {
      if (!col.name || typeof col.name !== 'string' || col.name.trim() === '') {
        return errorResponse('Each column must have a name');
      }
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(col.name)) {
        return errorResponse(
          `Column name "${col.name}" must start with a letter or underscore and contain only alphanumeric characters and underscores`
        );
      }
      const validTypes = ['TEXT', 'INTEGER', 'DECIMAL', 'BOOLEAN', 'TIMESTAMP', 'JSON'];
      if (!validTypes.includes(col.type.toUpperCase())) {
        return errorResponse(
          `Column "${col.name}" has invalid type "${col.type}". Valid types: ${validTypes.join(', ')}`
        );
      }
    }

    // Check for duplicate column names
    const columnNames = columns.map((c) => c.name);
    const duplicates = columnNames.filter((n, i) => columnNames.indexOf(n) !== i);
    if (duplicates.length > 0) {
      return errorResponse(`Duplicate column names: ${duplicates.join(', ')}`);
    }

    // Create the table
    const table = await db.sbTable.create({
      data: {
        name,
        displayName: displayName || name,
        description: description || `Auto-created table from pipeline`,
        schema: JSON.stringify(
          columns.map((col) => ({
            name: col.name,
            type: col.type.toUpperCase(),
            nullable: col.nullable !== false,
            isPrimaryKey: col.isPrimaryKey || false,
            isUnique: col.isUnique || false,
            isIndexed: col.isIndexed || false,
            defaultValue: col.defaultValue || null,
          }))
        ),
        columns: {
          create: columns.map((col, index) => ({
            name: col.name,
            type: col.type.toUpperCase(),
            nullable: col.nullable !== false,
            defaultValue: col.defaultValue || null,
            isPrimaryKey: col.isPrimaryKey || false,
            isUnique: col.isUnique || false,
            isIndexed: col.isIndexed || false,
            order: index,
          })),
        },
      },
      include: {
        columns: {
          orderBy: { order: 'asc' },
        },
      },
    });

    return successResponse(table, 201);
  } catch (error) {
    return serverErrorResponse(error);
  }
}
