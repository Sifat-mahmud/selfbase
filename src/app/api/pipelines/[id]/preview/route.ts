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

    // Build fetch headers - add User-Agent for sites that block generic requests
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    };
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

    // Perform the fetch with TLS handling
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
    const contentType = response.headers.get('content-type') || '';

    // Handle HTML scraping
    if (contentType.includes('text/html') || responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html') || responseText.trim().startsWith('<HTML')) {
      return handleHtmlResponse(source, fetchUrl, method, durationMs, responseText, columnMappings);
    }

    // Handle JSON response
    let responseData: unknown;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      return successResponse({
        success: false,
        error: 'Response is not valid JSON or parseable HTML',
        url: fetchUrl,
        method,
        durationMs,
        responsePreview: responseText.substring(0, 500),
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
      sourceType: 'json',
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

/**
 * Parse HTML table data from the response.
 * Uses regex-based parsing to extract table rows from HTML tables.
 */
function handleHtmlResponse(
  source: { id: string; name: string; columnMappings: string },
  url: string,
  method: string,
  durationMs: number,
  html: string,
  columnMappingsStr: string,
) {
  // Extract table rows using regex
  // Find all <tr> blocks within <tbody> or the table
  const tableMatch = html.match(/<table[^>]*id=["']dataTable["'][^>]*>([\s\S]*?)<\/table>/i)
    || html.match(/<table[^>]*class=["'][^"']*dataTable[^"']*["'][^>]*>([\s\S]*?)<\/table>/i)
    || html.match(/<table[^>]*>([\s\S]*?)<\/table>/i);

  if (!tableMatch) {
    return successResponse({
      success: false,
      error: 'No HTML table found in the response',
      url,
      method,
      durationMs,
      sourceType: 'html',
      responsePreview: html.substring(0, 500),
    });
  }

  const tableContent = tableMatch[1];

  // Extract headers
  const headerMatches = [...tableContent.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)];
  const headers = headerMatches.map(m => {
    // Remove HTML tags from header text
    return m[1].replace(/<[^>]+>/g, '').trim();
  });

  // Extract rows
  const rowMatches = [...tableContent.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  const rows: Record<string, string>[] = [];

  for (const rowMatch of rowMatches) {
    const cellMatches = [...rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
    if (cellMatches.length === 0) continue; // Skip header rows

    const cells = cellMatches.map(m => {
      // Remove HTML tags and clean up whitespace
      const text = m[1].replace(/<[^>]+>/g, '').trim();
      return text;
    });

    if (cells.length === 0) continue;

    // Map cells to header names or positional names
    const row: Record<string, string> = {};
    cells.forEach((cell, i) => {
      const headerName = headers[i] || `col_${i}`;
      // Normalize header name to a clean column key
      const key = headerName
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
      row[key] = cell;
    });

    rows.push(row);
  }

  // Apply column mappings
  const mappings = JSON.parse(columnMappingsStr) as Array<{
    src: string;
    target: string;
    type?: string;
    transform?: string;
  }>;

  const mappedRows = mappings.length > 0
    ? rows.slice(0, 20).map((row) => {
        const mapped: Record<string, unknown> = {};
        for (const mapping of mappings) {
          let value: unknown = row[mapping.src] ?? null;
          if (value !== null && mapping.type === 'DECIMAL') {
            value = parseFloat(String(value)) || 0;
          } else if (value !== null && mapping.type === 'INTEGER') {
            value = parseInt(String(value), 10) || 0;
          } else if (value !== null && mapping.type === 'BOOLEAN') {
            value = Boolean(value);
          }
          mapped[mapping.target] = value;
        }
        return mapped;
      })
    : rows.slice(0, 20);

  // Auto-detect columns from first row if no mappings
  const detectedColumns = rows.length > 0
    ? Object.keys(rows[0]).map(k => ({ name: k, type: 'TEXT' as string }))
    : [];

  return successResponse({
    success: true,
    url,
    method,
    statusCode: 200,
    durationMs,
    sourceType: 'html',
    totalRows: rows.length,
    detectedHeaders: headers,
    previewRows: mappedRows.length > 0 ? mappedRows : rows.slice(0, 10),
    columns: mappings.length > 0
      ? mappings.map((m) => ({ name: m.target, type: m.type || 'TEXT' }))
      : detectedColumns,
  });
}
