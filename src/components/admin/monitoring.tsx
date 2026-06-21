'use client'

import { useState, useEffect } from 'react'
import {
  Activity,
  Bell,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Heart,
  Cpu,
  HardDrive,
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Zap,
  Gauge,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { Label } from '@/components/ui/label'
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
import { useToast } from '@/hooks/use-toast'
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts'

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
}

interface TableMetricItem {
  tableName: string
  callCount: number
  avgLatencyMs: number
  maxLatencyMs: number
  errorCount: number
}

const generateHeartbeatData = (): HeartbeatRecord[] => {
  return Array.from({ length: 60 }, (_, i) => {
    const d = new Date()
    d.setMinutes(d.getMinutes() - (59 - i))
    return {
      id: `h${i}`,
      recordedAt: d.toISOString(),
      cpuTotal: Math.floor(Math.random() * 40 + 15),
      cpuScraper: Math.floor(Math.random() * 15 + 3),
      cpuApi: Math.floor(Math.random() * 10 + 5),
      cpuFunctions: Math.floor(Math.random() * 8 + 2),
      ramUsedMb: Math.floor(Math.random() * 200 + 300),
      diskUsedMb: Math.floor(Math.random() * 100 + 1900),
      activeConnections: Math.floor(Math.random() * 30 + 10),
      reqPerSec: Math.floor(Math.random() * 100 + 80),
      loadScore: Math.floor(Math.random() * 50 + 10),
    }
  })
}

const mockAlertConfigs: AlertConfigItem[] = [
  { id: '1', metricType: 'cpu', threshold: 80, operator: '>', duration: 300, webhookUrl: 'https://hooks.slack.com/xxx', emailTo: null, isEnabled: true, lastTriggeredAt: '2025-06-20T14:00:00Z' },
  { id: '2', metricType: 'error_rate', threshold: 5, operator: '>', duration: 60, webhookUrl: null, emailTo: 'admin@selfbase.io', isEnabled: true, lastTriggeredAt: null },
  { id: '3', metricType: 'disk', threshold: 90, operator: '>=', duration: 600, webhookUrl: 'https://hooks.slack.com/xxx', emailTo: 'ops@selfbase.io', isEnabled: false, lastTriggeredAt: null },
]

const mockTableMetrics: TableMetricItem[] = [
  { tableName: 'users', callCount: 1420, avgLatencyMs: 12, maxLatencyMs: 450, errorCount: 2 },
  { tableName: 'products', callCount: 3250, avgLatencyMs: 18, maxLatencyMs: 1200, errorCount: 5 },
  { tableName: 'orders', callCount: 8900, avgLatencyMs: 25, maxLatencyMs: 800, errorCount: 12 },
  { tableName: 'articles', callCount: 2100, avgLatencyMs: 35, maxLatencyMs: 2100, errorCount: 8 },
  { tableName: 'sessions', callCount: 6500, avgLatencyMs: 5, maxLatencyMs: 150, errorCount: 0 },
  { tableName: 'crypto_prices', callCount: 12500, avgLatencyMs: 3, maxLatencyMs: 80, errorCount: 1 },
]

