'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { io, Socket } from 'socket.io-client'

interface UseRealtimeOptions {
  tableId?: string
  eventTypes?: string[]
  onVersionChange?: (data: { table: string; versionHash: string; rowCount: number }) => void
  onDataChanged?: (data: { table: string; eventType: string; row?: any; rowId?: string }) => void
  onDeferredReady?: (data: { table: string; eventType: string; data: any }) => void
  onServerHeartbeat?: (data: { loadScore: number; activeConnections: number }) => void
}

interface RealtimeState {
  connected: boolean
  loadScore: number
  activeConnections: number
  socketId: string | null
}

export function useRealtime(options: UseRealtimeOptions = {}) {
  const socketRef = useRef<Socket | null>(null)
  const [state, setState] = useState<RealtimeState>({
    connected: false,
    loadScore: 0,
    activeConnections: 0,
    socketId: null,
  })

  useEffect(() => {
    const socket = io('/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    })

    socketRef.current = socket

    socket.on('connected', (data) => {
      setState((prev) => ({
        ...prev,
        connected: true,
        socketId: data.socketId,
      }))
    })

    socket.on('disconnect', () => {
      setState((prev) => ({ ...prev, connected: false }))
    })

    // Subscribe to table if specified
    if (options.tableId) {
      socket.emit('subscribe', {
        tableId: options.tableId,
        eventTypes: options.eventTypes || ['*'],
      })
    }

    // Set up event handlers
    if (options.onVersionChange) {
      socket.on('update-available', options.onVersionChange)
    }

    if (options.onDataChanged) {
      socket.on('data-changed', options.onDataChanged)
    }

    if (options.onDeferredReady) {
      socket.on('deferred-ready', options.onDeferredReady)
    }

    if (options.onServerHeartbeat) {
      socket.on('server-heartbeat', (data) => {
        options.onServerHeartbeat!(data)
        setState((prev) => ({
          ...prev,
          loadScore: data.loadScore,
          activeConnections: data.activeConnections,
        }))
      })
    }

    return () => {
      if (options.tableId) {
        socket.emit('unsubscribe', { tableId: options.tableId })
      }
      socket.disconnect()
      socketRef.current = null
    }
  }, [options.tableId])

  const subscribe = useCallback((tableId: string, eventTypes?: string[]) => {
    socketRef.current?.emit('subscribe', { tableId, eventTypes: eventTypes || ['*'] })
  }, [])

  const unsubscribe = useCallback((tableId: string) => {
    socketRef.current?.emit('unsubscribe', { tableId })
  }, [])

  const emitVersionChange = useCallback((data: {
    tableId: string
    tableName: string
    versionHash: string
    rowCount: number
  }) => {
    socketRef.current?.emit('version-changed', data)
  }, [])

  const emitDataChanged = useCallback((data: {
    tableId: string
    tableName: string
    eventType: 'insert' | 'update' | 'delete'
    row?: any
    rowId?: string
  }) => {
    socketRef.current?.emit('data-changed', data)
  }, [])

  return {
    ...state,
    subscribe,
    unsubscribe,
    emitVersionChange,
    emitDataChanged,
    getSocket: () => socketRef.current,
  }
}
