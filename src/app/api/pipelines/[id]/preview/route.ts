import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  serverErrorResponse,
} from '@/lib/api-utils';
import { pipelineFetch, scrapeHtmlTables, applyColumnMappings } from '@/lib/fetch-utils';

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

    // Use pipelineFetch which handles TLS bypass
    const result = await pipelineFetch({
      url: fetchUrl,
      method,
      headers,
      timeoutMs: source.timeoutMs || 30000,
      skipTlsValidation: true,
    });

    if (result.error) {
      return successResponse({
        success: false,
        error: result.error,
        url: fetchUrl,
        method,
        durationMs: result.durationMs,
      });
    }

    if (!result.ok) {
      return successResponse({
        success: false,
        error: `HTTP ${result.status}: ${result.statusText}`,
        url: fetchUrl,
        method,
        statusCode: result.status,
        durationMs: result.durationMs,
      });
    }

    // Handle HTML scraping
    const isHtml = result.contentType.includes('text/html')
      || result.body.trim().startsWith('<!DOCTYPE')
      || result.body.trim().startsWith('<html')
      || result.body.trim().startsWith('<HTML');

    if (isHtml) {
      const scraped = scrapeHtmlTables(result.body);

      if (scraped.rows.length === 0) {
        return successResponse({
          success: false,
          error: 'No HTML table found in the response',
          url: fetchUrl,
          method,
          durationMs: result.durationMs,
          sourceType: 'html',
          responsePreview: result.body.substring(0, 500),
        });
      }

      const { mappedRows, columns } = applyColumnMappings(scraped.rows, columnMappings);

      return successResponse({
        success: true,
        url: fetchUrl,
        method,
        statusCode: result.status,
        durationMs: result.durationMs,
        sourceType: 'html',
        totalRows: scraped.rows.length,
        detectedHeaders: scraped.headers,
        previewRows: mappedRows,
        columns,
      });
    }

    // Handle JSON response
    let responseData: unknown;
    try {
      responseData = JSON.parse(result.body);
    } catch {
      return successResponse({
        success: false,
        error: 'Response is not valid JSON or parseable HTML',
        url: fetchUrl,
        method,
        durationMs: result.durationMs,
        responsePreview: result.body.substring(0, 500),
      });
    }

    // Apply JSONPath extraction
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

    const rows = Array.isArray(extractedData) ? extractedData : [extractedData];

    // Apply column mappings
    const { mappedRows, columns } = applyColumnMappings(
      rows as Record<string, string>[],
      columnMappings
    );

    return successResponse({
      success: true,
      url: fetchUrl,
      method,
      statusCode: result.status,
      durationMs: result.durationMs,
      sourceType: 'json',
      totalRows: rows.length,
      previewRows: mappedRows,
      columns,
    });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
