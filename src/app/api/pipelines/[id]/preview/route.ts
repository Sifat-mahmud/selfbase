import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  serverErrorResponse,
} from '@/lib/api-utils';

// POST /api/pipelines/[id]/preview - Dry-run fetch, return preview rows without writing to DB
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const source = await db.pipelineSource.findUnique({ where: { id } });
    if (!source) {
      return notFoundResponse('Pipeline source');
    }

    const body = await request.json().catch(() => ({}));
    // Allow overriding URL and column mappings for preview
    const fetchUrl = body.url || source.url;
    const method = body.method || source.method || 'GET';
    const customHeaders = body.headers
      ? JSON.stringify(body.headers)
      : source.headers;
    const columnMappings = body.columnMappings
      ? JSON.stringify(body.columnMappings)
      : source.columnMappings;

    // SSRF protection check
    if (source.ssrfProtection) {
      const parsedUrl = new URL(fetchUrl);
      const blockedProtocols = ['file:', 'ftp:', 'data:'];
      if (blockedProtocols.includes(parsedUrl.protocol)) {
        return errorResponse('Blocked protocol due to SSRF protection', 403);
      }
      const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
      if (blockedHosts.includes(parsedUrl.hostname)) {
        return errorResponse('Blocked internal address due to SSRF protection', 403);
      }
    }

    // Build fetch headers
    const headers: Record<string, string> = {};
    if (customHeaders) {
      try {
        const parsed = JSON.parse(customHeaders) as Record<string, string>;
        Object.assign(headers, parsed);
      } catch {
        // Ignore invalid headers
      }
    }

    // Add auth headers
    if (source.authType && source.authConfig) {
      try {
        const authConfig = JSON.parse(source.authConfig) as Record<string, string>;
        switch (source.authType) {
          case 'bearer':
            headers['Authorization'] = `Bearer ${authConfig.token || ''}`;
            break;
          case 'basic': {
            const encoded = Buffer.from(
              `${authConfig.username || ''}:${authConfig.password || ''}`
            ).toString('base64');
            headers['Authorization'] = `Basic ${encoded}`;
            break;
          }
          case 'api_key':
            if (authConfig.headerName && authConfig.apiKey) {
              headers[authConfig.headerName] = authConfig.apiKey;
            }
            break;
        }
      } catch {
        // Ignore invalid auth config
      }
    }

    // Perform the fetch
    const startTime = Date.now();
    let response: Response;
    try {
      response = await fetch(fetchUrl, {
        method,
        headers,
        signal: AbortSignal.timeout(source.timeoutMs || 30000),
      });
    } catch (fetchError) {
      return successResponse({
        success: false,
        error: fetchError instanceof Error ? fetchError.message : 'Fetch failed',
        url: fetchUrl,
        method,
        durationMs: Date.now() - startTime,
      });
    }

    const durationMs = Date.now() - startTime;

    if (!response.ok) {
      return successResponse({
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
        url: fetchUrl,
        method,
        statusCode: response.status,
        durationMs,
      });
    }

    const responseText = await response.text();
    let responseData: unknown;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      return successResponse({
        success: false,
        error: 'Response is not valid JSON',
        url: fetchUrl,
        method,
        durationMs,
        responsePreview: responseText.substring(0, 500),
      });
    }

    // Apply JSONPath extraction (simplified - extract array from path)
    let extractedData = responseData;
    if (source.jsonPath) {
      const paths = source.jsonPath.split('.').filter(Boolean);
      let current: unknown = responseData;
      for (const path of paths) {
        if (current && typeof current === 'object' && path in current) {
          current = (current as Record<string, unknown>)[path];
        } else {
          current = null;
          break;
        }
      }
      extractedData = current;
    }

    // Ensure we have an array
    const rows = Array.isArray(extractedData) ? extractedData : [extractedData];

    // Apply column mappings
    const mappings = JSON.parse(columnMappings) as Array<{
      src: string;
      target: string;
      type?: string;
      transform?: string;
    }>;

    const mappedRows = mappings.length > 0
      ? rows.slice(0, 20).map((row: Record<string, unknown>) => {
          const mapped: Record<string, unknown> = {};
          for (const mapping of mappings) {
            let value = row[mapping.src];
            if (mapping.transform === 'toString') value = String(value);
            else if (mapping.transform === 'toNumber') value = Number(value);
            else if (mapping.transform === 'toBoolean') value = Boolean(value);
            mapped[mapping.target] = value ?? null;
          }
          return mapped;
        })
      : rows.slice(0, 20);

    return successResponse({
      success: true,
      url: fetchUrl,
      method,
      statusCode: response.status,
      durationMs,
      totalRows: rows.length,
      previewRows: mappedRows,
      columns: mappings.length > 0
        ? mappings.map((m) => ({ name: m.target, type: m.type || 'TEXT' }))
        : rows.length > 0
          ? Object.keys(rows[0] as Record<string, unknown>).map((k) => ({
              name: k,
              type: 'TEXT',
            }))
          : [],
    });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
