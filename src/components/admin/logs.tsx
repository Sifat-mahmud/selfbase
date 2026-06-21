'use client'

import { useState, useEffect } from 'react'
import {
  FileText,
  AlertTriangle,
  AlertCircle,
  Info,
  Search,
  Filter,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  XCircle,
  Clock,
  Download,
  Trash2,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'

interface LogEntry {
  id: string
  level: 'error' | 'warning' | 'info'
  source: 'system' | 'pipeline' | 'scraper' | 'function' | 'api'
  message: string
  details: string | null
  tableName: string | null
  sourceName: string | null
  occurredAt: string
}

const mockLogs: LogEntry[] = [
  { id: '1', level: 'error', source: 'pipeline', message: 'REST pipeline "Weather Data" connection timeout', details: 'Error: connect ETIMEDOUT 203.0.113.50:443\n    at TCPConnectWrap.afterConnect [as oncomplete]', tableName: 'weather', sourceName: 'Weather Data', occurredAt: '2025-06-21T10:15:00Z' },
  { id: '2', level: 'error', source: 'function', message: 'Function "emailWorker" execution timeout after 30s', details: 'TimeoutError: Function execution exceeded 30000ms limit', tableName: null, sourceName: 'emailWorker', occurredAt: '2025-06-21T09:45:00Z' },
  { id: '3', level: 'warning', source: 'scraper', message: 'Scraper "News Article Scraper" failed on page 4', details: 'Selector ".article-body" not found on https://news.example.com/page/4', tableName: 'articles', sourceName: 'News Article Scraper', occurredAt: '2025-06-21T06:03:00Z' },
  { id: '4', level: 'error', source: 'pipeline', message: 'RSS pipeline "Tech News" validation error: 2 rows failed', details: 'Row 5: missing required field "title"\nRow 12: invalid date format in "pubDate"', tableName: 'articles', sourceName: 'Tech News RSS', occurredAt: '2025-06-21T05:50:00Z' },
  { id: '5', level: 'warning', source: 'system', message: 'CPU usage exceeded 80% for 5 minutes', details: 'Average CPU: 83%, Peak: 92%\nActive processes: scraper (45%), api (30%), functions (8%)', tableName: null, sourceName: null, occurredAt: '2025-06-21T04:22:00Z' },
  { id: '6', level: 'info', source: 'system', message: 'Database backup completed successfully', details: 'Backup size: 2.1 GB\nDuration: 45s', tableName: null, sourceName: null, occurredAt: '2025-06-21T03:00:00Z' },
  { id: '7', level: 'error', source: 'api', message: 'Rate limit exceeded for API key "sb_old_"', details: '429 Too Many Requests\nRate: 150 req/min (limit: 100 req/min)', tableName: null, sourceName: 'Old Service Key', occurredAt: '2025-06-21T02:15:00Z' },
  { id: '8', level: 'warning', source: 'pipeline', message: 'Pipeline "Crypto WebSocket" reconnection attempt #3', details: 'WebSocket connection lost. Attempting reconnect...\nLast successful message: 30s ago', tableName: 'crypto_prices', sourceName: 'Crypto WebSocket', occurredAt: '2025-06-21T01:30:00Z' },
  { id: '9', level: 'info', source: 'system', message: 'New table "analytics" created by admin@selfbase.io', details: null, tableName: 'analytics', sourceName: null, occurredAt: '2025-06-21T00:45:00Z' },
  { id: '10', level: 'error', source: 'function', message: 'Function "dataTransform" failed: Invalid JSON input', details: 'SyntaxError: Unexpected token < in JSON at position 0\nInput: <html>Error page</html>', tableName: null, sourceName: 'dataTransform', occurredAt: '2025-06-20T23:00:00Z' },
  { id: '11', level: 'info', source: 'system', message: 'Heartbeat check passed — all services healthy', details: 'CPU: 23%, RAM: 56%, Disk: 42%, Active Conns: 24', tableName: null, sourceName: null, occurredAt: '2025-06-20T22:00:00Z' },
  { id: '12', level: 'warning', source: 'api', message: 'Slow query detected on table "orders" — 2100ms', details: 'SELECT * FROM orders WHERE status = \'pending\' ORDER BY created_at DESC\nNo index on (status, created_at)', tableName: 'orders', sourceName: null, occurredAt: '2025-06-20T21:30:00Z' },
]

const levelIcons = {
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
}

const levelColors = {
  error: 'text-red-500',
  warning: 'text-amber-500',
  info: 'text-blue-500',
}

const levelBadgeColors = {
  error: 'bg-red-500/10 text-red-600 border-red-200',
  warning: 'bg-amber-500/10 text-amber-600 border-amber-200',
  info: 'bg-blue-500/10 text-blue-600 border-blue-200',
}

export function LogsView() {
  const { toast } = useToast()
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [expandedLog, setExpandedLog] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => { setLogs(mockLogs); setLoading(false) }, 500)
    return () => clearTimeout(timer)
  }, [])

  const filteredLogs = logs.filter((log) => {
    const matchSearch = log.message.toLowerCase().includes(search.toLowerCase()) || (log.details ?? '').toLowerCase().includes(search.toLowerCase())
    const matchLevel = levelFilter === 'all' || log.level === levelFilter
    const matchSource = sourceFilter === 'all' || log.source === sourceFilter
    return matchSearch && matchLevel && matchSource
  })

  const errorCount = logs.filter((l) => l.level === 'error').length
  const warningCount = logs.filter((l) => l.level === 'warning').length
  const infoCount = logs.filter((l) => l.level === 'info').length

  const handleClear = () => {
    setLogs([])
    toast({ title: 'Logs cleared', variant: 'destructive' })
  }

  const handleRefresh = () => {
    setLogs(mockLogs)
    toast({ title: 'Logs refreshed' })
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <div className="grid gap-4 md:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>)}</div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Logs</h1>
          <p className="text-muted-foreground">Error logs, pipeline errors, and system events</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh}><RefreshCw className="h-3.5 w-3.5 mr-1" />Refresh</Button>
          <Button variant="outline" size="sm" onClick={() => toast({ title: 'Logs exported' })}><Download className="h-3.5 w-3.5 mr-1" />Export</Button>
          <Button variant="outline" size="sm" className="text-destructive" onClick={handleClear}><Trash2 className="h-3.5 w-3.5 mr-1" />Clear</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-red-200">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div><div className="text-sm text-muted-foreground">Errors</div><div className="text-2xl font-bold text-red-600">{errorCount}</div></div>
              <div className="rounded-md bg-red-500/10 p-2"><XCircle className="h-5 w-5 text-red-500" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-200">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div><div className="text-sm text-muted-foreground">Warnings</div><div className="text-2xl font-bold text-amber-600">{warningCount}</div></div>
              <div className="rounded-md bg-amber-500/10 p-2"><AlertTriangle className="h-5 w-5 text-amber-500" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-200">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div><div className="text-sm text-muted-foreground">Info</div><div className="text-2xl font-bold text-blue-600">{infoCount}</div></div>
              <div className="rounded-md bg-blue-500/10 p-2"><Info className="h-5 w-5 text-blue-500" /></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search logs..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="w-32"><SelectValue placeholder="Level" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="info">Info</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Source" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="system">System</SelectItem>
            <SelectItem value="pipeline">Pipeline</SelectItem>
            <SelectItem value="scraper">Scraper</SelectItem>
            <SelectItem value="function">Function</SelectItem>
            <SelectItem value="api">API</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="secondary">{filteredLogs.length} entries</Badge>
      </div>

      {/* Log Entries */}
      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {filteredLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <FileText className="h-10 w-10 mb-2 opacity-30" />
                <p className="text-sm">No logs found</p>
              </div>
            ) : (
              filteredLogs.map((log) => {
                const LevelIcon = levelIcons[log.level]
                const isExpanded = expandedLog === log.id
                return (
                  <div key={log.id} className="hover:bg-muted/30 transition-colors">
                    <div
                      className="flex items-start gap-3 p-4 cursor-pointer"
                      onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                    >
                      <LevelIcon className={`h-4 w-4 mt-0.5 shrink-0 ${levelColors[log.level]}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-medium">{log.message}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className={levelBadgeColors[log.level]}>{log.level}</Badge>
                          <Badge variant="outline" className="text-xs capitalize">{log.source}</Badge>
                          {log.tableName && <span className="font-mono">{log.tableName}</span>}
                          {log.sourceName && <span>· {log.sourceName}</span>}
                          <span>· {new Date(log.occurredAt).toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="shrink-0">
                        {log.details ? (
                          isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        ) : null}
                      </div>
                    </div>
                    {isExpanded && log.details && (
                      <div className="px-4 pb-4 pl-11">
                        <pre className="rounded-md bg-slate-950 text-emerald-400 p-3 text-xs font-mono whitespace-pre-wrap overflow-auto max-h-[200px]">
                          {log.details}
                        </pre>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
