import { NextRequest } from 'next/server';
import { pipelineFetch, scrapeHtmlTables } from '@/lib/fetch-utils';
import { errorResponse, serverErrorResponse } from '@/lib/api-utils';

// ── Types ──────────────────────────────────────────────────────────────

interface DataPath {
  path: string;
  label: string;
  count: number;
  sampleKeys: string[];
}

interface DetectedColumn {
  name: string;
  type: 'INTEGER' | 'DECIMAL' | 'BOOLEAN' | 'TIMESTAMP' | 'JSON' | 'TEXT';
  sampleValues: unknown[];
  nullable: boolean;
}

interface SmartPreviewSuccess {
  success: true;
  sourceType: 'json' | 'html';
  dataPaths: DataPath[];
  selectedPath: string;
  columns: DetectedColumn[];
  previewRows: Record<string, unknown>[];
  totalRows: number;
  durationMs: number;
}

interface SmartPreviewError {
  success: false;
  error: string;
  durationMs?: number;
}

type SmartPreviewResponse = SmartPreviewSuccess | SmartPreviewError;

// ── Helpers ────────────────────────────────────────────────────────────

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/;

/**
 * Recursively walk a JSON value and find all arrays.
 * Returns an array of { path, label, count, sampleKeys } entries.
 */
function findArrayPaths(
  data: unknown,
  parentPath: string = '',
  parentLabel: string = ''
): DataPath[] {
  const results: DataPath[] = [];

  if (Array.isArray(data)) {
    // This node itself is an array
    const count = data.length;
    const sampleKeys = extractKeys(data.slice(0, 5));
    const label = parentLabel || 'Root Array';
    results.push({
      path: parentPath,
      label,
      count,
      sampleKeys,
    });
  } else if (data && typeof data === 'object') {
    // Object — recurse into each property
    const obj = data as Record<string, unknown>;
    for (const [key, value] of Object.entries(obj)) {
      const childPath = parentPath ? `${parentPath}.${key}` : key;
      const childLabel = parentLabel ? `${parentLabel} → ${key}` : key;

      if (Array.isArray(value)) {
        const count = value.length;
        const sampleKeys = extractKeys(value.slice(0, 5));
        results.push({
          path: childPath,
          label: childLabel,
          count,
          sampleKeys,
        });
      } else if (value && typeof value === 'object') {
        // Recurse deeper
        results.push(...findArrayPaths(value, childPath, childLabel));
      }
    }
  }

  return results;
}

/**
 * Extract unique keys from an array of objects (up to 5 items).
 */
function extractKeys(items: unknown[]): string[] {
  const keySet = new Set<string>();
  for (const item of items) {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      for (const key of Object.keys(item as Record<string, unknown>)) {
        keySet.add(key);
      }
    }
  }
  return Array.from(keySet);
}

/**
 * Resolve a dot-notation path on a JSON object.
 */
function resolvePath(data: unknown, path: string): unknown {
  if (!path) return data;
  const parts = path.split('.');
  let current: unknown = data;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return null;
    }
  }
  return current;
}

/**
 * Detect the column type from sample values.
 */
function detectColumnType(values: unknown[]): {
  type: DetectedColumn['type'];
  nullable: boolean;
} {
  const nonNullValues = values.filter((v) => v !== null && v !== undefined);
  const nullable = nonNullValues.length < values.length;

  if (nonNullValues.length === 0) {
    return { type: 'TEXT', nullable: true };
  }

  // Check BOOLEAN
  const allBooleanish = nonNullValues.every(
    (v) =>
      typeof v === 'boolean' ||
      v === 'true' ||
      v === 'false' ||
      v === 1 ||
      v === 0
  );
  if (allBooleanish) {
    // Distinguish boolean from integer: if values are only true/false strings or booleans
    const onlyBoolLike = nonNullValues.every(
      (v) => typeof v === 'boolean' || v === 'true' || v === 'false'
    );
    if (onlyBoolLike) {
      return { type: 'BOOLEAN', nullable };
    }
  }

  // Check if all values are numbers
  const allNumbers = nonNullValues.every(
    (v) => typeof v === 'number' || (typeof v === 'string' && !isNaN(Number(v)) && v.trim() !== '')
  );

  if (allNumbers) {
    const numericValues = nonNullValues.map((v) =>
      typeof v === 'number' ? v : Number(v)
    );
    const allWhole = numericValues.every(
      (v) => Number.isInteger(v) && Math.abs(v) < Number.MAX_SAFE_INTEGER
    );
    if (allWhole) {
      return { type: 'INTEGER', nullable };
    }
    return { type: 'DECIMAL', nullable };
  }

  // Check TIMESTAMP (ISO date strings)
  const allIsoDates = nonNullValues.every(
    (v) => typeof v === 'string' && ISO_DATE_REGEX.test(v)
  );
  if (allIsoDates) {
    return { type: 'TIMESTAMP', nullable };
  }

  // Check JSON
  const allJson = nonNullValues.every((v) => {
    if (typeof v === 'object') return true;
    if (typeof v === 'string') {
      try {
        const parsed = JSON.parse(v);
        return (typeof parsed === 'object' && parsed !== null);
      } catch {
        return false;
      }
    }
    return false;
  });
  if (allJson) {
    return { type: 'JSON', nullable };
  }

  return { type: 'TEXT', nullable };
}

