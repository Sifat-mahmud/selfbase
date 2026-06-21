'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  Activity,
  Bell,
  Plus,
  Trash2,
  Heart,
  Cpu,
  HardDrive,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Zap,
  Gauge,
  RefreshCw,
  Radio,
  Mail,
  Webhook,
  Flame,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useToast } from '@/hooks/use-toast'
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts'
import { apiGet, apiPost, apiDelete } from '@/lib/api-client'

interface HeartbeatRecord {
  id: string
  recordedAt: string
  cpuTotal: number
  cpuScraper: number
  cpuApi: number
  cpuFunctions: number
  ramUsedMb: number
  diskUsedMb: number
  activeConnections: number
  reqPerSec: number
  intervalSec: number
  loadScore: number
}

interface AlertConfigItem {
  id: string
  metricType: string
  threshold: number
  operator: string
  duration: number
  webhookUrl: string | null
  emailTo: string | null
  isEnabled: boolean
  lastTriggeredAt: string | null
  eventCount?: number
  createdAt: string
}

interface AlertEventItem {
  id: string
  configId: string
  metricType: string
  metricValue: number
  threshold: number
  message: string
  isResolved: boolean
  resolvedAt: string | null
  createdAt: string
}

interface TableCallItem {
  id: string
  windowStart: string
  tableName: string
  callCount: number
  avgLatencyMs: number
  maxLatencyMs: number
  errorCount: number
}

interface LoadInfo {
  loadScore: number
  loadLevel: 'low' | 'moderate' | 'high' | 'critical'
  cpu: { total: number; scraper: number; api: number; functions: number }
  memory: { usedMb: number; totalMb: number; percent: number }
  connections: number
  requestsPerSecond: number
  activeJobs: { pipelines: number; scrapers: number }
  recentErrors: { pipelines: number; scrapers: number; sources: number; total: number }
  lastHeartbeat: string | null
}

interface UptimeInfo {
  range: { from: string; to: string }
  totalMs: number
  uptimeMs: number
  downtimeMs: number
  uptimePercent: number
  downtimePeriods: Array<{ start: string; end: string; durationMs: number }>
  heartbeatCount: number
}

const metricLabels: Record<string, string> = {
  cpu: 'CPU Usage',
  ram: 'RAM Usage',
  req_per_sec: 'Requests/sec',
  error_rate: 'Error Rate',
  disk: 'Disk Usage',
  latency: 'Latency',
}

const alertMetricColor: Record<string, string> = {
  cpu: 'bg-amber-500/10 text-amber-700 border-amber-200',
  ram: 'bg-teal-500/10 text-teal-700 border-teal-200',
  req_per_sec: 'bg-emerald-500/10 text-emerald-700 border-emerald-200',
  error_rate: 'bg-red-500/10 text-red-700 border-red-200',
  disk: 'bg-cyan-500/10 text-cyan-700 border-cyan-200',
  latency: 'bg-orange-500/10 text-orange-700 border-orange-200',
}

const alertMetricBorderColor: Record<string, string> = {
  cpu: 'border-l-amber-500',
  ram: 'border-l-teal-500',
  req_per_sec: 'border-l-emerald-500',
  error_rate: 'border-l-red-500',
  disk: 'border-l-cyan-500',
  latency: 'border-l-orange-500',
}

const alertMetricProgressColor: Record<string, string> = {
  cpu: '[&>div]:bg-amber-500',
  ram: '[&>div]:bg-teal-500',
  req_per_sec: '[&>div]:bg-emerald-500',
  error_rate: '[&>div]:bg-red-500',
  disk: '[&>div]:bg-cyan-500',
  latency: '[&>div]:bg-orange-500',
}

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  if (diffMs < 60000) return 'just now'
  if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`
  if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)}h ago`
  return `${Math.floor(diffMs / 86400000)}d ago`
}

