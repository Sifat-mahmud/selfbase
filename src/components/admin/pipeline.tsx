'use client'

import { useState, useEffect } from 'react'
import {
  GitBranch,
  Plus,
  Play,
  Pause,
  RefreshCw,
  MoreHorizontal,
  Pencil,
  Trash2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Globe,
  Rss,
  Wifi,
  ArrowRight,
  ExternalLink,
  Search,
  Filter,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface PipelineSourceItem {
  id: string
  name: string
  description: string | null
  sourceType: 'rest' | 'rss' | 'websocket' | 'scraper'
  url: string
  method: string
  isActive: boolean
  fetchInterval: number
  targetTableName: string | null
  columnMappings: { src: string; target: string; type: string; transform?: string }[]
  lastRun: PipelineRunItem | null
  createdAt: string
}

interface PipelineRunItem {
  id: string
  status: 'pending' | 'running' | 'success' | 'failed' | 'timeout'
  startedAt: string
  completedAt: string | null
  durationMs: number | null
  rowsFetched: number
  rowsWritten: number
  rowsFailed: number
  isManual: boolean
}

const sourceIcons = {
  rest: Globe,
  rss: Rss,
  websocket: Wifi,
  scraper: ExternalLink,
}

const mockPipelines: PipelineSourceItem[] = [
  {
    id: '1', name: 'Market Data Feed', description: 'Fetch live market data from AlphaVantage API',
    sourceType: 'rest', url: 'https://api.alphavantage.io/query', method: 'GET',
    isActive: true, fetchInterval: 300, targetTableName: 'market_data',
    columnMappings: [
      { src: 'symbol', target: 'ticker', type: 'TEXT' },
      { src: 'price', target: 'current_price', type: 'DECIMAL', transform: 'toFloat' },
      { src: 'volume', target: 'volume', type: 'INTEGER' },
    ],
    lastRun: { id: 'r1', status: 'success', startedAt: '2025-06-21T10:00:00Z', completedAt: '2025-06-21T10:00:02Z', durationMs: 2100, rowsFetched: 240, rowsWritten: 238, rowsFailed: 2, isManual: false },
    createdAt: '2025-03-15',
  },
  {
    id: '2', name: 'Tech News RSS', description: 'Aggregate tech news from multiple RSS feeds',
    sourceType: 'rss', url: 'https://hnrss.org/frontpage', method: 'GET',
    isActive: true, fetchInterval: 600, targetTableName: 'articles',
    columnMappings: [
      { src: 'title', target: 'title', type: 'TEXT' },
      { src: 'link', target: 'url', type: 'TEXT' },
      { src: 'description', target: 'content', type: 'TEXT' },
    ],
    lastRun: { id: 'r2', status: 'success', startedAt: '2025-06-21T09:50:00Z', completedAt: '2025-06-21T09:50:05Z', durationMs: 5200, rowsFetched: 30, rowsWritten: 28, rowsFailed: 2, isManual: false },
    createdAt: '2025-04-01',
  },
  {
    id: '3', name: 'Crypto WebSocket', description: 'Real-time crypto prices via WebSocket',
    sourceType: 'websocket', url: 'wss://stream.binance.com:9443/ws/btcusdt', method: 'GET',
    isActive: true, fetchInterval: 0, targetTableName: 'crypto_prices',
    columnMappings: [
      { src: 'p', target: 'price', type: 'DECIMAL' },
      { src: 'q', target: 'quantity', type: 'DECIMAL' },
      { src: 'E', target: 'event_time', type: 'TIMESTAMP' },
    ],
    lastRun: { id: 'r3', status: 'running', startedAt: '2025-06-21T00:00:00Z', completedAt: null, durationMs: null, rowsFetched: 125400, rowsWritten: 125380, rowsFailed: 20, isManual: false },
    createdAt: '2025-05-10',
  },
  {
    id: '4', name: 'Weather Data', description: 'Fetch weather forecast data',
    sourceType: 'rest', url: 'https://api.openweathermap.org/data/2.5/forecast', method: 'GET',
    isActive: false, fetchInterval: 3600, targetTableName: 'weather',
    columnMappings: [
      { src: 'temp', target: 'temperature', type: 'DECIMAL' },
      { src: 'humidity', target: 'humidity', type: 'INTEGER' },
    ],
    lastRun: { id: 'r4', status: 'failed', startedAt: '2025-06-20T12:00:00Z', completedAt: '2025-06-20T12:00:30Z', durationMs: 30000, rowsFetched: 0, rowsWritten: 0, rowsFailed: 1, isManual: false },
    createdAt: '2025-05-20',
  },
]

const runChartData = Array.from({ length: 7 }, (_, i) => {
  const d = new Date(); d.setDate(d.getDate() - (6 - i))
  return {
    day: d.toLocaleDateString('en-US', { weekday: 'short' }),
    success: Math.floor(Math.random() * 20 + 10),
    failed: Math.floor(Math.random() * 3),
  }
})

const statusIcons = {
  pending: Clock,
  running: RefreshCw,
  success: CheckCircle2,
  failed: XCircle,
  timeout: AlertTriangle,
}

const statusColors = {
  pending: 'text-amber-500',
  running: 'text-blue-500',
  success: 'text-emerald-500',
  failed: 'text-red-500',
  timeout: 'text-amber-500',
}

export function PipelineView() {
  const { toast } = useToast()
  const [pipelines, setPipelines] = useState<PipelineSourceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newName, setNewName] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [newType, setNewType] = useState<'rest' | 'rss' | 'websocket' | 'scraper'>('rest')
  const [selectedPipeline, setSelectedPipeline] = useState<PipelineSourceItem | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => { setPipelines(mockPipelines); setLoading(false) }, 700)
    return () => clearTimeout(timer)
  }, [])

  const handleCreate = () => {
    if (!newName.trim() || !newUrl.trim()) return
    const newPipeline: PipelineSourceItem = {
      id: String(Date.now()), name: newName, description: null, sourceType: newType,
      url: newUrl, method: 'GET', isActive: false, fetchInterval: 300,
      targetTableName: null, columnMappings: [], lastRun: null, createdAt: new Date().toISOString(),
    }
    setPipelines((prev) => [...prev, newPipeline])
    setShowCreateDialog(false); setNewName(''); setNewUrl('')
    toast({ title: 'Pipeline created', description: `"${newName}" has been created.` })
  }

  const handleToggleActive = (id: string) => {
    setPipelines((prev) => prev.map((p) => p.id === id ? { ...p, isActive: !p.isActive } : p))
    toast({ title: 'Pipeline updated' })
  }

  const handleRunNow = (id: string) => {
    toast({ title: 'Pipeline triggered', description: 'Manual run started.' })
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between"><Skeleton className="h-8 w-48" /><Skeleton className="h-9 w-36" /></div>
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-32 w-full" /></CardContent></Card>
          ))}
        </div>
      </div>
    )
  }

  if (selectedPipeline) {
    const SourceIcon = sourceIcons[selectedPipeline.sourceType]
    const LastStatusIcon = selectedPipeline.lastRun ? statusIcons[selectedPipeline.lastRun.status] : Clock
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setSelectedPipeline(null)}>
            <ArrowRight className="h-4 w-4 rotate-180" /> Back
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <SourceIcon className="h-5 w-5 text-emerald-500" />
          <h1 className="text-2xl font-bold tracking-tight">{selectedPipeline.name}</h1>
          <Badge variant="outline" className="capitalize">{selectedPipeline.sourceType}</Badge>
          <Badge variant={selectedPipeline.isActive ? 'default' : 'secondary'}>
            {selectedPipeline.isActive ? 'Active' : 'Paused'}
          </Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card><CardContent className="pt-4"><div className="text-sm text-muted-foreground">Source Type</div><div className="text-lg font-bold capitalize">{selectedPipeline.sourceType}</div></CardContent></Card>
          <Card><CardContent className="pt-4"><div className="text-sm text-muted-foreground">Fetch Interval</div><div className="text-lg font-bold">{selectedPipeline.fetchInterval > 0 ? `${selectedPipeline.fetchInterval}s` : 'Real-time'}</div></CardContent></Card>
          <Card><CardContent className="pt-4"><div className="text-sm text-muted-foreground">Target Table</div><div className="text-lg font-bold font-mono">{selectedPipeline.targetTableName ?? '—'}</div></CardContent></Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Last Run</div>
              <div className="flex items-center gap-1">
                {selectedPipeline.lastRun && <LastStatusIcon className={`h-4 w-4 ${statusColors[selectedPipeline.lastRun.status]}`} />}
                <span className="text-lg font-bold capitalize">{selectedPipeline.lastRun?.status ?? 'Never'}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Column Mappings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Column Mappings</CardTitle>
            <CardDescription>Source-to-target field mappings</CardDescription>
          </CardHeader>
          <CardContent>
            {selectedPipeline.columnMappings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <GitBranch className="h-10 w-10 mb-2 opacity-40" />
                <p className="text-sm">No column mappings configured</p>
                <Button variant="outline" size="sm" className="mt-2"><Plus className="mr-1 h-3.5 w-3.5" />Add Mapping</Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source Field</TableHead>
                    <TableHead className="w-8" />
                    <TableHead>Target Column</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Transform</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedPipeline.columnMappings.map((m, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-sm">{m.src}</TableCell>
                      <TableCell><ArrowRight className="h-3.5 w-3.5 text-muted-foreground" /></TableCell>
                      <TableCell className="font-mono text-sm font-medium">{m.target}</TableCell>
                      <TableCell><Badge variant="outline" className="font-mono text-xs">{m.type}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{m.transform ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Run History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Run History</CardTitle>
            <CardDescription>Pipeline execution history</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <p className="text-sm">Run history will appear here</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pipeline Studio</h1>
          <p className="text-muted-foreground">Configure and manage data source ingestion</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" />New Pipeline</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Pipeline Source</DialogTitle><DialogDescription>Configure a new data ingestion pipeline</DialogDescription></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2"><Label>Name</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="My Pipeline" /></div>
              <div className="space-y-2"><Label>Source Type</Label>
                <Select value={newType} onValueChange={(v) => setNewType(v as typeof newType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rest">REST API</SelectItem>
                    <SelectItem value="rss">RSS Feed</SelectItem>
                    <SelectItem value="websocket">WebSocket</SelectItem>
                    <SelectItem value="scraper">Web Scraper</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>URL</Label><Input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://api.example.com/data" /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
              <Button onClick={handleCreate}>Create Pipeline</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Pipeline Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="pt-4"><div className="text-sm text-muted-foreground">Total Pipelines</div><div className="text-2xl font-bold">{pipelines.length}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-sm text-muted-foreground">Active</div><div className="text-2xl font-bold text-emerald-600">{pipelines.filter(p => p.isActive).length}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-sm text-muted-foreground">Failed</div><div className="text-2xl font-bold text-red-600">{pipelines.filter(p => p.lastRun?.status === 'failed').length}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-sm text-muted-foreground">Total Rows Written</div><div className="text-2xl font-bold">{pipelines.reduce((s, p) => s + (p.lastRun?.rowsWritten ?? 0), 0).toLocaleString()}</div></CardContent></Card>
      </div>

      {/* Run Chart */}
      <Card>
        <CardHeader><CardTitle className="text-base">Pipeline Runs (7d)</CardTitle><CardDescription>Success vs failed runs over the last week</CardDescription></CardHeader>
        <CardContent>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={runChartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                <Bar dataKey="success" fill="#10b981" radius={[4, 4, 0, 0]} name="Success" />
                <Bar dataKey="failed" fill="#ef4444" radius={[4, 4, 0, 0]} name="Failed" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Pipeline Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {pipelines.map((pipeline) => {
          const SourceIcon = sourceIcons[pipeline.sourceType]
          const StatusIcon = pipeline.lastRun ? statusIcons[pipeline.lastRun.status] : Clock
          return (
            <Card key={pipeline.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedPipeline(pipeline)}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="rounded-md bg-emerald-500/10 p-1.5"><SourceIcon className="h-4 w-4 text-emerald-600" /></div>
                    <CardTitle className="text-base">{pipeline.name}</CardTitle>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleRunNow(pipeline.id) }}><Play className="mr-2 h-3.5 w-3.5" />Run Now</DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleToggleActive(pipeline.id) }}>
                        {pipeline.isActive ? <><Pause className="mr-2 h-3.5 w-3.5" />Pause</> : <><Play className="mr-2 h-3.5 w-3.5" />Activate</>}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={(e) => e.stopPropagation()}><Trash2 className="mr-2 h-3.5 w-3.5" />Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <CardDescription className="line-clamp-1">{pipeline.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize text-xs">{pipeline.sourceType}</Badge>
                    {pipeline.isActive ? <Badge className="bg-emerald-500/10 text-emerald-600 border-0 text-xs">Active</Badge> : <Badge variant="secondary" className="text-xs">Paused</Badge>}
                  </div>
                  {pipeline.lastRun && (
                    <div className="flex items-center gap-1">
                      <StatusIcon className={`h-3.5 w-3.5 ${statusColors[pipeline.lastRun.status]}`} />
                      <span className={`text-xs font-medium capitalize ${statusColors[pipeline.lastRun.status]}`}>{pipeline.lastRun.status}</span>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-md bg-muted/50 p-2"><div className="text-xs text-muted-foreground">Fetched</div><div className="text-sm font-bold">{pipeline.lastRun?.rowsFetched.toLocaleString() ?? '—'}</div></div>
                  <div className="rounded-md bg-muted/50 p-2"><div className="text-xs text-muted-foreground">Written</div><div className="text-sm font-bold">{pipeline.lastRun?.rowsWritten.toLocaleString() ?? '—'}</div></div>
                  <div className="rounded-md bg-muted/50 p-2"><div className="text-xs text-muted-foreground">Failed</div><div className="text-sm font-bold text-red-500">{pipeline.lastRun?.rowsFailed ?? '—'}</div></div>
                </div>
                {pipeline.targetTableName && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <ArrowRight className="h-3 w-3" />
                    <span className="font-mono">{pipeline.targetTableName}</span>
                    <span className="mx-1">·</span>
                    <span>{pipeline.fetchInterval > 0 ? `Every ${pipeline.fetchInterval}s` : 'Real-time'}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
