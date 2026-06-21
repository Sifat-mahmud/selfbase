/**
 * Shared fetch utilities for pipeline sources.
 * Handles TLS certificate issues and HTML table scraping.
 */

export interface PipelineFetchOptions {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  skipTlsValidation?: boolean;
}

export interface PipelineFetchResult {
  ok: boolean;
  status: number;
  statusText: string;
  contentType: string;
  body: string;
  durationMs: number;
  error?: string;
}

/**
 * Fetch a URL with optional TLS certificate validation bypass.
 * Uses NODE_TLS_REJECT_UNAUTHORIZED env var for TLS bypass (surgical: set before fetch, restore after).
 */
export async function pipelineFetch(options: PipelineFetchOptions): Promise<PipelineFetchResult> {
  const { url, method = 'GET', headers = {}, timeoutMs = 30000, skipTlsValidation = true } = options;
  const startTime = Date.now();

  // Build standard headers
  const fetchHeaders: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7',
    'Accept-Language': 'en-US,en;q=0.9',
    ...headers,
  };

  // Save original TLS setting
  const originalTlsValue = process.env.NODE_TLS_REJECT_UNAUTHORIZED;

  try {
    // Bypass TLS certificate validation for self-hosted sources with self-signed/expired certs
    if (skipTlsValidation) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }

    const response = await fetch(url, {
      method,
      headers: fetchHeaders,
      signal: AbortSignal.timeout(timeoutMs),
    });

    const body = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get('content-type') || '',
      body,
      durationMs: Date.now() - startTime,
    };
  } catch (fetchError) {
    return {
      ok: false,
      status: 0,
      statusText: '',
      contentType: '',
      body: '',
      durationMs: Date.now() - startTime,
      error: fetchError instanceof Error ? fetchError.message : 'Fetch failed',
    };
  } finally {
    // Restore original TLS setting
    if (skipTlsValidation) {
      if (originalTlsValue === undefined) {
        delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      } else {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTlsValue;
      }
    }
  }
}

export interface ScrapedTable {
  headers: string[];
  rows: Record<string, string>[];
}

/**
 * Scrape HTML tables from a response body.
 * Uses regex-based parsing to extract table rows from HTML <table> elements.
 */
export function scrapeHtmlTables(html: string): ScrapedTable {
  // Try to find a table - prefer tables with id="dataTable" or class containing "data"
  const tableMatch = html.match(/<table[^>]*id=["']dataTable["'][^>]*>([\s\S]*?)<\/table>/i)
    || html.match(/<table[^>]*class=["'][^"']*data[^"']*["'][^>]*>([\s\S]*?)<\/table>/i)
    || html.match(/<table[^>]*class=["'][^"']*table[^"']*["'][^>]*>([\s\S]*?)<\/table>/i)
    || html.match(/<table[^>]*>([\s\S]*?)<\/table>/i);

  if (!tableMatch) {
    return { headers: [], rows: [] };
  }

  const tableContent = tableMatch[1];

  // Extract headers from <thead> first, then fallback to any <th>
  let headerSection = tableContent;
  const theadMatch = tableContent.match(/<thead[^>]*>([\s\S]*?)<\/thead>/i);
  if (theadMatch) {
    headerSection = theadMatch[1];
  }

  const headerMatches = [...headerSection.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)];
  const headers = headerMatches.map(m => {
    return m[1].replace(/<[^>]+>/g, '').trim();
  });

  // Extract rows from <tbody> if present, otherwise from full table
  let rowSection = tableContent;
  const tbodyMatch = tableContent.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
  if (tbodyMatch) {
    rowSection = tbodyMatch[1];
  }

  const rowMatches = [...rowSection.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  const rows: Record<string, string>[] = [];

  for (const rowMatch of rowMatches) {
    // Skip rows that contain <th> (header rows in body)
    if (/<th/i.test(rowMatch[1])) continue;

    const cellMatches = [...rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
    if (cellMatches.length === 0) continue;

    const cells = cellMatches.map(m => {
      return m[1].replace(/<[^>]+>/g, '').trim();
    });

    if (cells.length === 0 || cells.every(c => c === '')) continue;

    const row: Record<string, string> = {};
    cells.forEach((cell, i) => {
      const headerName = headers[i] || `col_${i}`;
      const key = headerName
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
      row[key] = cell;
    });

    rows.push(row);
  }

  return { headers, rows };
}

/**
 * Apply column mappings to scraped rows.
 */
export function applyColumnMappings(
  rows: Record<string, string>[],
  columnMappingsStr: string,
  limit = 20
): { mappedRows: Record<string, unknown>[]; columns: Array<{ name: string; type: string }> } {
  let mappings: Array<{ src: string; target: string; type?: string; transform?: string }> = [];
  try {
    mappings = JSON.parse(columnMappingsStr) as Array<{ src: string; target: string; type?: string; transform?: string }>;
  } catch {
    // No valid mappings
  }

  if (mappings.length > 0) {
    const mappedRows = rows.slice(0, limit).map((row) => {
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
    });
    return {
      mappedRows,
      columns: mappings.map(m => ({ name: m.target, type: m.type || 'TEXT' })),
    };
  }

  // No mappings - auto-detect from first row
  const detectedColumns = rows.length > 0
    ? Object.keys(rows[0]).map(k => ({ name: k, type: 'TEXT' as string }))
    : [];

  return {
    mappedRows: rows.slice(0, limit).map(row => {
      const mapped: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(row)) {
        // Try to auto-detect numeric values
        if (value !== '' && !isNaN(Number(value))) {
          mapped[key] = Number(value);
        } else {
          mapped[key] = value;
        }
      }
      return mapped;
    }),
    columns: detectedColumns,
  };
}
