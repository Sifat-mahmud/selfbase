import { createServer } from 'http'
import { Server } from 'socket.io'

const httpServer = createServer()
const io = new Server(httpServer, {
  path: '/',
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// ==================== Types ====================

interface Subscription {
  sessionId: string
  tableId: string
  eventTypes: string[] // insert, update, delete, *
  filter?: Record<string, any>
}

interface DeferredNotification {
  sessionId: string
  tableName: string
  eventType: string
  data: any
}

interface VersionChangeEvent {
  tableId: string
  tableName: string
  versionHash: string
  rowCount: number
}

// ==================== State ====================

const subscriptions = new Map<string, Set<Subscription>>() // socketId -> subscriptions
const tableSubscribers = new Map<string, Set<string>>() // tableId -> socketIds
const sessionSockets = new Map<string, string>() // sessionId -> socketId
const loadScore = { value: 0, activeConnections: 0, reqPerSec: 0, cpuPct: 0 }

// ==================== Helpers ====================

function getSubscribersForTable(tableId: string): string[] {
  return Array.from(tableSubscribers.get(tableId) || [])
}

function broadcastToTable(tableId: string, event: string, data: any) {
  const subscriberIds = getSubscribersForTable(tableId)
  for (const socketId of subscriberIds) {
    io.to(socketId).emit(event, data)
  }
}

function updateLoadMetrics() {
  loadScore.activeConnections = io.sockets.sockets.size
  // Simple load score calculation
  loadScore.value = Math.min(100, Math.round(
    (loadScore.activeConnections * 2) +
    (loadScore.reqPerSec * 0.5) +
    (loadScore.cpuPct * 0.3)
  ))
}

// ==================== Connection Handler ====================

io.on('connection', (socket) => {
  console.log(`[SelfBase Realtime] Client connected: ${socket.id}`)
  updateLoadMetrics()

  // Send initial connection info
  socket.emit('connected', {
    socketId: socket.id,
    serverTime: new Date().toISOString(),
    loadScore: loadScore.value,
  })

  // ==================== Session Management ====================

  socket.on('register-session', (data: { sessionId: string }) => {
    sessionSockets.set(data.sessionId, socket.id)
    console.log(`[SelfBase Realtime] Session registered: ${data.sessionId} -> ${socket.id}`)
  })

  // ==================== Table Subscriptions ====================

  socket.on('subscribe', (data: {
    tableId: string
    eventTypes?: string[]
    filter?: Record<string, any>
  }) => {
    const sub: Subscription = {
      sessionId: socket.id,
      tableId: data.tableId,
      eventTypes: data.eventTypes || ['*'],
      filter: data.filter,
    }

    // Track subscription
    if (!subscriptions.has(socket.id)) {
      subscriptions.set(socket.id, new Set())
    }
    subscriptions.get(socket.id)!.add(sub)

    // Track table subscribers
    if (!tableSubscribers.has(data.tableId)) {
      tableSubscribers.set(data.tableId, new Set())
    }
    tableSubscribers.get(data.tableId)!.add(socket.id)

    // Join room for this table
    socket.join(`table:${data.tableId}`)

    socket.emit('subscribed', {
      tableId: data.tableId,
      eventTypes: sub.eventTypes,
    })

    console.log(`[SelfBase Realtime] Client ${socket.id} subscribed to table ${data.tableId}`)
  })

  socket.on('unsubscribe', (data: { tableId: string }) => {
    // Remove from subscriptions
    const subs = subscriptions.get(socket.id)
    if (subs) {
      for (const sub of subs) {
        if (sub.tableId === data.tableId) {
          subs.delete(sub)
        }
      }
    }

    // Remove from table subscribers
    const tableSubs = tableSubscribers.get(data.tableId)
    if (tableSubs) {
      tableSubs.delete(socket.id)
    }

    // Leave room
    socket.leave(`table:${data.tableId}`)

    socket.emit('unsubscribed', { tableId: data.tableId })
    console.log(`[SelfBase Realtime] Client ${socket.id} unsubscribed from table ${data.tableId}`)
  })

  // ==================== Version Change Events ====================

  socket.on('version-changed', (data: VersionChangeEvent) => {
    // Broadcast version change to all subscribers of this table
    io.to(`table:${data.tableId}`).emit('update-available', {
      table: data.tableName,
      tableId: data.tableId,
      versionHash: data.versionHash,
      rowCount: data.rowCount,
      timestamp: new Date().toISOString(),
    })
    console.log(`[SelfBase Realtime] Version change for table ${data.tableName}: ${data.versionHash}`)
  })

  // ==================== Deferred Queue Events ====================

  socket.on('deferred-ready', (data: DeferredNotification) => {
    // Notify specific session that their deferred request is ready
    const targetSocketId = sessionSockets.get(data.sessionId)
    if (targetSocketId) {
      io.to(targetSocketId).emit('deferred-ready', {
        table: data.tableName,
        eventType: data.eventType,
        data: data.data,
        timestamp: new Date().toISOString(),
      })
    }
  })

  // ==================== Data Change Events ====================

  socket.on('data-changed', (data: {
    tableId: string
    tableName: string
    eventType: 'insert' | 'update' | 'delete'
    row?: any
    rowId?: string
  }) => {
    // Broadcast to all subscribers of this table
    const subscriberIds = getSubscribersForTable(data.tableId)
    for (const subSocketId of subscriberIds) {
      const subs = subscriptions.get(subSocketId)
      if (subs) {
        for (const sub of subs) {
          if (sub.tableId === data.tableId) {
            const eventMatch = sub.eventTypes.includes('*') || sub.eventTypes.includes(data.eventType)
            if (eventMatch) {
              io.to(subSocketId).emit('data-changed', {
                table: data.tableName,
                eventType: data.eventType,
                row: data.row,
                rowId: data.rowId,
                timestamp: new Date().toISOString(),
              })
            }
          }
        }
      }
    }
  })

  // ==================== Load & Health ====================

  socket.on('get-load', () => {
    updateLoadMetrics()
    socket.emit('load-info', {
      loadScore: loadScore.value,
      activeConnections: loadScore.activeConnections,
      reqPerSec: loadScore.reqPerSec,
      cpuPct: loadScore.cpuPct,
    })
  })

  // ==================== Presence ====================

  socket.on('presence-join', (data: { userId: string; userName: string }) => {
    socket.data.userId = data.userId
    socket.data.userName = data.userName
    io.emit('presence-update', {
      type: 'join',
      userId: data.userId,
      userName: data.userName,
      timestamp: new Date().toISOString(),
    })
  })

  // ==================== Ping/Pong ====================

  socket.on('ping', () => {
    socket.emit('pong', { timestamp: new Date().toISOString() })
  })

  // ==================== Disconnect ====================

  socket.on('disconnect', () => {
    console.log(`[SelfBase Realtime] Client disconnected: ${socket.id}`)

    // Clean up subscriptions
    const subs = subscriptions.get(socket.id)
    if (subs) {
      for (const sub of subs) {
        const tableSubs = tableSubscribers.get(sub.tableId)
        if (tableSubs) {
          tableSubs.delete(socket.id)
          if (tableSubs.size === 0) {
            tableSubscribers.delete(sub.tableId)
          }
        }
      }
      subscriptions.delete(socket.id)
    }

    // Clean up session mapping
    for (const [sessionId, socketId] of sessionSockets.entries()) {
      if (socketId === socket.id) {
        sessionSockets.delete(sessionId)
      }
    }

    // Notify presence
    if (socket.data.userId) {
      io.emit('presence-update', {
        type: 'leave',
        userId: socket.data.userId,
        userName: socket.data.userName,
        timestamp: new Date().toISOString(),
      })
    }

    updateLoadMetrics()
  })

  socket.on('error', (error) => {
    console.error(`[SelfBase Realtime] Socket error (${socket.id}):`, error)
  })
})

// ==================== Periodic Tasks ====================

// Heartbeat broadcast every 30s
setInterval(() => {
  updateLoadMetrics()
  io.emit('server-heartbeat', {
    loadScore: loadScore.value,
    activeConnections: loadScore.activeConnections,
    timestamp: new Date().toISOString(),
  })
}, 30000)

// ==================== Start Server ====================

const PORT = 3003
httpServer.listen(PORT, () => {
  console.log(`[SelfBase Realtime] WebSocket server running on port ${PORT}`)
  console.log(`[SelfBase Realtime] Ready for subscriptions, version changes, and deferred queue events`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[SelfBase Realtime] Received SIGTERM, shutting down...')
  io.close()
  httpServer.close(() => process.exit(0))
})

process.on('SIGINT', () => {
  console.log('[SelfBase Realtime] Received SIGINT, shutting down...')
  io.close()
  httpServer.close(() => process.exit(0))
})
