import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  successResponse,
  notFoundResponse,
  serverErrorResponse,
} from '@/lib/api-utils';

// DELETE /api/auth/api-keys/[id] - Delete (revoke) an API key
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await db.apiKey.findUnique({ where: { id } });
    if (!existing) {
      return notFoundResponse('API key');
    }

    await db.apiKey.delete({ where: { id } });

    return successResponse({ deleted: true, id });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
