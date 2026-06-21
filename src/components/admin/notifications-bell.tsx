'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Bell,
  AlertTriangle,
  XCircle,
  Activity,
  Clock,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useAdminStore } from '@/stores/admin-store'

interface AlertConfigItem {
  id: string
  metricType: string
  threshold: number
  operator: string
  isEnabled: boolean
  eventCount?: number
  createdAt: string
}

interface LogItem {
  id: string
  errorType?: string
  level?: string
  source?: string
  message: string
  tableName?: string | null
  sourceName?: string | null
  occurredAt: string
}

interface NotificationItem {
  id: string
  kind: 'alert' | 'error' | 'warning'
  title: string
  description: string
  timestamp: string
  metric?: string
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return '—'
  const diff = Date.now() - then
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  return `${day}d ago`
}

function normaliseAlerts(body: any): AlertConfigItem[] {
  if (Array.isArray(body)) return body
  if (Array.isArray(body?.data)) return body.data
  return []
}

function normaliseLogs(body: any): LogItem[] {
  if (Array.isArray(body)) return body
  if (Array.isArray(body?.data)) return body.data
  return []
}

const metricLabels: Record<string, string> = {
  cpu: 'CPU',
  ram: 'RAM',
  disk: 'Disk',
  req_per_sec: 'Requests/sec',
  error_rate: 'Error Rate',
  latency: 'Latency',
}

export function NotificationsBell() {
  const { setActiveSection } = useAdminStore()
  const [open, setOpen] = useState(false)
  const [alerts, setAlerts] = useState<AlertConfigItem[]>([])
  const [logs, setLogs] = useState<LogItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true)
      try {
        const [alertsRes, logsRes] = await Promise.all([
          fetch('/api/monitoring/alerts?limit=50'),
          fetch('/api/logs?limit=5'),
        ])
        const alertsBody = alertsRes.ok ? await alertsRes.json() : { data: [] }
        const logsBody = logsRes.ok ? await logsRes.json() : []
        if (!active) return
        setAlerts(normaliseAlerts(alertsBody))
        setLogs(normaliseLogs(logsBody))
      } catch {
        // ignore
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [open])

  // "Recent alert events" = enabled alerts that have triggered (eventCount > 0)
  const recentAlerts = useMemo(
    () =>
      alerts
        .filter((a) => (a.eventCount ?? 0) > 0 && a.isEnabled)
        .sort((a, b) => (b.eventCount ?? 0) - (a.eventCount ?? 0))
        .slice(0, 4),
    [alerts],
  )

  const recentErrors = useMemo(
    () =>
      logs
        .map((l) => ({
          ...l,
          level: l.level ?? (l.errorType?.includes('error') ? 'error' : 'warning'),
        }))
        .slice(0, 5),
    [logs],
  )

  const notifications: NotificationItem[] = useMemo(() => {
    const fromAlerts: NotificationItem[] = recentAlerts.map((a) => ({
      id: `alert-${a.id}`,
      kind: 'alert' as const,
      title: `${metricLabels[a.metricType] ?? a.metricType} alert triggered`,
      description: `${a.operator} ${a.threshold} — ${a.eventCount} event${a.eventCount === 1 ? '' : 's'}`,
      timestamp: a.createdAt,
      metric: a.metricType,
    }))
    const fromLogs: NotificationItem[] = recentErrors.map((l) => ({
      id: `log-${l.id}`,
      kind: l.level === 'error' ? ('error' as const) : ('warning' as const),
      title: l.message.length > 80 ? `${l.message.slice(0, 80)}...` : l.message,
      description: [l.source, l.tableName, l.sourceName].filter(Boolean).join(' · ') || 'System',
      timestamp: l.occurredAt,
    }))
    return [...fromAlerts, ...fromLogs].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    )
  }, [recentAlerts, recentErrors])

  const unreadCount = notifications.length

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-7 w-7 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white ring-2 ring-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-80 p-0"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-emerald-600" />
            <span className="text-sm font-semibold">Notifications</span>
          </div>
          {unreadCount > 0 && (
            <Badge
              variant="outline"
              className="border-red-200 bg-red-50 text-red-700 text-[10px]"
            >
              {unreadCount} new
            </Badge>
          )}
        </div>

        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-2.5 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
            <div className="rounded-full bg-emerald-500/10 p-3">
              <Bell className="h-5 w-5 text-emerald-600" />
            </div>
            <p className="text-sm font-medium">You&apos;re all caught up</p>
            <p className="text-xs text-muted-foreground">
              No alerts triggered and no recent errors.
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-[360px]">
            <div className="divide-y">
              {notifications.map((n) => {
                const Icon =
                  n.kind === 'alert'
                    ? AlertTriangle
                    : n.kind === 'error'
                      ? XCircle
                      : Activity
                const tone =
                  n.kind === 'alert'
                    ? 'bg-amber-500/10 text-amber-600'
                    : n.kind === 'error'
                      ? 'bg-red-500/10 text-red-600'
                      : 'bg-amber-500/10 text-amber-600'
                return (
                  <div
                    key={n.id}
                    className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                  >
                    <div
                      className={cn(
                        'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                        tone,
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium leading-snug">{n.title}</p>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {n.description}
                      </p>
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="h-2.5 w-2.5" />
                        {timeAgo(n.timestamp)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        )}

        <Separator />
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            setActiveSection('logs')
          }}
          className="flex w-full items-center justify-center gap-1 px-4 py-2.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-50"
        >
          View all in Logs
          <ChevronRight className="h-3 w-3" />
        </button>
      </PopoverContent>
    </Popover>
  )
}