export function MonitoringView() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [heartbeatData, setHeartbeatData] = useState<HeartbeatRecord[]>([])
  const [alertConfigs, setAlertConfigs] = useState<AlertConfigItem[]>([])
  const [tableMetrics, setTableMetrics] = useState<TableMetricItem[]>([])
  const [showAlertDialog, setShowAlertDialog] = useState(false)
  const [newAlertMetric, setNewAlertMetric] = useState('cpu')
  const [newAlertThreshold, setNewAlertThreshold] = useState('')
  const [newAlertOperator, setNewAlertOperator] = useState('>')

  useEffect(() => {
    const timer = setTimeout(() => {
      setHeartbeatData(generateHeartbeatData())
      setAlertConfigs(mockAlertConfigs)
      setTableMetrics(mockTableMetrics)
      setLoading(false)
    }, 800)
    return () => clearTimeout(timer)
  }, [])

  const handleCreateAlert = () => {
    if (!newAlertThreshold) return
    const alert: AlertConfigItem = {
      id: String(Date.now()), metricType: newAlertMetric, threshold: parseFloat(newAlertThreshold),
      operator: newAlertOperator, duration: 300, webhookUrl: null, emailTo: null,
      isEnabled: true, lastTriggeredAt: null,
    }
    setAlertConfigs((prev) => [...prev, alert])
    setShowAlertDialog(false); setNewAlertThreshold('')
    toast({ title: 'Alert created' })
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>)}</div>
        <Skeleton className="h-[300px] w-full" />
      </div>
    )
  }

  const latest = heartbeatData[heartbeatData.length - 1]
  const uptimePercent = 99.7

  const chartData = heartbeatData.map((h) => ({
    time: new Date(h.recordedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    cpu: h.cpuTotal,
    ram: Math.round((h.ramUsedMb / 800) * 100),
    disk: Math.round((h.diskUsedMb / 5000) * 100),
    load: h.loadScore,
    rps: h.reqPerSec,
    connections: h.activeConnections,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Monitoring</h1>
        <p className="text-muted-foreground">System health, heartbeat logs, and performance metrics</p>
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Uptime</div>
                <div className="text-2xl font-bold text-emerald-600">{uptimePercent}%</div>
              </div>
              <div className="rounded-md bg-emerald-500/10 p-2"><Heart className="h-5 w-5 text-emerald-600" /></div>
            </div>
            <Progress value={uptimePercent} className="mt-2 h-1.5" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">CPU Usage</div>
                <div className="text-2xl font-bold">{latest?.cpuTotal ?? 0}%</div>
              </div>
              <div className="rounded-md bg-amber-500/10 p-2"><Cpu className="h-5 w-5 text-amber-600" /></div>
            </div>
            <Progress value={latest?.cpuTotal ?? 0} className="mt-2 h-1.5" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">RAM Usage</div>
                <div className="text-2xl font-bold">{latest ? Math.round((latest.ramUsedMb / 800) * 100) : 0}%</div>
              </div>
              <div className="rounded-md bg-blue-500/10 p-2"><HardDrive className="h-5 w-5 text-blue-600" /></div>
            </div>
            <Progress value={latest ? (latest.ramUsedMb / 800) * 100 : 0} className="mt-2 h-1.5" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Load Score</div>
                <div className="text-2xl font-bold">{latest?.loadScore ?? 0}/100</div>
              </div>
              <div className="rounded-md bg-emerald-500/10 p-2"><Gauge className="h-5 w-5 text-emerald-600" /></div>
            </div>
            <Progress value={latest?.loadScore ?? 0} className="mt-2 h-1.5" />
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="heartbeat" className="space-y-4">
        <TabsList>
          <TabsTrigger value="heartbeat" className="gap-1.5"><Activity className="h-3.5 w-3.5" />Heartbeat</TabsTrigger>
          <TabsTrigger value="tables" className="gap-1.5"><Zap className="h-3.5 w-3.5" />Table Metrics</TabsTrigger>
          <TabsTrigger value="alerts" className="gap-1.5"><Bell className="h-3.5 w-3.5" />Alerts</TabsTrigger>
        </TabsList>

        {/* Heartbeat Tab */}
        <TabsContent value="heartbeat" className="space-y-4">
          {/* CPU & RAM Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">CPU & RAM (Last 60 minutes)</CardTitle>
              <CardDescription>Resource utilization trend</CardDescription>
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
                    <XAxis dataKey="time" tick={{ fontSize: 10 }} interval={9} />
                    <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                    <Area type="monotone" dataKey="cpu" stroke="#10b981" fill="url(#cpuG)" strokeWidth={2} name="CPU %" />
                    <Area type="monotone" dataKey="ram" stroke="#14b8a6" fill="url(#ramG)" strokeWidth={2} name="RAM %" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Requests & Connections */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Requests/sec</CardTitle><CardDescription>Incoming request rate</CardDescription></CardHeader>
              <CardContent>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="time" tick={{ fontSize: 10 }} interval={9} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                      <Line type="monotone" dataKey="rps" stroke="#10b981" strokeWidth={2} dot={false} name="Req/sec" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Active Connections</CardTitle><CardDescription>Concurrent connections</CardDescription></CardHeader>
              <CardContent>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="time" tick={{ fontSize: 10 }} interval={9} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                      <Line type="monotone" dataKey="connections" stroke="#14b8a6" strokeWidth={2} dot={false} name="Connections" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Load Score Chart */}
          <Card>
            <CardHeader><CardTitle className="text-base">Load Score (Last 60 minutes)</CardTitle><CardDescription>Composite load indicator</CardDescription></CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData.filter((_, i) => i % 5 === 0)}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                    <Bar dataKey="load" fill="#10b981" radius={[4, 4, 0, 0]} name="Load Score" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Table Metrics Tab */}
        <TabsContent value="tables" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Per-Table Metrics</CardTitle><CardDescription>Performance metrics by table (last 24h)</CardDescription></CardHeader>
            <CardContent className="p-0">
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
                  {tableMetrics.map((tm) => (
                    <TableRow key={tm.tableName}>
                      <TableCell className="font-mono font-medium">{tm.tableName}</TableCell>
                      <TableCell>{tm.callCount.toLocaleString()}</TableCell>
                      <TableCell className="font-mono">{tm.avgLatencyMs}ms</TableCell>
                      <TableCell className="font-mono">{tm.maxLatencyMs}ms</TableCell>
                      <TableCell>
                        {tm.errorCount > 0 ? (
                          <Badge variant="outline" className="text-red-600 border-red-200">{tm.errorCount}</Badge>
                        ) : (
                          <Badge variant="outline" className="text-emerald-600 border-emerald-200">0</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {tm.errorCount === 0 && tm.avgLatencyMs < 30 ? (
                          <div className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /><span className="text-xs">Healthy</span></div>
                        ) : tm.errorCount > 5 || tm.avgLatencyMs > 100 ? (
                          <div className="flex items-center gap-1 text-red-600"><XCircle className="h-3.5 w-3.5" /><span className="text-xs">Degraded</span></div>
                        ) : (
                          <div className="flex items-center gap-1 text-amber-600"><AlertTriangle className="h-3.5 w-3.5" /><span className="text-xs">Warning</span></div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Configure alerts for metric thresholds</p>
            <Dialog open={showAlertDialog} onOpenChange={setShowAlertDialog}>
              <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" />New Alert</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create Alert</DialogTitle><DialogDescription>Set up a metric alert</DialogDescription></DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2"><Label>Metric</Label>
                    <Select value={newAlertMetric} onValueChange={setNewAlertMetric}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cpu">CPU Usage</SelectItem>
                        <SelectItem value="ram">RAM Usage</SelectItem>
                        <SelectItem value="req_per_sec">Requests/sec</SelectItem>
                        <SelectItem value="error_rate">Error Rate</SelectItem>
                        <SelectItem value="disk">Disk Usage</SelectItem>
                        <SelectItem value="latency">Latency</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-3">
                    <div className="space-y-2 flex-1"><Label>Operator</Label>
                      <Select value={newAlertOperator} onValueChange={setNewAlertOperator}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value=">">&gt; Greater than</SelectItem>
                          <SelectItem value=">=">&ge; Greater or equal</SelectItem>
                          <SelectItem value="<">&lt; Less than</SelectItem>
                          <SelectItem value="<=">&le; Less or equal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 flex-1"><Label>Threshold</Label><Input type="number" value={newAlertThreshold} onChange={(e) => setNewAlertThreshold(e.target.value)} placeholder="80" /></div>
                  </div>
                </div>
                <DialogFooter><Button variant="outline" onClick={() => setShowAlertDialog(false)}>Cancel</Button><Button onClick={handleCreateAlert}>Create Alert</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Metric</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Notification</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Triggered</TableHead>
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alertConfigs.map((alert) => (
                    <TableRow key={alert.id}>
                      <TableCell className="font-medium capitalize">{alert.metricType.replace('_', ' ')}</TableCell>
                      <TableCell className="font-mono">{alert.operator} {alert.threshold}</TableCell>
                      <TableCell>{alert.duration}s</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {alert.webhookUrl && <Badge variant="outline" className="text-xs">Webhook</Badge>}
                          {alert.emailTo && <Badge variant="outline" className="text-xs">Email</Badge>}
                          {!alert.webhookUrl && !alert.emailTo && <span className="text-xs text-muted-foreground">None</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={alert.isEnabled ? 'default' : 'secondary'} className="text-xs">
                          {alert.isEnabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{alert.lastTriggeredAt ? new Date(alert.lastTriggeredAt).toLocaleDateString() : 'Never'}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                          setAlertConfigs((prev) => prev.filter((a) => a.id !== alert.id))
                          toast({ title: 'Alert deleted', variant: 'destructive' })
                        }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
