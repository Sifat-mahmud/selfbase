'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion, type Variants } from 'framer-motion'
import {
  Activity,
  Database,
  Users,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Server,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  GitBranch,
  Code2,
  Brain,
  Globe,
  Shield,
  HardDrive,
  RefreshCw,
  Cpu,
  MemoryStick,
  ChevronRight,
  Sparkles,
  Layers,
  CircleDot,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { useAdminStore, type AdminSection } from '@/stores/admin-store'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts'

// =====================================================================
// TYPES — typed contracts for every API response we consume
// =====================================================================

interface LoadData {
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

interface UptimeData {
  range?: { from: string; to: string }
  totalMs?: number
  uptimeMs?: number
  downtimeMs?: number
  uptimePercent: number
  downtimePeriods?: Array<{ start: string; end: string; durationMs: number }>
  heartbeatCount: number
}

interface Heartbeat {
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

interface SbTable {
  id: string
  name: string
  displayName?: string | null
  rowCount: number
  [key: string]: unknown
}

interface PipelineSource {
  id: string
  name: string
  isActive: boolean
  [key: string]: unknown
}

interface SbFunction {
  id: string
  name: string
  isActive: boolean
  [key: string]: unknown
}

interface QueueStats {
  status: string
  count: number
}

interface QueueData {
  requests: unknown[]
  stats: QueueStats[]
  pagination?: { total: number }
}

interface SourceError {
  id: string
  sourceId?: string | null
  tableId?: string | null
  tableName?: string | null
  errorType: string
  message: string
  occurredAt: string
}

interface DashboardData {
  load: LoadData | null
  uptime: UptimeData | null
  heartbeats: Heartbeat[]
  tables: SbTable[]
  pipelines: PipelineSource[]
  functions: SbFunction[]
  queue: QueueData | null
  logs: SourceError[]
}

// =====================================================================
// HELPERS
// =====================================================================

/** Unwrap `{ success, data }` envelope; fall back to raw payload. */
async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const json = await res.json()
    if (json && typeof json === 'object' && 'success' in json && 'data' in json) {
      return (json as { data: T }).data as T
    }
    return json as T
  } catch {
    return null
  }
}

function formatNumber(n: number, mode: 'compact' | 'full' = 'compact'): string {
  if (!Number.isFinite(n)) return '0'
  if (mode === 'full') return n.toLocaleString()
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = Math.max(0, now - then)
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day}d ago`
  const mo = Math.floor(day / 30)
  if (mo < 12) return `${mo}mo ago`
  return `${Math.floor(mo / 12)}y ago`
}

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0m'
  const sec = Math.floor(ms / 1000)
  const days = Math.floor(sec / 86400)
  const hours = Math.floor((sec % 86400) / 3600)
  const mins = Math.floor((sec % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h ${mins}m`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

/** Map a 0-100 usage value to a traffic-light color bucket. */
function progressBucket(pct: number): 'emerald' | 'amber' | 'red' {
  if (pct >= 75) return 'red'
  if (pct >= 50) return 'amber'
  return 'emerald'
}

const PROGRESS_STYLES: Record<'emerald' | 'amber' | 'red', { bar: string; text: string; bg: string }> = {
  emerald: {
    bar: 'bg-emerald-500',
    text: 'text-emerald-600',
    bg: 'bg-emerald-500/10',
  },
  amber: {
    bar: 'bg-amber-500',
    text: 'text-amber-600',
    bg: 'bg-amber-500/10',
  },
  red: {
    bar: 'bg-red-500',
    text: 'text-red-600',
    bg: 'bg-red-500/10',
  },
}

// =====================================================================
// ANIMATED COUNTER
// =====================================================================

function AnimatedNumber({
  value,
  format = 'plain',
  duration = 800,
  className,
}: {
  value: number
  format?: 'plain' | 'compact' | 'percent'
  duration?: number
  className?: string
}) {
  const reduce = useReducedMotion()
  const [display, setDisplay] = useState(value)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (reduce) return // reduced-motion users see raw value, no state writes
    const start = display
    const delta = value - start
    if (delta === 0) return
    const startTs = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - startTs) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(start + delta * eased)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        setDisplay(value)
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [value, duration, reduce])

  const shown = reduce ? value : display
  if (format === 'compact') {
    return <span className={className}>{formatNumber(Math.round(shown))}</span>
  }
  if (format === 'percent') {
    return <span className={className}>{shown.toFixed(1)}%</span>
  }
  return <span className={className}>{Math.round(shown).toLocaleString()}</span>
}

// =====================================================================
// SPARKLINE — tiny area chart used inside KPI cards
// =====================================================================

