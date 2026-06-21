import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  serverErrorResponse,
  hashPassword,
} from '@/lib/api-utils';

// GET /api/auth/users/[id] - Get a single user
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const user = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
        isActive: true,
        mfaEnabled: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        apiKeys: {
          select: { id: true, name: true, prefix: true, permissions: true, isActive: true, lastUsedAt: true, createdAt: true },
        },
        oauthProviders: {
          select: { id: true, provider: true, createdAt: true },
        },
        _count: { select: { sessions: true } },
      },
    });

    if (!user) {
      return notFoundResponse('User');
    }

    return successResponse(user);
  } catch (error) {
    return serverErrorResponse(error);
  }
}

// PUT /api/auth/users/[id] - Update a user
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) {
      return notFoundResponse('User');
    }

    const body = await request.json();
    const { email, name, password, role, avatarUrl, isActive, mfaEnabled } = body;

    // Check email uniqueness if changing
    if (email && email !== existing.email) {
      const duplicate = await db.user.findUnique({ where: { email } });
      if (duplicate) {
        return errorResponse('Email already in use');
      }
    }

    const updateData: Record<string, unknown> = {};
    if (email !== undefined) updateData.email = email;
    if (name !== undefined) updateData.name = name;
    if (role !== undefined) updateData.role = role;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (mfaEnabled !== undefined) updateData.mfaEnabled = mfaEnabled;
    if (password) {
      updateData.passwordHash = await hashPassword(password);
    }

    const updated = await db.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
        isActive: true,
        mfaEnabled: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return successResponse(updated);
  } catch (error) {
    return serverErrorResponse(error);
  }
}

// DELETE /api/auth/users/[id] - Delete a user
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) {
      return notFoundResponse('User');
    }

    // Prevent deleting the last admin
    if (existing.role === 'admin') {
      const adminCount = await db.user.count({ where: { role: 'admin' } });
      if (adminCount <= 1) {
        return errorResponse('Cannot delete the last admin user', 403);
      }
    }

    await db.user.delete({ where: { id } });

    return successResponse({ deleted: true, id });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
