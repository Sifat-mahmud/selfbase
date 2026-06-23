/**
 * Server-side utility to emit real-time events to the Socket.IO service.
 * Called from API route handlers after row CRUD operations.
 * 
 * Architecture:
 *   API Route → emitRealtimeEvent() → HTTP POST to Socket.IO service → broadcasts to subscribers
 * 
 * This uses HTTP instead of socket.io-client because:
 * 1. API routes run in Node.js serverless context (no persistent connections)
 * 2. The Socket.IO service already handles subscription management
 * 3. Simple fire-and-forget approach with no dependency on socket.io-client
 */

import { db } from '@/lib/db'

interface RealtimeEventPayload {
  tableId: string
  tableName: string
  eventType: 'insert' | 'update' | 'delete'
  row?: any
  rowId?: string
  versionHash?: string
  rowCount?: number
}

const REALTIME_SERVICE_URL = 'http://localhost:3003'

/**
 * Emit a data change event and version change event to the Socket.IO realtime service.
 * Only emits if the table has `enableRealtime` set to true.
 * 
 * This is a fire-and-forget operation — errors are logged but don't fail the API request.
 */
export async function emitRealtimeEvent(
  tableId: string,
  eventType: 'insert' | 'update' | 'delete',
  data: { row?: any; rowId?: string }
) {
  try {
    // Check if realtime is enabled for this table
    const table = await db.sbTable.findUnique({
      where: { id: tableId },
      select: { enableRealtime: true, name: true, versionHash: true, rowCount: true },
    })

    if (!table || !table.enableRealtime) {
      return // Realtime not enabled, skip
    }

    const payload: RealtimeEventPayload = {
      tableId,
      tableName: table.name,
      eventType,
      ...data,
      versionHash: table.versionHash,
      rowCount: table.rowCount,
    }

    // Emit data-changed event (fire-and-forget)
    fetch(`${REALTIME_SERVICE_URL}/emit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'data-changed',
        room: `table:${tableId}`,
        data: {
          table: table.name,
          tableId,
          eventType,
          row: data.row,
          rowId: data.rowId,
          versionHash: table.versionHash,
          rowCount: table.rowCount,
          timestamp: new Date().toISOString(),
        },
      }),
    }).catch(() => { /* fire-and-forget */ })

    // Also emit version-changed event
    fetch(`${REALTIME_SERVICE_URL}/emit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'update-available',
        room: `table:${tableId}`,
        data: {
          table: table.name,
          tableId,
          versionHash: table.versionHash,
          rowCount: table.rowCount,
          eventType,
          timestamp: new Date().toISOString(),
        },
      }),
    }).catch(() => { /* fire-and-forget */ })
  } catch (err) {
    // Don't fail the API request if realtime emission fails
    console.error('[Realtime Emit] Failed:', err)
  }
}