function Sparkline({
  data,
  color,
  height = 36,
}: {
  data: number[]
  color: string
  height?: number
}) {
  if (data.length === 0) {
    return <div style={{ height }} className="w-full" />
  }
  const chartData = data.map((v, i) => ({ i, v }))
  const id = `spark-${color.replace('#', '')}`
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.45} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#${id})`}
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// =====================================================================
// CHANGE PILL — up/down/neutral indicator
// =====================================================================

function ChangePill({
  direction,
  label,
  invertColor = false,
}: {
  direction: 'up' | 'down' | 'neutral'
  label: string
  invertColor?: boolean
}) {
  // invertColor = true means "up is bad" (e.g. error rate)
  const good = direction === 'up' ? !invertColor : direction === 'down' ? invertColor : null
  const colorClass =
    direction === 'neutral'
      ? 'text-muted-foreground'
      : good
        ? 'text-emerald-600'
        : 'text-red-600'
  const Icon = direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : Minus
  return (
    <span className={`flex items-center gap-0.5 font-medium ${colorClass}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  )
}

// =====================================================================
// MAIN DASHBOARD
// =====================================================================

const REFRESH_INTERVAL_MS = 30_000

export function DashboardView() {
  const [data, setData] = useState<DashboardData>({
    load: null,
    uptime: null,
    heartbeats: [],
    tables: [],
    pipelines: [],
    functions: [],
    queue: null,
    logs: [],
  })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchAll = useCallback(async () => {
    const [load, uptime, heartbeats, tables, pipelines, functions, queue, logs] =
      await Promise.all([
        fetchJson<LoadData>('/api/monitoring/load'),
        fetchJson<UptimeData>('/api/monitoring/uptime'),
        fetchJson<Heartbeat[]>('/api/monitoring/heartbeat?limit=60'),
        fetchJson<SbTable[]>('/api/tables'),
        fetchJson<PipelineSource[]>('/api/pipelines?isActive=true'),
        fetchJson<SbFunction[]>('/api/functions'),
        fetchJson<QueueData>('/api/queue'),
        fetchJson<SourceError[]>('/api/logs?limit=8'),
      ])

    setData({
      load: load ?? null,
      uptime: uptime ?? null,
      heartbeats: heartbeats ?? [],
      tables: tables ?? [],
      pipelines: pipelines ?? [],
      functions: functions ?? [],
      queue: queue ?? null,
      logs: logs ?? [],
    })
    setLastUpdated(new Date())
  }, [])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      await fetchAll()
      if (!cancelled) setLoading(false)
    }
    run()
    const id = setInterval(() => {
      fetchAll()
    }, REFRESH_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [fetchAll])

  const handleRefresh = useCallback(() => {
    setRefreshing(true)
    fetchAll().finally(() => setRefreshing(false))
  }, [fetchAll])

  if (loading) {
    return <DashboardSkeleton />
  }

  return <DashboardContent data={data} lastUpdated={lastUpdated} onRefresh={handleRefresh} refreshing={refreshing} />
}

// =====================================================================
// DASHBOARD CONTENT
// =====================================================================

function DashboardContent({
  data,
  lastUpdated,
  onRefresh,
  refreshing,
}: {
  data: DashboardData
  lastUpdated: Date | null
  onRefresh: () => void
  refreshing: boolean
}) {
  const reduce = useReducedMotion()

  // ---- computed values -------------------------------------------------
  const computed = useMemo(() => {
    const load = data.load
    const loadScore = load?.loadScore ?? 0
    const cpuTotal = load?.cpu.total ?? 0
    const cpuScraper = load?.cpu.scraper ?? 0
    const cpuApi = load?.cpu.api ?? 0
    const cpuFunctions = load?.cpu.functions ?? 0
    const ramPercent = load?.memory.percent ?? 0
    const ramUsedMb = load?.memory.usedMb ?? 0
    const ramTotalMb = load?.memory.totalMb ?? 0
    const connections = load?.connections ?? 0
    const reqPerSec = load?.requestsPerSecond ?? 0
    const activePipelines = data.pipelines.length
    const activeFunctions = data.functions.filter((f) => f.isActive).length

    const totalTables = data.tables.length
    const totalRows = data.tables.reduce((sum, t) => sum + (t.rowCount ?? 0), 0)
    const recentErrorsTotal = load?.recentErrors.total ?? 0

    // error rate: errors in last hour vs estimated requests in last hour
    const estimatedHourlyRequests = reqPerSec * 3600
    const errorRate =
      estimatedHourlyRequests > 0
        ? Math.min((recentErrorsTotal / estimatedHourlyRequests) * 100, 100)
        : recentErrorsTotal > 0
          ? 100
          : 0

    // uptime
    const uptimePercent = data.uptime?.uptimePercent ?? 100
    const heartbeatCount = data.uptime?.heartbeatCount ?? 0

    // uptime duration — oldest heartbeat to now
    const oldestHeartbeat = data.heartbeats.length > 0
      ? data.heartbeats[data.heartbeats.length - 1]
      : null
    const uptimeDurationMs = oldestHeartbeat
      ? Date.now() - new Date(oldestHeartbeat.recordedAt).getTime()
      : 0
    const uptimeDuration = formatDuration(uptimeDurationMs)

    // queue totals
    const queueStats = data.queue?.stats ?? []
    const queuedCount = queueStats.find((s) => s.status === 'queued')?.count ?? 0
    const processingCount = queueStats.find((s) => s.status === 'processing')?.count ?? 0
    const queueTotal = queueStats.reduce((sum, s) => sum + (s.count ?? 0), 0)

    // direction (latest vs previous heartbeat)
    const hb = data.heartbeats
    const latest = hb[0] ?? null
    const prev = hb[1] ?? null
    const dir = (curr?: number | null, p?: number | null): 'up' | 'down' | 'neutral' => {
      if (curr == null || p == null || curr === p) return 'neutral'
      return curr > p ? 'up' : 'down'
    }
    const connectionsDir = dir(latest?.activeConnections, prev?.activeConnections)
    const reqDir = dir(latest?.reqPerSec, prev?.reqPerSec)
    const loadDir = dir(latest?.loadScore, prev?.loadScore)
    const cpuDir = dir(latest?.cpuTotal, prev?.cpuTotal)

    // server health from load level
    // Only consider uptime a concern if there are enough heartbeats to make
    // the measurement meaningful (at least 60 = 1 hour of 1-min intervals)
    const uptimeIsConcern = uptimePercent < 95 && heartbeatCount > 60
    const health: 'healthy' | 'degraded' | 'down' =
      loadScore >= 85
        ? 'down'
        : loadScore >= 60 || uptimeIsConcern
          ? 'degraded'
          : 'healthy'

    // sparkline series (oldest → newest)
    const sparkConnections = hb.slice().reverse().map((h) => h.activeConnections)
    const sparkReq = hb.slice().reverse().map((h) => h.reqPerSec)
    const sparkLoad = hb.slice().reverse().map((h) => h.loadScore)
    const sparkCpu = hb.slice().reverse().map((h) => h.cpuTotal)
    const sparkRam = hb.slice().reverse().map((h) => h.ramUsedMb)

    return {
      loadScore,
      loadLevel: load?.loadLevel ?? 'low',
      cpuTotal,
      cpuScraper,
      cpuApi,
      cpuFunctions,
      ramPercent,
      ramUsedMb,
      ramTotalMb,
      connections,
      reqPerSec,
      activePipelines,
      activeFunctions,
      activeScrapers: load?.activeJobs.scrapers ?? 0,
      activePipelineRuns: load?.activeJobs.pipelines ?? 0,
      totalTables,
      totalRows,
      recentErrorsTotal,
      errorRate,
      uptimePercent,
      heartbeatCount,
      uptimeDuration,
      queuedCount,
      processingCount,
      queueTotal,
      connectionsDir,
      reqDir,
      loadDir,
      cpuDir,
      health,
      sparkConnections,
      sparkReq,
      sparkLoad,
      sparkCpu,
      sparkRam,
    }
  }, [data])

  // chart data — reverse so oldest is first
  const chartData = useMemo(() => {
    return data.heartbeats
      .slice()
      .reverse()
      .map((h) => ({
        time: new Date(h.recordedAt).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        cpu: h.cpuTotal,
        ram: Math.round((h.ramUsedMb / (data.load?.memory.totalMb || 4096)) * 100),
        reqPerSec: h.reqPerSec,
        loadScore: Math.round(h.loadScore),
        connections: h.activeConnections,
      }))
  }, [data.heartbeats, data.load])

  // framer-motion variants
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: reduce ? 0 : 0.06, delayChildren: reduce ? 0 : 0.05 },
    },
  }
  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 12 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4, ease: 'easeOut' },
    },
  }

  const healthLabel =
    computed.health === 'healthy'
      ? 'All Systems Operational'
      : computed.health === 'degraded'
        ? 'Degraded Performance'
        : 'Critical Load'

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* ====================== HERO HEADER ====================== */}
      <motion.div variants={itemVariants}>
        <HeroHeader
          health={computed.health}
          healthLabel={healthLabel}
          loadScore={computed.loadScore}
          loadLevel={computed.loadLevel}
          uptimePercent={computed.uptimePercent}
          uptimeDuration={computed.uptimeDuration}
          lastUpdated={lastUpdated}
          onRefresh={onRefresh}
          refreshing={refreshing}
        />
      </motion.div>

      {/* ====================== KPI CARDS ====================== */}
      <motion.div
        variants={itemVariants}
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
      >
        <KPICard
          title="Active Connections"
          value={computed.connections}
          icon={<Users className="h-4 w-4" />}
          spark={computed.sparkConnections}
          sparkColor="#10b981"
          direction={computed.connectionsDir}
          changeLabel={
            computed.connectionsDir === 'neutral'
              ? 'stable'
              : computed.connectionsDir === 'up'
                ? `+${Math.abs((data.heartbeats[0]?.activeConnections ?? 0) - (data.heartbeats[1]?.activeConnections ?? 0))}`
                : `-${Math.abs((data.heartbeats[0]?.activeConnections ?? 0) - (data.heartbeats[1]?.activeConnections ?? 0))}`
          }
          description="vs last heartbeat"
        />
        <KPICard
          title="Total Tables"
          value={computed.totalTables}
          valueFormat="plain"
          icon={<Database className="h-4 w-4" />}
          sub={`${formatNumber(computed.totalRows)} rows stored`}
          sparkColor="#14b8a6"
          spark={computed.sparkLoad}
        />
        <KPICard
          title="Requests / sec"
          value={computed.reqPerSec}
          icon={<Zap className="h-4 w-4" />}
          spark={computed.sparkReq}
          sparkColor="#0d9488"
          direction={computed.reqDir}
          changeLabel={
            computed.reqDir === 'neutral'
              ? 'stable'
              : `${computed.reqDir === 'up' ? '+' : '-'}${Math.abs(
                  (data.heartbeats[0]?.reqPerSec ?? 0) - (data.heartbeats[1]?.reqPerSec ?? 0),
                )}`
          }
          description="vs last heartbeat"
        />
        <KPICard
          title="Error Rate"
          value={computed.errorRate}
          valueFormat="percent"
          icon={<AlertTriangle className="h-4 w-4" />}
          spark={computed.sparkLoad}
          sparkColor="#f43f5e"
          direction={computed.loadDir}
          invertColor
          changeLabel={`${computed.recentErrorsTotal} errs / hr`}
          description="last hour"
        />
      </motion.div>

      {/* ====================== RESOURCE CARDS ====================== */}
      <motion.div
        variants={itemVariants}
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
      >
        <ResourceCard
          title="Load Score"
          icon={<TrendingUp className="h-4 w-4" />}
          value={computed.loadScore}
          max={100}
          displayValue={`${computed.loadScore}/100`}
          bucket={progressBucket(computed.loadScore)}
          description={loadLevelLabel(computed.loadLevel)}
          spark={computed.sparkLoad}
          sparkColor="#10b981"
        />
        <ResourceCard
          title="CPU Usage"
          icon={<Cpu className="h-4 w-4" />}
          value={computed.cpuTotal}
          max={100}
          displayValue={`${computed.cpuTotal}%`}
          bucket={progressBucket(computed.cpuTotal)}
          description={`API ${computed.cpuApi}% · Scraper ${computed.cpuScraper}% · Funcs ${computed.cpuFunctions}%`}
          spark={computed.sparkCpu}
          sparkColor="#14b8a6"
        />
        <ResourceCard
          title="RAM Usage"
          icon={<MemoryStick className="h-4 w-4" />}
          value={computed.ramPercent}
          max={100}
          displayValue={`${computed.ramPercent}%`}
          bucket={progressBucket(computed.ramPercent)}
          description={`${formatNumber(computed.ramUsedMb)} MB / ${formatNumber(computed.ramTotalMb, 'full')} MB`}
          spark={computed.sparkRam}
          sparkColor="#0d9488"
        />
        <ResourceCard
          title="Active Jobs"
          icon={<Layers className="h-4 w-4" />}
          value={computed.activePipelineRuns + computed.activeScrapers}
          max={20}
          displayValue={`${computed.activePipelineRuns + computed.activeScrapers}`}
          bucket={computed.activePipelineRuns + computed.activeScrapers >= 15 ? 'red' : computed.activePipelineRuns + computed.activeScrapers >= 8 ? 'amber' : 'emerald'}
          description={`${computed.activePipelineRuns} pipelines · ${computed.activeScrapers} scrapers running`}
        />
      </motion.div>

      {/* ====================== CHARTS ROW 1 ====================== */}
      <motion.div variants={itemVariants} className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="CPU & RAM Trend"
          subtitle={`${chartData.length} heartbeats · realtime`}
          icon={<Activity className="h-4 w-4" />}
        >
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="cpuArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="ramArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted/40" vertical={false} />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={32}
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, 100]}
                  width={36}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '10px',
                    fontSize: '12px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                  }}
                  labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                />
                <Area
                  type="monotone"
                  dataKey="cpu"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#cpuArea)"
                  name="CPU %"
                />
                <Area
                  type="monotone"
                  dataKey="ram"
                  stroke="#14b8a6"
                  strokeWidth={2}
                  fill="url(#ramArea)"
                  name="RAM %"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title="Requests / sec"
          subtitle="Throughput from heartbeats"
          icon={<Zap className="h-4 w-4" />}
        >
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted/40" vertical={false} />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={32}
                />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={36} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '10px',
                    fontSize: '12px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                  }}
                  labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                />
                <Line
                  type="monotone"
                  dataKey="reqPerSec"
                  stroke="#0d9488"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4, fill: '#0d9488' }}
                  name="Req/sec"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </motion.div>

      {/* ====================== CHARTS ROW 2 (load score full width) ====================== */}
      <motion.div variants={itemVariants}>
        <ChartCard
          title="Load Score History"
          subtitle="Weighted system load (CPU · RAM · Connections · Reqs)"
          icon={<TrendingUp className="h-4 w-4" />}
        >
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="loadArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted/40" vertical={false} />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={32}
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, 100]}
                  width={36}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '10px',
                    fontSize: '12px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                  }}
                  labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                />
                <Area
                  type="monotone"
                  dataKey="loadScore"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fill="url(#loadArea)"
                  name="Load Score"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </motion.div>

      {/* ====================== STATUS + ACTIVITY ROW ====================== */}
      <motion.div variants={itemVariants} className="grid gap-4 lg:grid-cols-3">
        <ServiceStatusCard
          activePipelines={computed.activePipelines}
          activeFunctions={computed.activeFunctions}
          activeScrapers={computed.activeScrapers}
          activePipelineRuns={computed.activePipelineRuns}
          queuedCount={computed.queuedCount}
          processingCount={computed.processingCount}
          queueTotal={computed.queueTotal}
          health={computed.health}
          heartbeatCount={computed.heartbeatCount}
        />

        <Card className="lg:col-span-2 group transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Recent Activity</CardTitle>
                <CardDescription>Latest errors & events from /api/logs</CardDescription>
              </div>
              <Badge variant="outline" className="text-xs">
                {data.logs.length} recent
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {data.logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                <div className="rounded-full bg-emerald-500/10 p-2.5 text-emerald-600">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium">No recent errors</p>
                <p className="text-xs text-muted-foreground">All sources are healthy right now.</p>
              </div>
            ) : (
              <div className="max-h-[420px] space-y-2.5 overflow-y-auto pr-2 [scrollbar-width:thin]">
                {data.logs.map((log) => {
                  const bucket =
                    log.errorType.includes('validation')
                      ? 'amber'
                      : log.errorType.includes('network')
                        ? 'red'
                        : 'red'
                  const styles = PROGRESS_STYLES[bucket]
                  return (
                    <div
                      key={log.id}
                      className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40"
                    >
                      <div className={`mt-0.5 rounded-full p-1.5 ${styles.bg} ${styles.text}`}>
                        <AlertTriangle className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-tight">{log.message}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{formatRelativeTime(log.occurredAt)}</span>
                          {log.tableName && (
                            <>
                              <span>·</span>
                              <span className="font-mono">{log.tableName}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-[10px] font-mono">
                        {log.errorType}
                      </Badge>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ====================== QUICK ACTIONS + API REFERENCE ====================== */}
      <motion.div variants={itemVariants} className="grid gap-4 lg:grid-cols-2">
        <QuickActionsCard />
        <ApiReferenceCard />
      </motion.div>
    </motion.div>
  )
}

// =====================================================================
// HERO HEADER
// =====================================================================

function HeroHeader({
  health,
  healthLabel,
  loadScore,
  loadLevel,
  uptimePercent,
  uptimeDuration,
  lastUpdated,
  onRefresh,
  refreshing,
}: {
  health: 'healthy' | 'degraded' | 'down'
  healthLabel: string
  loadScore: number
  loadLevel: string
  uptimePercent: number
  uptimeDuration: string
  lastUpdated: Date | null
  onRefresh: () => void
  refreshing: boolean
}) {
  const dotColor =
    health === 'healthy'
      ? 'bg-emerald-300'
      : health === 'degraded'
        ? 'bg-amber-300'
        : 'bg-red-300'
  const ringColor =
    health === 'healthy'
      ? 'bg-emerald-400/40'
      : health === 'degraded'
        ? 'bg-amber-400/40'
        : 'bg-red-400/40'

  return (
    <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500 via-teal-500 to-emerald-600 p-6 text-white shadow-lg">
      {/* decorative blobs */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 left-1/3 h-40 w-40 rounded-full bg-teal-300/20 blur-3xl" />

      <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex h-2.5 w-2.5 items-center justify-center">
              <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${ringColor} opacity-75`} />
              <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${dotColor}`} />
            </div>
            <span className="text-xs font-medium uppercase tracking-wider text-emerald-50/90">
              SelfBase Admin Studio
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Dashboard Overview
          </h1>
          <p className="max-w-xl text-sm text-emerald-50/80">
            Real-time server health, resource utilization, and pipeline activity for your
            self-hosted, AI-native backend.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 backdrop-blur-sm">
            <div className="text-[10px] font-medium uppercase tracking-wider text-emerald-50/70">
              Status
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold">
              <Sparkles className="h-3.5 w-3.5" />
              {healthLabel}
            </div>
          </div>
          <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 backdrop-blur-sm">
            <div className="text-[10px] font-medium uppercase tracking-wider text-emerald-50/70">
              Uptime
            </div>
            <div className="mt-0.5 text-sm font-semibold">
              {uptimePercent.toFixed(1)}% · {uptimeDuration}
            </div>
          </div>
          <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 backdrop-blur-sm">
            <div className="text-[10px] font-medium uppercase tracking-wider text-emerald-50/70">
              Load
            </div>
            <div className="mt-0.5 text-sm font-semibold capitalize">
              {loadScore}/100 · {loadLevel}
            </div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={onRefresh}
            disabled={refreshing}
            className="border-white/20 bg-white/15 text-white hover:bg-white/25 hover:text-white"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {lastUpdated && (
        <div className="relative mt-4 flex items-center gap-1.5 text-xs text-emerald-50/60">
          <Clock className="h-3 w-3" />
          Last updated {formatRelativeTime(lastUpdated.toISOString())} · auto-refresh every 30s
        </div>
      )}
    </div>
  )
}

// =====================================================================
// KPI CARD
// =====================================================================

function KPICard({
  title,
  value,
  valueFormat = 'plain',
  icon,
  spark,
  sparkColor,
  direction,
  changeLabel,
  description,
  sub,
  invertColor = false,
}: {
  title: string
  value: number
  valueFormat?: 'plain' | 'compact' | 'percent'
  icon: React.ReactNode
  spark?: number[]
  sparkColor?: string
  direction?: 'up' | 'down' | 'neutral'
  changeLabel?: string
  description?: string
  sub?: string
  invertColor?: boolean
}) {
  return (
    <Card className="group relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-emerald-500/5">
      {/* glassmorphism hover gradient */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-teal-500/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </CardTitle>
        <div className="rounded-md bg-emerald-500/10 p-1.5 text-emerald-600">{icon}</div>
      </CardHeader>
      <CardContent className="relative">
        <div className="text-3xl font-bold tracking-tight">
          <AnimatedNumber value={value} format={valueFormat} />
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-xs">
          {direction && changeLabel && (
            <ChangePill direction={direction} label={changeLabel} invertColor={invertColor} />
          )}
          {description && <span className="text-muted-foreground">{description}</span>}
          {sub && <span className="text-muted-foreground">{sub}</span>}
        </div>
        {spark && spark.length > 1 && (
          <div className="mt-3 -mb-1">
            <Sparkline data={spark} color={sparkColor ?? '#10b981'} height={36} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// =====================================================================
// RESOURCE CARD (with colored progress bar)
// =====================================================================

function ResourceCard({
  title,
  icon,
  value,
  max,
  displayValue,
  bucket,
  description,
  spark,
  sparkColor,
}: {
  title: string
  icon: React.ReactNode
  value: number
  max: number
  displayValue: string
  bucket: 'emerald' | 'amber' | 'red'
  description: string
  spark?: number[]
  sparkColor?: string
}) {
  const styles = PROGRESS_STYLES[bucket]
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0

  return (
    <Card className="group relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-emerald-500/5">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-teal-500/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </CardTitle>
        <div className={`rounded-md p-1.5 ${styles.bg} ${styles.text}`}>{icon}</div>
      </CardHeader>
      <CardContent className="relative">
        <div className="flex items-baseline justify-between">
          <div className={`text-3xl font-bold tracking-tight ${styles.text}`}>{displayValue}</div>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
          <motion.div
            className={`h-full ${styles.bar} rounded-full`}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          />
        </div>
        <p className="mt-2 truncate text-xs text-muted-foreground">{description}</p>
        {spark && spark.length > 1 && (
          <div className="mt-2 -mb-1">
            <Sparkline data={spark} color={sparkColor ?? '#10b981'} height={28} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// =====================================================================
// CHART CARD wrapper
// =====================================================================

function ChartCard({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string
  subtitle: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Card className="group transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="rounded-md bg-emerald-500/10 p-1 text-emerald-600">{icon}</span>
              {title}
            </CardTitle>
            <CardDescription className="mt-1">{subtitle}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

// =====================================================================
// SERVICE STATUS CARD
// =====================================================================

function ServiceStatusCard({
  activePipelines,
  activeFunctions,
  activeScrapers,
  activePipelineRuns,
  queuedCount,
  processingCount,
  queueTotal,
  health,
  heartbeatCount,
}: {
  activePipelines: number
  activeFunctions: number
  activeScrapers: number
  activePipelineRuns: number
  queuedCount: number
  processingCount: number
  queueTotal: number
  health: 'healthy' | 'degraded' | 'down'
  heartbeatCount: number
}) {
  const dotFor = (active: boolean, hasIssue = false) =>
    hasIssue ? 'bg-amber-500' : active ? 'bg-emerald-500' : 'bg-muted-foreground/40'

  return (
    <Card className="group transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Server className="h-4 w-4 text-emerald-600" />
          Service Status
        </CardTitle>
        <CardDescription>Active services & runtime counts</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3.5">
        <ServiceRow
          dot={dotFor(health === 'healthy')}
          label="API Server"
          value={health === 'healthy' ? 'Running' : health === 'degraded' ? 'Degraded' : 'Down'}
        />
        <ServiceRow
          dot={dotFor(activePipelineRuns > 0)}
          label="Pipeline Engine"
          value={`${activePipelines} configured · ${activePipelineRuns} running`}
          badge={`${activePipelines} active`}
        />
        <ServiceRow
          dot={dotFor(activeScrapers > 0)}
          label="Web Scraper"
          value={`${activeScrapers} running now`}
          badge={`${activeScrapers} active`}
        />
        <ServiceRow
          dot={dotFor(activeFunctions > 0)}
          label="Functions Runtime"
          value={`${activeFunctions} active`}
          badge={`${activeFunctions} active`}
        />
        <ServiceRow
          dot={dotFor(queueTotal === 0, queueTotal > 0 && processingCount > 0)}
          label="Priority Queue"
          value={`${queuedCount} queued · ${processingCount} processing`}
          badge={queueTotal > 0 ? `${queueTotal} total` : 'Empty'}
        />
        <ServiceRow
          dot={dotFor(heartbeatCount > 0)}
          label="Heartbeat Monitor"
          value={`${heartbeatCount} beats (24h)`}
        />
        <ServiceRow dot="bg-emerald-500" label="Storage Layer" value="OK" />
      </CardContent>
    </Card>
  )
}

function ServiceRow({
  dot,
  label,
  value,
  badge,
}: {
  dot: string
  label: string
  value: string
  badge?: string
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2.5">
        <div className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
        <span className="text-sm">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="hidden text-xs text-muted-foreground sm:inline">{value}</span>
        {badge && (
          <Badge variant="secondary" className="text-[10px]">
            {badge}
          </Badge>
        )}
      </div>
    </div>
  )
}

// =====================================================================
// QUICK ACTIONS CARD
// =====================================================================

const QUICK_ACTIONS: Array<{
  section: AdminSection
  label: string
  description: string
  icon: React.ReactNode
}> = [
  {
    section: 'tables',
    label: 'New Table',
    description: 'Define a collection',
    icon: <Database className="h-4 w-4" />,
  },
  {
    section: 'pipeline',
    label: 'New Pipeline',
    description: 'Ingest a source',
    icon: <GitBranch className="h-4 w-4" />,
  },
  {
    section: 'scraper',
    label: 'Web Scraper',
    description: 'Configure sitemap',
    icon: <Globe className="h-4 w-4" />,
  },
  {
    section: 'functions',
    label: 'Deploy Function',
    description: 'Serverless runtime',
    icon: <Code2 className="h-4 w-4" />,
  },
  {
    section: 'ai',
    label: 'Open AI / RAG',
    description: 'Chat with your data',
    icon: <Brain className="h-4 w-4" />,
  },
  {
    section: 'logs',
    label: 'View Logs',
    description: 'Errors & events',
    icon: <Shield className="h-4 w-4" />,
  },
]

function QuickActionsCard() {
  const setActiveSection = useAdminStore((s) => s.setActiveSection)
  return (
    <Card className="group transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-emerald-600" />
          Quick Actions
        </CardTitle>
        <CardDescription>Jump to common workflows</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2.5">
          {QUICK_ACTIONS.map((a) => (
            <button
              key={a.section}
              onClick={() => setActiveSection(a.section)}
              className="group/action flex items-start gap-3 rounded-lg border p-3 text-left transition-all hover:-translate-y-0.5 hover:border-emerald-500/40 hover:bg-emerald-500/5"
            >
              <div className="rounded-md bg-emerald-500/10 p-1.5 text-emerald-600 transition-colors group-hover/action:bg-emerald-500/20">
                {a.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{a.label}</span>
                  <ChevronRight className="h-3 w-3 text-muted-foreground transition-transform group-hover/action:translate-x-0.5" />
                </div>
                <p className="text-[11px] text-muted-foreground">{a.description}</p>
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// =====================================================================
// API QUICK REFERENCE CARD
// =====================================================================

const SDK_EXAMPLES: Array<{ label: string; code: Array<{ t: 'fn' | 'method' | 'str' | 'num' | 'punc' | 'kw' | 'comment' | 'plain'; v: string }> }> = [
  {
    label: 'Query a collection',
    code: [
      { t: 'fn', v: 'selfbase' },
      { t: 'punc', v: '.' },
      { t: 'method', v: 'collection' },
      { t: 'punc', v: '(' },
      { t: 'str', v: '"stocks"' },
      { t: 'punc', v: ')' },
      { t: 'punc', v: '.' },
      { t: 'method', v: 'get' },
      { t: 'punc', v: '()' },
    ],
  },
  {
    label: 'Insert a row',
    code: [
      { t: 'fn', v: 'selfbase' },
      { t: 'punc', v: '.' },
      { t: 'method', v: 'collection' },
      { t: 'punc', v: '(' },
      { t: 'str', v: '"users"' },
      { t: 'punc', v: ')' },
      { t: 'punc', v: '.' },
      { t: 'method', v: 'insert' },
      { t: 'punc', v: '({ ' },
      { t: 'kw', v: 'email' },
      { t: 'punc', v: ': ' },
      { t: 'str', v: '"a@b.com"' },
      { t: 'punc', v: ' })' },
    ],
  },
  {
    label: 'Subscribe realtime',
    code: [
      { t: 'fn', v: 'selfbase' },
      { t: 'punc', v: '.' },
      { t: 'method', v: 'channel' },
      { t: 'punc', v: '(' },
      { t: 'str', v: '"orders"' },
      { t: 'punc', v: ')' },
      { t: 'punc', v: '.' },
      { t: 'method', v: 'on' },
      { t: 'punc', v: '(' },
      { t: 'str', v: '"INSERT"' },
      { t: 'punc', v: ', cb)' },
    ],
  },
  {
    label: 'Invoke an AI function',
    code: [
      { t: 'fn', v: 'selfbase' },
      { t: 'punc', v: '.' },
      { t: 'method', v: 'functions' },
      { t: 'punc', v: '.' },
      { t: 'method', v: 'invoke' },
      { t: 'punc', v: '(' },
      { t: 'str', v: '"summarize"' },
      { t: 'punc', v: ', { input })' },
    ],
  },
]

const TOKEN_COLORS: Record<string, string> = {
  fn: 'text-emerald-600',
  method: 'text-teal-600',
  str: 'text-amber-600',
  num: 'text-amber-600',
  kw: 'text-rose-600',
  punc: 'text-muted-foreground',
  comment: 'text-muted-foreground/60 italic',
  plain: 'text-foreground',
}

function ApiReferenceCard() {
  return (
    <Card className="group transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <CircleDot className="h-4 w-4 text-emerald-600" />
              API Quick Reference
            </CardTitle>
            <CardDescription>Common SDK calls — copy &amp; ship</CardDescription>
          </div>
          <Badge variant="outline" className="font-mono text-[10px]">
            v1
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2.5">
          {SDK_EXAMPLES.map((ex, i) => (
            <div
              key={i}
              className="rounded-lg border bg-muted/30 p-3 transition-colors hover:bg-muted/60"
            >
              <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {ex.label}
              </div>
              <pre className="overflow-x-auto font-mono text-xs leading-relaxed [scrollbar-width:thin]">
                <code>
                  {ex.code.map((tok, j) => (
                    <span key={j} className={TOKEN_COLORS[tok.t]}>
                      {tok.v}
                    </span>
                  ))}
                </code>
              </pre>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <HardDrive className="h-3 w-3" />
          Base URL: <code className="font-mono text-emerald-600">/api/v1/data/&#123;table&#125;</code>
        </div>
      </CardContent>
    </Card>
  )
}

// =====================================================================
// HELPERS (load level label)
// =====================================================================

function loadLevelLabel(level: string): string {
  switch (level) {
    case 'low':
      return 'Low load — healthy'
    case 'moderate':
      return 'Moderate load'
    case 'high':
      return 'High load — monitor'
    case 'critical':
      return 'Critical — attention needed'
    default:
      return 'Steady'
  }
}

// =====================================================================
// SKELETON
// =====================================================================

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* hero skeleton */}
      <Skeleton className="h-[160px] w-full rounded-2xl" />

      {/* KPI row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-6 w-6 rounded-md" />
              </div>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-20" />
              <Skeleton className="mt-2 h-3 w-28" />
              <Skeleton className="mt-3 h-9 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Resource row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-6 w-6 rounded-md" />
              </div>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
              <Skeleton className="mt-2 h-2 w-full" />
              <Skeleton className="mt-2 h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-56" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[280px] w-full" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-3 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[220px] w-full" />
        </CardContent>
      </Card>
    </div>
  )
}