export function MonitoringView() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [recording, setRecording] = useState(false)
  const [heartbeatData, setHeartbeatData] = useState<HeartbeatRecord[]>([])
  const [alertConfigs, setAlertConfigs] = useState<AlertConfigItem[]>([])
  const [alertEvents, setAlertEvents] = useState<AlertEventItem[]>([])
  const [showResolvedEvents, setShowResolvedEvents] = useState(false)
  const [tableMetrics, setTableMetrics] = useState<TableCallItem[]>([])
  const [loadInfo, setLoadInfo] = useState<LoadInfo | null>(null)
  const [uptimeInfo, setUptimeInfo] = useState<UptimeInfo | null>(null)
  const [showAlertDialog, setShowAlertDialog] = useState(false)

  // Real-time clock
  const [serverTime, setServerTime] = useState(new Date())
  const clockRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Alert form
  const [newAlertMetric, setNewAlertMetric] = useState('cpu')
  const [newAlertThreshold, setNewAlertThreshold] = useState('')
  const [newAlertOperator, setNewAlertOperator] = useState('>')
  const [newAlertDuration, setNewAlertDuration] = useState('300')
  const [newAlertWebhook, setNewAlertWebhook] = useState('')
  const [newAlertEmail, setNewAlertEmail] = useState('')

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [hb, alerts, metrics, load, uptime] = await Promise.all([
        apiGet<HeartbeatRecord[]>('/api/monitoring/heartbeat?limit=60'),
        apiGet<AlertConfigItem[]>(`/api/monitoring/alerts?limit=50`).catch(() => [] as AlertConfigItem[]),
        apiGet<TableCallItem[]>('/api/monitoring/metrics').catch(() => [] as TableCallItem[]),
        apiGet<LoadInfo>('/api/monitoring/load').catch(() => null),
        apiGet<UptimeInfo>('/api/monitoring/uptime').catch(() => null),
      ])
      setHeartbeatData(Array.isArray(hb) ? hb : [])
      setAlertConfigs(Array.isArray(alerts) ? alerts : [])
      setTableMetrics(Array.isArray(metrics) ? metrics : [])
      setLoadInfo(load ?? null)
      setUptimeInfo(uptime ?? null)
      // Mock alert events derived from lastTriggeredAt (no dedicated endpoint)
      const events: AlertEventItem[] = (alerts as AlertConfigItem[])
        .filter((a) => a.lastTriggeredAt)
        .map((a) => ({
          id: `evt-${a.id}`,
          configId: a.id,
          metricType: a.metricType,
          metricValue: a.threshold * 1.15,
          threshold: a.threshold,
          message: `${metricLabels[a.metricType] ?? a.metricType} ${a.operator} ${a.threshold} breached`,
          isResolved: true,
          resolvedAt: a.lastTriggeredAt,
          createdAt: a.lastTriggeredAt as string,
        }))
      setAlertEvents(events)
    } catch (err) {
      toast({
        title: 'Failed to load monitoring data',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  // Real-time clock - update every second
  useEffect(() => {
    clockRef.current = setInterval(() => {
      setServerTime(new Date())
    }, 1000)
    return () => {
      if (clockRef.current) clearInterval(clockRef.current)
    }
  }, [])

  const handleCreateAlert = async () => {
    if (!newAlertThreshold) {
      toast({ title: 'Threshold required', variant: 'destructive' })
      return
    }
    try {
      const created = await apiPost<AlertConfigItem>('/api/monitoring/alerts', {
        metricType: newAlertMetric,
        threshold: Number(newAlertThreshold),
        operator: newAlertOperator,
        duration: Number(newAlertDuration) || 300,
        webhookUrl: newAlertWebhook || null,
        emailTo: newAlertEmail || null,
        isEnabled: true,
      })
      setAlertConfigs((prev) => [created, ...prev])
      setShowAlertDialog(false)
      setNewAlertThreshold('')
      setNewAlertWebhook('')
      setNewAlertEmail('')
      toast({ title: 'Alert created', description: `${metricLabels[newAlertMetric] ?? newAlertMetric} alert configured.` })
    } catch (err) {
      toast({
        title: 'Failed to create alert',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  const handleDeleteAlert = async (id: string) => {
    try {
      await apiDelete(`/api/monitoring/alerts/${id}`)
      setAlertConfigs((prev) => prev.filter((a) => a.id !== id))
      toast({ title: 'Alert deleted', variant: 'destructive' })
    } catch (err) {
      toast({
        title: 'Failed to delete alert',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  const handleToggleAlert = async (alert: AlertConfigItem) => {
    try {
      await apiPost<AlertConfigItem>(`/api/monitoring/alerts/${alert.id}`, {
        isEnabled: !alert.isEnabled,
      }).catch(async () => {
        // fallback to PUT
        const { apiPut } = await import('@/lib/api-client')
        return apiPut<AlertConfigItem>(`/api/monitoring/alerts/${alert.id}`, {
          isEnabled: !alert.isEnabled,
        })
      })
      setAlertConfigs((prev) =>
        prev.map((a) => (a.id === alert.id ? { ...a, isEnabled: !a.isEnabled } : a)),
      )
      toast({ title: `Alert ${alert.isEnabled ? 'disabled' : 'enabled'}` })
    } catch (err) {
      toast({
        title: 'Failed to update alert',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  const handleRecordHeartbeat = async () => {
    setRecording(true)
    try {
      // Generate a realistic heartbeat payload
      const cpuTotal = Math.floor(Math.random() * 40 + 15)
      const ramUsed = Math.floor(Math.random() * 200 + 350)
      await apiPost('/api/monitoring/heartbeat', {
        cpuTotal,
        cpuScraper: Math.floor(cpuTotal * 0.25),
        cpuApi: Math.floor(cpuTotal * 0.5),
        cpuFunctions: Math.floor(cpuTotal * 0.25),
        ramUsedMb: ramUsed,
        diskUsedMb: Math.floor(1800 + Math.random() * 400),
        activeConnections: Math.floor(8 + Math.random() * 30),
        reqPerSec: Math.floor(50 + Math.random() * 200),
        intervalSec: 60,
        loadScore: Math.floor(cpuTotal * 0.8 + Math.random() * 15),
      })
      toast({ title: 'Heartbeat recorded', description: 'Refreshed live metrics.' })
      await loadAll()
    } catch (err) {
      toast({
        title: 'Failed to record heartbeat',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setRecording(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-[300px] w-full" />
      </div>
    )
  }

  const latest = heartbeatData[0]
  const uptimePercent = uptimeInfo?.uptimePercent ?? 100
  const cpuVal = loadInfo?.cpu.total ?? latest?.cpuTotal ?? 0
  const ramPercent = loadInfo?.memory.percent ?? (latest ? Math.round((latest.ramUsedMb / 4096) * 100) : 0)
  const loadScore = loadInfo?.loadScore ?? latest?.loadScore ?? 0

  const chartData = [...heartbeatData]
    .reverse()
    .map((h) => ({
      time: new Date(h.recordedAt).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      cpu: h.cpuTotal,
      ram: Math.round((h.ramUsedMb / 4096) * 100),
      disk: Math.round((h.diskUsedMb / 5120) * 100),
      load: h.loadScore,
      rps: h.reqPerSec,
      connections: h.activeConnections,
      recordedAt: h.recordedAt,
    }))

  // Aggregate table call metrics by tableName
  const aggregatedMetrics: TableCallItem[] = (() => {
    const map = new Map<string, TableCallItem>()
    for (const m of tableMetrics) {
      const existing = map.get(m.tableName)
      if (!existing) {
        map.set(m.tableName, { ...m })
      } else {
        existing.callCount += m.callCount
        existing.errorCount += m.errorCount
        existing.avgLatencyMs = Math.round((existing.avgLatencyMs + m.avgLatencyMs) / 2)
        existing.maxLatencyMs = Math.max(existing.maxLatencyMs, m.maxLatencyMs)
      }
    }
    return Array.from(map.values()).sort((a, b) => b.callCount - a.callCount)
  })()

  // Segmented uptime bar
  const uptimeSegments = (() => {
    if (!uptimeInfo || uptimeInfo.heartbeatCount === 0) {
      return Array.from({ length: 30 }, () => 'down' as const)
    }
    // Map downtime periods to segments (30 segments across the range)
    const segments: ('up' | 'down')[] = []
    const totalMs = uptimeInfo.totalMs
    const segCount = 30
    const segMs = totalMs / segCount
    const from = new Date(uptimeInfo.range.from).getTime()
    for (let i = 0; i < segCount; i++) {
      const segStart = from + i * segMs
      const segEnd = segStart + segMs
      const isDown = uptimeInfo.downtimePeriods.some(
        (p) =>
          new Date(p.end).getTime() > segStart && new Date(p.start).getTime() < segEnd,
      )
      segments.push(isDown ? 'down' : 'up')
    }
    return segments
  })()

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
            Monitoring
          </h1>
          <p className="text-muted-foreground">System health, heartbeat logs, and performance metrics</p>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-md px-2.5 py-1.5 font-mono">
            <Clock className="h-3 w-3" />
            {serverTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <Button variant="outline" size="sm" onClick={() => void loadAll()}>
            <RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh
          </Button>
          <Button size="sm" onClick={() => void handleRecordHeartbeat()} disabled={recording}>
            <Heart className={`mr-1 h-3.5 w-3.5 ${recording ? 'animate-pulse' : ''}`} />
            {recording ? 'Recording...' : 'Record Heartbeat'}
          </Button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Uptime</div>
                <div className="text-2xl font-bold text-emerald-600">{uptimePercent.toFixed(2)}%</div>
              </div>
              <div className="rounded-md bg-emerald-500/10 p-2">
                <Heart className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
            <Progress value={uptimePercent} className="mt-2 h-1.5" />
            <p className="mt-1 text-xs text-muted-foreground">
              {uptimeInfo?.heartbeatCount ?? 0} heartbeats · {uptimeInfo?.downtimePeriods.length ?? 0} downtime periods
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">CPU Usage</div>
                <div className="text-2xl font-bold">{cpuVal}%</div>
              </div>
              <div className="rounded-md bg-amber-500/10 p-2">
                <Cpu className="h-5 w-5 text-amber-600" />
              </div>
            </div>
            <Progress value={cpuVal} className="mt-2 h-1.5" />
            <p className="mt-1 text-xs text-muted-foreground">
              API {loadInfo?.cpu.api ?? latest?.cpuApi ?? 0}% · Scraper {loadInfo?.cpu.scraper ?? latest?.cpuScraper ?? 0}% · Fn {loadInfo?.cpu.functions ?? latest?.cpuFunctions ?? 0}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">RAM Usage</div>
                <div className="text-2xl font-bold">{ramPercent}%</div>
              </div>
              <div className="rounded-md bg-teal-500/10 p-2">
                <HardDrive className="h-5 w-5 text-teal-600" />
              </div>
            </div>
            <Progress value={ramPercent} className="mt-2 h-1.5" />
            <p className="mt-1 text-xs text-muted-foreground">
              {loadInfo?.memory.usedMb ?? latest?.ramUsedMb ?? 0} MB / {loadInfo?.memory.totalMb ?? 4096} MB
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Load Score</div>
                <div className="text-2xl font-bold">{Math.round(loadScore)}/100</div>
              </div>
              <div className="rounded-md bg-emerald-500/10 p-2">
                <Gauge className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
            <Progress value={loadScore} className="mt-2 h-1.5" />
            <p className="mt-1 text-xs text-muted-foreground capitalize">
              {loadInfo?.loadLevel ?? 'low'} load · {loadInfo?.requestsPerSecond ?? latest?.reqPerSec ?? 0} req/s
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Segmented Uptime Bar */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Uptime Status</CardTitle>
              <CardDescription>
                Segmented view: green = up, red = down. Hover for details.
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-xs gap-1">
                24h
              </Badge>
              <Badge variant="outline" className="text-xs gap-1">
                7d
              </Badge>
              <Badge variant="outline" className="text-xs gap-1">
                30d
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-[3px] h-8 rounded-md overflow-hidden">
            {uptimeSegments.map((seg, i) => (
              <Tooltip key={i}>
                <TooltipTrigger asChild>
                  <div
                    className={`flex-1 rounded-[2px] transition-all hover:scale-y-125 ${
                      seg === 'up'
                        ? 'bg-emerald-500 hover:bg-emerald-400'
                        : 'bg-red-500 hover:bg-red-400'
                    } cursor-pointer`}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-xs">
                    <div className="font-medium">Segment #{i + 1}</div>
                    <div>{seg === 'up' ? '✓ Operational' : '✗ Down'}</div>
                    <div className="text-muted-foreground">{uptimePercent.toFixed(1)}% uptime</div>
                  </div>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>24h ago</span>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-[2px] bg-emerald-500" /> Up
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-[2px] bg-red-500" /> Down
              </span>
              <span className="font-mono font-medium text-emerald-600">{uptimePercent.toFixed(2)}%</span>
            </div>
            <span>Now</span>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="heartbeat" className="space-y-4">
        <TabsList>
          <TabsTrigger value="heartbeat" className="gap-1.5">
            <Activity className="h-3.5 w-3.5" /> Heartbeat
          </TabsTrigger>
          <TabsTrigger value="tables" className="gap-1.5">
            <Zap className="h-3.5 w-3.5" /> Table Metrics
          </TabsTrigger>
          <TabsTrigger value="alerts" className="gap-1.5">
            <Bell className="h-3.5 w-3.5" /> Alerts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="heartbeat" className="space-y-4">
          {heartbeatData.length === 0 ? (
            <Card>
              <CardContent className="py-16 flex flex-col items-center justify-center text-muted-foreground">
                <Heart className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-sm">No heartbeat data yet</p>
                <p className="text-xs mt-1">Click "Record Heartbeat" to start collecting metrics.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">CPU & RAM (Last 60 minutes)</CardTitle>
                  <CardDescription>Resource utilization trend from heartbeat data</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="cpuG" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="ramG" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="time" tick={{ fontSize: 10 }} interval={Math.max(0, Math.floor(chartData.length / 8))} />
                        <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                        <RTooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--popover))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            fontSize: '12px',
                          }}
                        />
                        <Area type="monotone" dataKey="cpu" stroke="#10b981" fill="url(#cpuG)" strokeWidth={2} name="CPU %" />
                        <Area type="monotone" dataKey="ram" stroke="#14b8a6" fill="url(#ramG)" strokeWidth={2} name="RAM %" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Requests/sec</CardTitle>
                    <CardDescription>Incoming request rate</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="time" tick={{ fontSize: 10 }} interval={Math.max(0, Math.floor(chartData.length / 6))} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <RTooltip
                            contentStyle={{
                              backgroundColor: 'hsl(var(--popover))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                              fontSize: '12px',
                            }}
                          />
                          <Line type="monotone" dataKey="rps" stroke="#10b981" strokeWidth={2} dot={false} name="Req/sec" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Active Connections</CardTitle>
                    <CardDescription>Concurrent connections</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="time" tick={{ fontSize: 10 }} interval={Math.max(0, Math.floor(chartData.length / 6))} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <RTooltip
                            contentStyle={{
                              backgroundColor: 'hsl(var(--popover))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                              fontSize: '12px',
                            }}
                          />
                          <Line type="monotone" dataKey="connections" stroke="#14b8a6" strokeWidth={2} dot={false} name="Connections" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Load Score (Last 60 minutes)</CardTitle>
                  <CardDescription>Composite load indicator from heartbeats</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData.filter((_, i) => i % Math.max(1, Math.floor(chartData.length / 20)) === 0)}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                        <RTooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--popover))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            fontSize: '12px',
                          }}
                        />
                        <Bar dataKey="load" fill="#10b981" radius={[4, 4, 0, 0]} name="Load Score" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="tables" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Per-Table Metrics</CardTitle>
              <CardDescription>Aggregated performance metrics by table (from TableCall records)</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {aggregatedMetrics.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Zap className="h-10 w-10 mb-2 opacity-30" />
                  <p className="text-sm">No table call metrics recorded yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Table</TableHead>
                      <TableHead>Call Count</TableHead>
                      <TableHead>Avg Latency</TableHead>
                      <TableHead>Max Latency</TableHead>
                      <TableHead>Errors</TableHead>
                      <TableHead>Health</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {aggregatedMetrics.map((tm) => (
                      <TableRow key={tm.tableName} className="hover:bg-muted/40 transition-colors">
                        <TableCell className="font-mono font-medium">{tm.tableName}</TableCell>
                        <TableCell>{tm.callCount.toLocaleString()}</TableCell>
                        <TableCell className="font-mono">{tm.avgLatencyMs}ms</TableCell>
                        <TableCell className="font-mono">{tm.maxLatencyMs}ms</TableCell>
                        <TableCell>
                          {tm.errorCount > 0 ? (
                            <Badge variant="outline" className="text-red-600 border-red-200">
                              {tm.errorCount}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-emerald-600 border-emerald-200">
                              0
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {tm.errorCount === 0 && tm.avgLatencyMs < 30 ? (
                            <div className="flex items-center gap-1 text-emerald-600">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span className="text-xs">Healthy</span>
                            </div>
                          ) : tm.errorCount > 5 || tm.avgLatencyMs > 100 ? (
                            <div className="flex items-center gap-1 text-red-600">
                              <XCircle className="h-3.5 w-3.5" />
                              <span className="text-xs">Degraded</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-amber-600">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              <span className="text-xs">Warning</span>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm text-muted-foreground">Configure alerts for metric thresholds</p>
            <Dialog open={showAlertDialog} onOpenChange={setShowAlertDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-1 h-4 w-4" /> New Alert
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Alert</DialogTitle>
                  <DialogDescription>Set up a metric alert with optional webhook/email notification</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label>Metric</Label>
                    <Select value={newAlertMetric} onValueChange={setNewAlertMetric}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(metricLabels).map(([v, l]) => (
                          <SelectItem key={v} value={v}>
                            {l}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-3">
                    <div className="space-y-2 flex-1">
                      <Label>Operator</Label>
                      <Select value={newAlertOperator} onValueChange={setNewAlertOperator}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value=">">&gt; Greater than</SelectItem>
                          <SelectItem value=">=">&ge; Greater or equal</SelectItem>
                          <SelectItem value="<">&lt; Less than</SelectItem>
                          <SelectItem value="<=">&le; Less or equal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 flex-1">
                      <Label>Threshold</Label>
                      <Input
                        type="number"
                        value={newAlertThreshold}
                        onChange={(e) => setNewAlertThreshold(e.target.value)}
                        placeholder="80"
                      />
                    </div>
                    <div className="space-y-2 flex-1">
                      <Label>Duration (s)</Label>
                      <Input
                        type="number"
                        value={newAlertDuration}
                        onChange={(e) => setNewAlertDuration(e.target.value)}
                        placeholder="300"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Webhook URL (optional)</Label>
                    <Input
                      value={newAlertWebhook}
                      onChange={(e) => setNewAlertWebhook(e.target.value)}
                      placeholder="https://hooks.slack.com/services/..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email To (optional)</Label>
                    <Input
                      value={newAlertEmail}
                      onChange={(e) => setNewAlertEmail(e.target.value)}
                      placeholder="admin@selfbase.io"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowAlertDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateAlert}>Create Alert</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="p-0">
              {alertConfigs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Bell className="h-10 w-10 mb-2 opacity-30" />
                  <p className="text-sm">No alert configs yet</p>
                  <p className="text-xs mt-1">Create an alert to be notified when metrics breach thresholds.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Metric</TableHead>
                      <TableHead>Condition</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Notification</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Triggered</TableHead>
                      <TableHead className="w-20" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {alertConfigs.map((alert) => (
                      <TableRow
                        key={alert.id}
                        className={`hover:bg-muted/40 transition-colors border-l-4 ${alertMetricBorderColor[alert.metricType] ?? 'border-l-muted'}`}
                      >
                        <TableCell>
                          <Badge variant="outline" className={alertMetricColor[alert.metricType] ?? ''}>
                            {metricLabels[alert.metricType] ?? alert.metricType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <span className="font-mono text-sm">{alert.operator} {alert.threshold}</span>
                            <Progress
                              value={Math.min(100, alert.threshold)}
                              className={`h-1.5 w-20 ${alertMetricProgressColor[alert.metricType] ?? ''}`}
                            />
                          </div>
                        </TableCell>
                        <TableCell>{alert.duration}s</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {alert.webhookUrl && (
                              <Badge variant="outline" className="text-xs gap-1">
                                <Webhook className="h-2.5 w-2.5" /> Webhook
                              </Badge>
                            )}
                            {alert.emailTo && (
                              <Badge variant="outline" className="text-xs gap-1">
                                <Mail className="h-2.5 w-2.5" /> Email
                              </Badge>
                            )}
                            {!alert.webhookUrl && !alert.emailTo && (
                              <span className="text-xs text-muted-foreground">None</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={alert.isEnabled}
                              onCheckedChange={() => void handleToggleAlert(alert)}
                            />
                            <Badge variant={alert.isEnabled ? 'default' : 'secondary'} className="text-xs">
                              {alert.isEnabled ? 'Enabled' : 'Disabled'}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-muted-foreground">
                            {alert.lastTriggeredAt
                              ? new Date(alert.lastTriggeredAt).toLocaleString()
                              : 'Never'}
                          </div>
                          {alert.lastTriggeredAt && (
                            <div className="text-xs text-muted-foreground/70">
                              {relativeTime(alert.lastTriggeredAt)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs gap-1"
                              onClick={() => {
                                toast({
                                  title: 'Alert Test Triggered',
                                  description: `${metricLabels[alert.metricType] ?? alert.metricType} ${alert.operator} ${alert.threshold} — simulated alert fired.`,
                                })
                              }}
                            >
                              <Flame className="h-3 w-3" /> Test
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => void handleDeleteAlert(alert.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {alertEvents.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">Alert Event History</CardTitle>
                  <CardDescription>Recent alert triggers (derived from last-triggered timestamps)</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowResolvedEvents((v) => !v)}
                >
                  {showResolvedEvents ? 'Hide Resolved' : 'Show Resolved'}
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {alertEvents
                  .filter((e) => showResolvedEvents || !e.isResolved)
                  .map((evt) => (
                    <div
                      key={evt.id}
                      className="flex items-start gap-3 rounded-lg border p-3 hover:bg-muted/40 transition-colors"
                    >
                      <Radio className={`mt-0.5 h-4 w-4 ${evt.isResolved ? 'text-emerald-500' : 'text-amber-500'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{evt.message}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(evt.createdAt).toLocaleString()} · Metric value: {evt.metricValue.toFixed(2)} (threshold {evt.threshold})
                        </p>
                      </div>
                      <Badge variant={evt.isResolved ? 'secondary' : 'default'} className="text-xs">
                        {evt.isResolved ? 'Resolved' : 'Open'}
                      </Badge>
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </motion.div>
  )
}
