import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  verifyPassword,
} from '@/lib/api-utils';

// POST /api/auth/login - Authenticate and return session token
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return errorResponse('Email and password are required');
    }

    // Find user by email
    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
      return errorResponse('Invalid email or password', 401);
    }

    // Check if user is active
    if (!user.isActive) {
      return errorResponse('Account is disabled', 403);
    }

    // Verify password
    const isValid = await verifyPassword(password, user.passwordHash || '');
    if (!isValid) {
      return errorResponse('Invalid email or password', 401);
    }

    // Generate a session token
    const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, '');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24h session

    // Get request metadata
    const userAgent = request.headers.get('user-agent') || null;
    const forwarded = request.headers.get('x-forwarded-for');
    const ipAddress = forwarded ? forwarded.split(',')[0]?.trim() : null;

    // Create session
    const session = await db.session.create({
      data: {
        userId: user.id,
        token,
        userAgent,
        ipAddress,
        expiresAt,
      },
    });

    // Update last login
    await db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return successResponse({
      token: session.token,
      expiresAt: session.expiresAt.toISOString(),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
