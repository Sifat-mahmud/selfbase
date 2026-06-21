import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  serverErrorResponse,
} from '@/lib/api-utils';

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

    // Simulate running the pipeline (in production this would be a background job)
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

      let fetchResult: Response;
      try {
        fetchResult = await fetch(source.url, {
          method: source.method || 'GET',
          headers,
          signal: AbortSignal.timeout(source.timeoutMs || 30000),
        });
      } catch (fetchError) {
        const durationMs = Date.now() - startTime;
        await db.pipelineRun.update({
          where: { id: run.id },
          data: {
            status: 'failed',
            durationMs,
            errorPayload: JSON.stringify({
              error: fetchError instanceof Error ? fetchError.message : 'Fetch failed',
            }),
            completedAt: new Date(),
          },
        });
        return successResponse({
          runId: run.id,
          status: 'failed',
          error: fetchError instanceof Error ? fetchError.message : 'Fetch failed',
        });
      }

      const responseText = await fetchResult.text();
      const durationMs = Date.now() - startTime;

      if (!fetchResult.ok) {
        await db.pipelineRun.update({
          where: { id: run.id },
          data: {
            status: 'failed',
            durationMs,
            errorPayload: JSON.stringify({
              statusCode: fetchResult.status,
              error: responseText.substring(0, 1000),
            }),
            completedAt: new Date(),
          },
        });
        return successResponse({
          runId: run.id,
          status: 'failed',
          error: `HTTP ${fetchResult.status}`,
        });
      }

      // Parse and extract data
      let responseData: unknown;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        await db.pipelineRun.update({
          where: { id: run.id },
          data: {
            status: 'failed',
            durationMs,
            rowsFetched: 0,
            errorPayload: JSON.stringify({ error: 'Response is not valid JSON' }),
            completedAt: new Date(),
          },
        });
        return successResponse({
          runId: run.id,
          status: 'failed',
          error: 'Response is not valid JSON',
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
      const columnMappings = JSON.parse(source.columnMappings) as Array<{
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
                  dataToWrite[mapping.target] = rowData[mapping.src] ?? null;
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
