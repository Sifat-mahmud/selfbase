import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  serverErrorResponse,
} from '@/lib/api-utils';
import { pipelineFetch, scrapeHtmlTables, applyColumnMappings } from '@/lib/fetch-utils';

// POST /api/pipelines/[id]/run - Trigger a manual pipeline run
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const source = await db.pipelineSource.findUnique({ where: { id } });
    if (!source) {
      return notFoundResponse('Pipeline source');
    }

    if (!source.isActive) {
      return errorResponse('Pipeline source is not active');
    }

    // Create a pipeline run record
    const run = await db.pipelineRun.create({
      data: {
        sourceId: id,
        status: 'pending',
        isManual: true,
      },
    });

    // Run the pipeline
    try {
      await db.pipelineRun.update({
        where: { id: run.id },
        data: { status: 'running' },
      });

      const startTime = Date.now();

      // Build fetch headers
      const headers: Record<string, string> = {};
      if (source.headers) {
        try {
          Object.assign(headers, JSON.parse(source.headers));
        } catch {
          // Ignore
        }
      }

      if (source.authType && source.authConfig) {
        try {
          const authConfig = JSON.parse(source.authConfig) as Record<string, string>;
          if (source.authType === 'bearer') {
            headers['Authorization'] = `Bearer ${authConfig.token || ''}`;
          } else if (source.authType === 'basic') {
            const encoded = Buffer.from(
              `${authConfig.username || ''}:${authConfig.password || ''}`
            ).toString('base64');
            headers['Authorization'] = `Basic ${encoded}`;
          } else if (source.authType === 'api_key' && authConfig.headerName) {
            headers[authConfig.headerName] = authConfig.apiKey || '';
          }
        } catch {
          // Ignore
        }
      }

      // Use pipelineFetch which handles TLS bypass
      const result = await pipelineFetch({
        url: source.url,
        method: source.method || 'GET',
        headers,
        timeoutMs: source.timeoutMs || 30000,
        skipTlsValidation: true,
      });

      const durationMs = Date.now() - startTime;

      if (result.error) {
        await db.pipelineRun.update({
          where: { id: run.id },
          data: {
            status: 'failed',
            durationMs,
            errorPayload: JSON.stringify({ error: result.error }),
            completedAt: new Date(),
          },
        });
        return successResponse({
          runId: run.id,
          status: 'failed',
          error: result.error,
        });
      }

      if (!result.ok) {
        await db.pipelineRun.update({
          where: { id: run.id },
          data: {
            status: 'failed',
            durationMs,
            errorPayload: JSON.stringify({
              statusCode: result.status,
              error: result.statusText,
            }),
            completedAt: new Date(),
          },
        });
        return successResponse({
          runId: run.id,
          status: 'failed',
          error: `HTTP ${result.status}`,
        });
      }

      // Determine if HTML or JSON
      const isHtml = result.contentType.includes('text/html')
        || result.body.trim().startsWith('<!DOCTYPE')
        || result.body.trim().startsWith('<html')
        || result.body.trim().startsWith('<HTML');

      let rows: Record<string, unknown>[];

      if (isHtml) {
        // Handle HTML scraping
        const scraped = scrapeHtmlTables(result.body);

        if (scraped.rows.length === 0) {
          await db.pipelineRun.update({
            where: { id: run.id },
            data: {
              status: 'failed',
              durationMs,
              rowsFetched: 0,
              errorPayload: JSON.stringify({ error: 'No HTML table found in response' }),
              completedAt: new Date(),
            },
          });
          return successResponse({
            runId: run.id,
            status: 'failed',
            error: 'No HTML table found in response',
          });
        }

        // Apply column mappings to all rows
        const { mappedRows } = applyColumnMappings(scraped.rows, source.columnMappings, scraped.rows.length);
        rows = mappedRows;
      } else {
        // Handle JSON response
        let responseData: unknown;
        try {
          responseData = JSON.parse(result.body);
        } catch {
          await db.pipelineRun.update({
            where: { id: run.id },
            data: {
              status: 'failed',
              durationMs,
              rowsFetched: 0,
              errorPayload: JSON.stringify({ error: 'Response is not valid JSON or parseable HTML' }),
              completedAt: new Date(),
            },
          });
          return successResponse({
            runId: run.id,
            status: 'failed',
            error: 'Response is not valid JSON or parseable HTML',
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

        rows = Array.isArray(extractedData) ? extractedData : [extractedData];
      }

      const columnMappings = JSON.parse(source.columnMappings || '[]') as Array<{
        src: string;
        target: string;
        type?: string;
        transform?: string;
      }>;

      let rowsWritten = 0;
      let rowsFailed = 0;

      // Write to target table if specified
      if (source.targetTableId && rows.length > 0) {
        const table = await db.sbTable.findUnique({
          where: { id: source.targetTableId },
        });

        if (table) {
          for (const row of rows) {
            try {
              const rowData = row as Record<string, unknown>;
              let dataToWrite: Record<string, unknown>;

              if (columnMappings.length > 0) {
                dataToWrite = {};
                for (const mapping of columnMappings) {
                  let value = rowData[mapping.target] ?? rowData[mapping.src] ?? null;
                  if (mapping.type === 'DECIMAL' && value !== null) {
                    value = parseFloat(String(value)) || 0;
                  } else if (mapping.type === 'INTEGER' && value !== null) {
                    value = parseInt(String(value), 10) || 0;
                  }
                  dataToWrite[mapping.target] = value;
                }
              } else {
                dataToWrite = rowData;
              }

              await db.sbRow.create({
                data: {
                  tableId: table.id,
                  data: JSON.stringify(dataToWrite),
                },
              });
              rowsWritten++;
            } catch {
              rowsFailed++;
            }
          }

          // Update table row count
          await db.sbTable.update({
            where: { id: table.id },
            data: { rowCount: table.rowCount + rowsWritten },
          });
        }
      }

      await db.pipelineRun.update({
        where: { id: run.id },
        data: {
          status: 'success',
          durationMs,
          rowsFetched: rows.length,
          rowsWritten,
          rowsFailed,
          completedAt: new Date(),
        },
      });

      return successResponse({
        runId: run.id,
        status: 'success',
        rowsFetched: rows.length,
        rowsWritten,
        rowsFailed,
        durationMs,
        sourceType: isHtml ? 'html' : 'json',
      });
    } catch (runError) {
      await db.pipelineRun.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          errorPayload: JSON.stringify({
            error: runError instanceof Error ? runError.message : 'Run failed',
          }),
          completedAt: new Date(),
        },
      });
      return successResponse({
        runId: run.id,
        status: 'failed',
        error: runError instanceof Error ? runError.message : 'Run failed',
      });
    }
  } catch (error) {
    return serverErrorResponse(error);
  }
}