/**
 * Auto-detect columns from an array of objects.
 */
function detectColumns(rows: Record<string, unknown>[]): DetectedColumn[] {
  if (rows.length === 0) return [];

  // Gather all keys across all rows
  const keySet = new Set<string>();
  for (const row of rows.slice(0, 20)) {
    for (const key of Object.keys(row)) {
      keySet.add(key);
    }
  }
  const allKeys = Array.from(keySet);

  return allKeys.map((name) => {
    // Sample first 10 values
    const sampleValues = rows.slice(0, 10).map((row) => row[name]);

    const { type, nullable } = detectColumnType(sampleValues);

    // Collect first 3 unique non-null sample values
    const seen = new Set<string>();
    const uniqueSamples: unknown[] = [];
    for (const v of sampleValues) {
      if (v !== null && v !== undefined) {
        const key = JSON.stringify(v);
        if (!seen.has(key)) {
          seen.add(key);
          uniqueSamples.push(v);
          if (uniqueSamples.length >= 3) break;
        }
      }
    }

    return {
      name,
      type,
      sampleValues: uniqueSamples,
      nullable,
    };
  });
}

/**
 * SSRF protection — block internal addresses and dangerous protocols.
 */
function isSsrfSafe(url: string): { safe: boolean; reason?: string } {
  try {
    const parsed = new URL(url);
    const blockedProtocols = ['file:', 'ftp:', 'data:'];
    if (blockedProtocols.includes(parsed.protocol)) {
      return { safe: false, reason: `Blocked protocol: ${parsed.protocol}` };
    }
    const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
    if (blockedHosts.includes(parsed.hostname)) {
      return { safe: false, reason: 'Blocked internal address due to SSRF protection' };
    }
    return { safe: true };
  } catch {
    return { safe: false, reason: 'Invalid URL' };
  }
}

// ── Route Handler ──────────────────────────────────────────────────────

// POST /api/pipelines/smart-preview
export async function POST(request: NextRequest): Promise<Response> {
  const startTime = Date.now();

  try {
    const body = (await request.json().catch(() => ({}))) as {
      url?: string;
      method?: string;
      headers?: Record<string, string>;
    };

    const { url, method = 'GET', headers = {} } = body;

    if (!url) {
      return errorResponse('URL is required');
    }

    // SSRF protection
    const ssrfCheck = isSsrfSafe(url);
    if (!ssrfCheck.safe) {
      return errorResponse(ssrfCheck.reason || 'SSRF protection blocked this URL', 403);
    }

    // Fetch the URL
    const result = await pipelineFetch({
      url,
      method,
      headers,
      timeoutMs: 30000,
      skipTlsValidation: true,
    });

    const durationMs = Date.now() - startTime;

    if (result.error) {
      return Response.json({
        success: false,
        error: result.error,
        durationMs,
      } satisfies SmartPreviewError);
    }

    if (!result.ok) {
      return Response.json({
        success: false,
        error: `HTTP ${result.status}: ${result.statusText}`,
        durationMs,
      } satisfies SmartPreviewError);
    }

    // Detect response type
    const isHtml =
      result.contentType.includes('text/html') ||
      result.body.trim().startsWith('<!DOCTYPE') ||
      result.body.trim().startsWith('<html') ||
      result.body.trim().startsWith('<HTML');

    if (isHtml) {
      return handleHtmlResponse(result.body, durationMs);
    }

    return handleJsonResponse(result.body, durationMs);
  } catch (error) {
    const durationMs = Date.now() - startTime;
    console.error('[smart-preview] Error:', error);
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      durationMs,
    } satisfies SmartPreviewError);
  }
}

