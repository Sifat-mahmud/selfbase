'use client'

import { useEffect, useState } from 'react'
import {
  Activity,
  Database,
  Users,
  HardDrive,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Server,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts'

interface DashboardStats {
  serverHealth: 'healthy' | 'degraded' | 'down'
  activeConnections: number
  totalTables: number
  totalRows: number
  uptime: string
  loadScore: number
  cpuUsage: number
  ramUsage: number
  diskUsage: number
  reqPerSec: number
  errorRate: number
  pipelinesActive: number
  functionsActive: number
}

interface ActivityItem {
  id: string
  type: 'table' | 'pipeline' | 'function' | 'alert' | 'user'
  message: string
  time: string
  status?: 'success' | 'error' | 'warning'
}

const mockStats: DashboardStats = {
  serverHealth: 'healthy',
  activeConnections: 24,
  totalTables: 12,
  totalRows: 48520,
  uptime: '14d 6h 32m',
  loadScore: 34,
  cpuUsage: 23,
  ramUsage: 56,
  diskUsage: 42,
  reqPerSec: 142,
  errorRate: 0.3,
  pipelinesActive: 5,
  functionsActive: 8,
}

const mockActivity: ActivityItem[] = [
  { id: '1', type: 'pipeline', message: 'REST pipeline "Market Data" completed — 1,240 rows fetched', time: '2m ago', status: 'success' },
  { id: '2', type: 'table', message: 'Table "users" schema updated — new column: phone', time: '8m ago', status: 'success' },
  { id: '3', type: 'function', message: 'Function "emailWorker" timed out after 30s', time: '15m ago', status: 'error' },
  { id: '4', type: 'alert', message: 'CPU usage exceeded 80% threshold', time: '22m ago', status: 'warning' },
  { id: '5', type: 'pipeline', message: 'RSS pipeline "News Feed" failed — connection timeout', time: '31m ago', status: 'error' },
  { id: '6', type: 'user', message: 'New API key created: "prod-deploy-key"', time: '45m ago', status: 'success' },
  { id: '7', type: 'table', message: 'Table "orders" hit 10,000 rows milestone', time: '1h ago', status: 'success' },
  { id: '8', type: 'function', message: 'Function "webhookHandler" deployed', time: '1.5h ago', status: 'success' },
]

const cpuChartData = Array.from({ length: 24 }, (_, i) => ({
  time: `${String(i).padStart(2, '0')}:00`,
  cpu: Math.floor(Math.random() * 40 + 15),
  ram: Math.floor(Math.random() * 25 + 45),
}))

const requestChartData = Array.from({ length: 7 }, (_, i) => {
  const d = new Date()
  d.setDate(d.getDate() - (6 - i))
  return {
    day: d.toLocaleDateString('en-US', { weekday: 'short' }),
    requests: Math.floor(Math.random() * 5000 + 8000),
    errors: Math.floor(Math.random() * 50 + 10),
  }
})

export function DashboardView() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setStats(mockStats)
      setLoading(false)
    }, 800)
    return () => clearTimeout(timer)
  }, [])

  if (loading) {
    return <DashboardSkeleton />
  }

  const healthColor = stats?.serverHealth === 'healthy'
    ? 'text-emerald-500'
    : stats?.serverHealth === 'degraded'
      ? 'text-amber-500'
      : 'text-red-500'

  const healthBg = stats?.serverHealth === 'healthy'
    ? 'bg-emerald-500/10'
    : stats?.serverHealth === 'degraded'
      ? 'bg-amber-500/10'
      : 'bg-red-500/10'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">SelfBase server overview and health metrics</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className={`${healthBg} ${healthColor} border-0 font-medium`}>
            <Server className="mr-1 h-3 w-3" />
            {stats?.serverHealth === 'healthy' ? 'All Systems Operational' : stats?.serverHealth === 'degraded' ? 'Degraded Performance' : 'System Down'}
          </Badge>
          <Badge variant="outline" className="font-mono text-xs">
            <Clock className="mr-1 h-3 w-3" />
            {stats?.uptime}
          </Badge>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Active Connections"
          value={stats?.activeConnections ?? 0}
          icon={<Users className="h-4 w-4" />}
          change="+12%"
          changeDirection="up"
          description="vs last hour"
        />
        <KPICard
          title="Total Tables"
          value={stats?.totalTables ?? 0}
          icon={<Database className="h-4 w-4" />}
          change="+2"
          changeDirection="up"
          description="new this week"
        />
        <KPICard
          title="Requests/sec"
          value={stats?.reqPerSec ?? 0}
          icon={<Zap className="h-4 w-4" />}
          change="-8%"
          changeDirection="down"
          description="vs last hour"
        />
        <KPICard
          title="Error Rate"
          value={`${stats?.errorRate ?? 0}%`}
          icon={<AlertTriangle className="h-4 w-4" />}
          change="-0.1%"
          changeDirection="down"
          description="improving"
          valueColor="text-emerald-600"
        />
      </div>

      {/* Load & Resources */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Load Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.loadScore ?? 0}<span className="text-sm font-normal text-muted-foreground">/100</span></div>
            <Progress value={stats?.loadScore ?? 0} className="mt-2 h-2" />
            <p className="mt-1 text-xs text-muted-foreground">
              {(stats?.loadScore ?? 0) < 50 ? 'Low load — healthy' : (stats?.loadScore ?? 0) < 80 ? 'Moderate load' : 'High load — attention needed'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.cpuUsage ?? 0}%</div>
            <Progress value={stats?.cpuUsage ?? 0} className="mt-2 h-2" />
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <span>API: 12%</span>
              <span>•</span>
              <span>Scraper: 6%</span>
              <span>•</span>
              <span>Functions: 5%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">RAM Usage</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.ramUsage ?? 0}%</div>
            <Progress value={stats?.ramUsage ?? 0} className="mt-2 h-2" />
            <p className="mt-1 text-xs text-muted-foreground">~448 MB / 800 MB allocated</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Disk Usage</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.diskUsage ?? 0}%</div>
            <Progress value={stats?.diskUsage ?? 0} className="mt-2 h-2" />
            <p className="mt-1 text-xs text-muted-foreground">~2.1 GB / 5 GB available</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">CPU & RAM Trend (24h)</CardTitle>
            <CardDescription>Resource utilization over the last 24 hours</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cpuChartData}>
                  <defs>
                    <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="ramGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="time" className="text-xs" tick={{ fontSize: 11 }} />
                  <YAxis className="text-xs" tick={{ fontSize: 11 }} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Area type="monotone" dataKey="cpu" stroke="#10b981" fill="url(#cpuGrad)" strokeWidth={2} name="CPU %" />
                  <Area type="monotone" dataKey="ram" stroke="#14b8a6" fill="url(#ramGrad)" strokeWidth={2} name="RAM %" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Requests & Errors (7d)</CardTitle>
            <CardDescription>Weekly request volume and error count</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={requestChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="day" className="text-xs" tick={{ fontSize: 11 }} />
                  <YAxis className="text-xs" tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="requests" fill="#10b981" radius={[4, 4, 0, 0]} name="Requests" />
                  <Bar dataKey="errors" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Errors" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats & Activity */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Quick Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Service Status</CardTitle>
            <CardDescription>Active services and integrations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-sm">API Server</span>
              </div>
              <Badge variant="secondary" className="text-xs">Running</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-sm">Pipeline Engine</span>
              </div>
              <Badge variant="secondary" className="text-xs">{stats?.pipelinesActive} Active</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-sm">Functions Runtime</span>
              </div>
              <Badge variant="secondary" className="text-xs">{stats?.functionsActive} Active</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-sm">WebSocket Server</span>
              </div>
              <Badge variant="secondary" className="text-xs">Connected</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-amber-500" />
                <span className="text-sm">AI Embedding Engine</span>
              </div>
              <Badge variant="outline" className="text-xs">Standby</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-sm">Storage Layer</span>
              </div>
              <Badge variant="secondary" className="text-xs">OK</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
            <CardDescription>Latest events and operations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-[360px] overflow-y-auto pr-2">
              {mockActivity.map((item) => (
                <div key={item.id} className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50">
                  <div className={`mt-0.5 rounded-full p-1 ${item.status === 'success' ? 'bg-emerald-500/10 text-emerald-600' : item.status === 'error' ? 'bg-red-500/10 text-red-600' : 'bg-amber-500/10 text-amber-600'}`}>
                    {item.status === 'success' ? <CheckCircle2 className="h-3.5 w-3.5" /> : item.status === 'error' ? <AlertTriangle className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-tight">{item.message}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{item.time}</p>
                  </div>
                  <Badge variant="outline" className="shrink-0 text-xs capitalize">
                    {item.type}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function KPICard({
  title,
  value,
  icon,
  change,
  changeDirection,
  description,
  valueColor,
}: {
  title: string
  value: number | string
  icon: React.ReactNode
  change: string
  changeDirection: 'up' | 'down'
  description: string
  valueColor?: string
}) {
  const isPositive = changeDirection === 'up'
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="rounded-md bg-emerald-500/10 p-1.5 text-emerald-600">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${valueColor ?? ''}`}>{typeof value === 'number' ? value.toLocaleString() : value}</div>
        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <span className={`flex items-center gap-0.5 font-medium ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
            {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {change}
          </span>
          <span>{description}</span>
        </div>
      </CardContent>
    </Card>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-6 w-28" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-28" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-20" />
              <Skeleton className="mt-2 h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
              <Skeleton className="mt-2 h-2 w-full" />
              <Skeleton className="mt-1 h-3 w-36" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-3 w-64" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[280px] w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
