import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  serverErrorResponse,
} from '@/lib/api-utils';
import { pipelineFetch, scrapeHtmlTables, applyColumnMappings } from '@/lib/fetch-utils';

// POST /api/pipelines/[id]/run - Trigger a pipeline run (manual or scheduled)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Detect if triggered by scheduler
    const isScheduler = request.headers.get('x-trigger-type') === 'scheduler';

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
        isManual: !isScheduler,
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

      // ========= TABLE WRITE LOGIC =========
      if (source.targetTableId && rows.length > 0) {
        const table = await db.sbTable.findUnique({
          where: { id: source.targetTableId },
        });

        if (table) {
          // Parse primary key columns
          const primaryKeyCols: string[] = JSON.parse(source.primaryKeyCols || '[]');

          // --- PRE-RUN ACTION ---
          if (source.preRunAction === 'truncate') {
            await db.sbRow.deleteMany({ where: { tableId: table.id } });
            await db.sbTable.update({
              where: { id: table.id },
              data: { rowCount: 0 },
            });
          } else if (source.preRunAction === 'archive') {
            // Archive: for demo, same as truncate (delete all + reset count)
            await db.sbRow.deleteMany({ where: { tableId: table.id } });
            await db.sbTable.update({
              where: { id: table.id },
              data: { rowCount: 0 },
            });
          }
          // 'none' — do nothing before insert

          // --- CONFLICT RESOLUTION ---
          const onConflict = source.onConflict || 'update';

          for (const row of rows) {
            try {
              const rowData = row as Record<string, unknown>;
              let dataToWrite: Record<string, unknown>;

              if (columnMappings.length > 0) {
                dataToWrite = {};
                for (const mapping of columnMappings) {
                  let value = rowData[mapping.target] ?? rowData[mapping.src] ?? null;
                  if (mapping.type === 'DECIMAL' && value !== null) value = parseFloat(String(value)) || 0;
                  else if (mapping.type === 'INTEGER' && value !== null) value = parseInt(String(value), 10) || 0;
                  dataToWrite[mapping.target] = value;
                }
              } else {
                dataToWrite = rowData;
              }

              if (onConflict === 'truncate' || onConflict === 'insert') {
                // Always insert (truncate already cleared the table, or insert = just add)
                await db.sbRow.create({
                  data: { tableId: table.id, data: JSON.stringify(dataToWrite) },
                });
                rowsWritten++;
              } else if (primaryKeyCols.length > 0 && (onConflict === 'update' || onConflict === 'skip' || onConflict === 'replace')) {
                // UPSERT / SKIP / REPLACE logic using primary key columns
                const allTableRows = await db.sbRow.findMany({
                  where: { tableId: table.id },
                });

                let existingRow: { id: string; data: string } | null = null;
                for (const tableRow of allTableRows) {
                  try {
                    const existingData = JSON.parse(tableRow.data) as Record<string, unknown>;
                    const matchesAllKeys = primaryKeyCols.every(pkCol => {
                      const pkValue = dataToWrite[pkCol];
                      const existingValue = existingData[pkCol];
                      return pkValue !== undefined && String(pkValue) === String(existingValue);
                    });
                    if (matchesAllKeys) {
                      existingRow = tableRow;
                      break;
                    }
                  } catch { continue; }
                }

                if (existingRow) {
                  if (onConflict === 'update') {
                    // Merge: new data overwrites existing data, keep non-mapped fields
                    const existingData = JSON.parse(existingRow.data) as Record<string, unknown>;
                    const merged = { ...existingData, ...dataToWrite };
                    await db.sbRow.update({
                      where: { id: existingRow.id },
                      data: {
                        data: JSON.stringify(merged),
                        version: { increment: 1 },
                      },
                    });
                    rowsWritten++;
                  } else if (onConflict === 'replace') {
                    // Full replace: overwrite with new data entirely
                    await db.sbRow.update({
                      where: { id: existingRow.id },
                      data: {
                        data: JSON.stringify(dataToWrite),
                        version: { increment: 1 },
                      },
                    });
                    rowsWritten++;
                  } else if (onConflict === 'skip') {
                    // Skip this row, don't insert or update
                  }
                } else {
                  // No existing row matching primary key — insert new
                  await db.sbRow.create({
                    data: { tableId: table.id, data: JSON.stringify(dataToWrite) },
                  });
                  rowsWritten++;
                }
              } else {
                // No primary key defined — always insert
                await db.sbRow.create({
                  data: { tableId: table.id, data: JSON.stringify(dataToWrite) },
                });
                rowsWritten++;
              }
            } catch {
              rowsFailed++;
            }
          }

          // Update table row count to actual count
          const actualCount = await db.sbRow.count({ where: { tableId: table.id } });
          await db.sbTable.update({
            where: { id: table.id },
            data: { rowCount: actualCount },
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

      // Update lastAutoRunAt for scheduler-triggered runs
      if (isScheduler) {
        await db.pipelineSource.update({
          where: { id },
          data: { lastAutoRunAt: new Date() },
        });
      }

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