// ── HTML Handler ───────────────────────────────────────────────────────

function handleHtmlResponse(html: string, durationMs: number): Response {
  const scraped = scrapeHtmlTables(html);

  if (scraped.rows.length === 0) {
    return Response.json({
      success: false,
      error: 'No tabular data found in the HTML response',
      durationMs,
    } satisfies SmartPreviewError);
  }

  const rows = scraped.rows as unknown as Record<string, unknown>[];
  const columns = detectColumns(rows);
  const previewRows = rows.slice(0, 5);
  const totalRows = rows.length;

  // Build a single data path for HTML tables
  const dataPaths: DataPath[] = [
    {
      path: '',
      label: 'HTML Table',
      count: totalRows,
      sampleKeys: columns.slice(0, 10).map((c) => c.name),
    },
  ];

  return Response.json({
    success: true,
    sourceType: 'html',
    dataPaths,
    selectedPath: '',
    columns,
    previewRows,
    totalRows,
    durationMs,
  } satisfies SmartPreviewSuccess);
}

// ── JSON Handler ───────────────────────────────────────────────────────

function handleJsonResponse(body: string, durationMs: number): Response {
  let responseData: unknown;
  try {
    responseData = JSON.parse(body);
  } catch {
    return Response.json({
      success: false,
      error: 'Response is not valid JSON',
      durationMs,
    } satisfies SmartPreviewError);
  }

  // Find all array paths
  let dataPaths = findArrayPaths(responseData);

  let selectedPath = '';
  let selectedArray: unknown[] | null = null;

  if (dataPaths.length > 0) {
    // Auto-select the best path:
    // 1. Prefer root array (path === "")
    // 2. Otherwise pick the first array with the most items
    const rootArray = dataPaths.find((p) => p.path === '');
    if (rootArray) {
      selectedPath = '';
      selectedArray = responseData as unknown[];
    } else {
      // Pick the array with the most items
      dataPaths = dataPaths.sort((a, b) => b.count - a.count);
      selectedPath = dataPaths[0].path;
      selectedArray = resolvePath(responseData, selectedPath) as unknown[];
    }
  } else if (responseData && typeof responseData === 'object' && !Array.isArray(responseData)) {
    // No arrays found — wrap the single object in an array
    selectedArray = [responseData];
    dataPaths = [
      {
        path: '',
        label: 'Single Object (wrapped)',
        count: 1,
        sampleKeys: extractKeys([responseData]),
      },
    ];
    selectedPath = '';
  } else {
    return Response.json({
      success: false,
      error: 'No tabular data found in the response',
      durationMs,
    } satisfies SmartPreviewError);
  }

  if (!Array.isArray(selectedArray) || selectedArray.length === 0) {
    return Response.json({
      success: false,
      error: 'No tabular data found in the response',
      durationMs,
    } satisfies SmartPreviewError);
  }

  // Ensure all items are objects; skip primitives
  const objectRows = selectedArray.filter(
    (item) => item && typeof item === 'object' && !Array.isArray(item)
  ) as Record<string, unknown>[];

  if (objectRows.length === 0) {
    // All items are primitives — wrap them
    const wrappedRows = selectedArray.map((v, i) => ({
      id: i + 1,
      value: v,
    }));
    const columns = detectColumns(wrappedRows);
    const previewRows = wrappedRows.slice(0, 5);
    const totalRows = wrappedRows.length;

    return Response.json({
      success: true,
      sourceType: 'json',
      dataPaths: [
        {
          path: selectedPath,
          label: selectedPath ? dataPaths[0]?.label || selectedPath : 'Root Array (primitives)',
          count: totalRows,
          sampleKeys: ['id', 'value'],
        },
      ],
      selectedPath,
      columns,
      previewRows,
      totalRows,
      durationMs,
    } satisfies SmartPreviewSuccess);
  }

  const columns = detectColumns(objectRows);
  const previewRows = objectRows.slice(0, 5);
  const totalRows = objectRows.length;

  return Response.json({
    success: true,
    sourceType: 'json',
    dataPaths,
    selectedPath,
    columns,
    previewRows,
    totalRows,
    durationMs,
  } satisfies SmartPreviewSuccess);
}
