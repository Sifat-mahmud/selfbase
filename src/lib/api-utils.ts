import { NextResponse } from 'next/server';

// Standard response format
interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    page: number;
    limit: number;
    total: number;
  };
}

export function successResponse<T>(data: T, status = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ success: true, data }, { status });
}

export function paginatedResponse<T>(
  data: T,
  page: number,
  limit: number,
  total: number,
  status = 200
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    { success: true, data, meta: { page, limit, total } },
    { status }
  );
}

export function errorResponse(error: string, status = 400): NextResponse<ApiResponse> {
  return NextResponse.json({ success: false, error }, { status });
}

export function notFoundResponse(resource: string): NextResponse<ApiResponse> {
  return NextResponse.json(
    { success: false, error: `${resource} not found` },
    { status: 404 }
  );
}

export function serverErrorResponse(error: unknown): NextResponse<ApiResponse> {
  const message = error instanceof Error ? error.message : 'Internal server error';
  console.error('[API Error]', message);
  return NextResponse.json(
    { success: false, error: message },
    { status: 500 }
  );
}

// Parse pagination query params
export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
  sort: string;
  order: 'asc' | 'desc';
}

export function parsePagination(url: URL | string): PaginationParams {
  const parsedUrl = typeof url === 'string' ? new URL(url) : url;
  const page = Math.max(1, parseInt(parsedUrl.searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(parsedUrl.searchParams.get('limit') || '20', 10)));
  const sort = parsedUrl.searchParams.get('sort') || 'createdAt';
  const order = parsedUrl.searchParams.get('order') === 'asc' ? 'asc' : 'desc';
  const skip = (page - 1) * limit;
  return { page, limit, skip, sort, order };
}

// Simple hash for demo (not production-grade)
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + '__selfbase_salt__');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const computed = await hashPassword(password);
  return computed === hash;
}

// Generate API key
export function generateApiKey(): { key: string; prefix: string; keyHash: string } {
  const key = `sb_${crypto.randomUUID().replace(/-/g, '')}`;
  const prefix = key.substring(0, 8);
  // Simple hash for the key - in production use proper hashing
  const keyHash = key; // Store the full key for demo purposes; in production, hash it
  return { key, prefix, keyHash };
}

// Parse request body
export async function parseBody(request: Request): Promise<any> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

// Get query params from a Request URL
export function getParams(request: Request): Record<string, string> {
  try {
    const url = new URL(request.url);
    const params: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    return params;
  } catch {
    return {};
  }
}

// Generate version hash from data
export function generateVersionHash(rowCount: number, updatedAt: string): string {
  const raw = `${rowCount}:${updatedAt}`;
  // Simple hash for demo
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}
