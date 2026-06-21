import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  successResponse,
  paginatedResponse,
  errorResponse,
  serverErrorResponse,
  parsePagination,
} from '@/lib/api-utils';

// GET /api/config - Get all system config
export async function GET(request: NextRequest) {
  try {
    const { page, limit, skip } = parsePagination(request.url);

    const [configs, total] = await Promise.all([
      db.systemConfig.findMany({
        skip,
        take: limit,
        orderBy: { key: 'asc' },
      }),
      db.systemConfig.count(),
    ]);

    // Parse JSON values
    const data = configs.map((c) => ({
      ...c,
      value: tryParseJson(c.value),
    }));

    return paginatedResponse(data, page, limit, total);
  } catch (error) {
    return serverErrorResponse(error);
  }
}

// POST /api/config - Set a config value (create or update)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, value, description } = body;

    if (!key) {
      return errorResponse('Config key is required');
    }

    if (value === undefined || value === null) {
      return errorResponse('Config value is required');
    }

    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);

    // Upsert the config
    const config = await db.systemConfig.upsert({
      where: { key },
      update: {
        value: stringValue,
        ...(description !== undefined && { description }),
      },
      create: {
        key,
        value: stringValue,
        description: description || null,
      },
    });

    return successResponse({
      ...config,
      value: tryParseJson(config.value),
    }, config.createdAt === config.updatedAt ? 201 : 200);
  } catch (error) {
    return serverErrorResponse(error);
  }
}

// Helper: Try to parse JSON, return original string if not valid JSON
function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
