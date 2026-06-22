import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, notFoundResponse } from '@/lib/api-utils';
import { readFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';

const STORAGE_ROOT = '/home/z/my-project/storage';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/storage/[id] - Get file info (or download file)
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const file = await db.storageFile.findUnique({ where: { id } });
    if (!file) return notFoundResponse('File');

    // If download query param, return the actual file
    const { searchParams } = new URL(request.url);
    if (searchParams.get('download') === 'true') {
      const fullPath = join(STORAGE_ROOT, file.path);
      if (!existsSync(fullPath)) {
        return errorResponse('File not found on disk', 404);
      }

      const buffer = readFileSync(fullPath);
      return new Response(buffer, {
        headers: {
          'Content-Type': file.mimeType || 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${file.originalName}"`,
          'Content-Length': buffer.length.toString(),
        },
      });
    }

    return successResponse(file);
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}

/**
 * DELETE /api/storage/[id] - Delete a file
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const file = await db.storageFile.findUnique({ where: { id } });
    if (!file) return notFoundResponse('File');

    // Delete physical file
    const fullPath = join(STORAGE_ROOT, file.path);
    if (existsSync(fullPath)) {
      try {
        unlinkSync(fullPath);
      } catch {
        // Log but don't fail if file is already gone
      }
    }

    // Delete database record
    await db.storageFile.delete({ where: { id } });

    return successResponse({ deleted: true });
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}
