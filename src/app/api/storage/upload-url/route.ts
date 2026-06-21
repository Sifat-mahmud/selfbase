import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, parseBody } from '@/lib/api-utils';
import { randomUUID } from 'crypto';

const STORAGE_ROOT = '/home/z/my-project/storage';

/**
 * POST /api/storage/upload-url - Generate a presigned upload URL
 *
 * In a self-hosted environment, we simulate presigned URLs by generating
 * a unique upload token that can be used with a subsequent PUT request.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await parseBody(request);
    if (!body) return errorResponse('Invalid request body');

    const { fileName, bucket = 'default', mimeType, sizeBytes, isPublic = false, userId } = body;

    if (!fileName) {
      return errorResponse('fileName is required');
    }

    // Generate upload token
    const uploadToken = randomUUID();
    const fileId = randomUUID();

    // Create a pending file record in the database
    const storageFile = await db.storageFile.create({
      data: {
        id: fileId,
        name: `pending_${uploadToken}`,
        originalName: fileName,
        path: `${bucket}/pending_${uploadToken}`,
        bucket,
        mimeType: mimeType || 'application/octet-stream',
        sizeBytes: sizeBytes || 0,
        isPublic,
        metadata: JSON.stringify({ uploadToken, status: 'pending' }),
        userId: userId || null,
      },
    });

    // Build the upload URL (relative to our API)
    const uploadUrl = `/api/storage/upload?token=${uploadToken}&fileId=${fileId}`;

    return successResponse({
      uploadUrl,
      fileId,
      uploadToken,
      method: 'PUT',
      headers: {
        'Content-Type': mimeType || 'application/octet-stream',
      },
      expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour
    }, 201);
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}
