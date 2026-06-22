'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  FileText,
  AlertTriangle,
  AlertCircle,
  Info,
  Search,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  XCircle,
  Download,
  Trash2,
  Code2,
  Globe,
  GitBranch,
  Server,
  Filter,
  Copy,
  Check,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { apiGet } from '@/lib/api-client'

interface SourceErrorItem {
  id: string
  sourceId: string | null
  tableId: string | null
  tableName: string | null
  errorType: string // fetch_error, validation_error, transform_error, network_error
  message: string
  rawPayload: string | null
  occurredAt: string
  source?: { id: string; name: string; sourceType: string; url: string } | null
  table?: { id: string; name: string } | null
}

interface SourceErrorsResponse {
  errors?: SourceErrorItem[]
  sourceSummary?: Array<{ sourceId: string; source: { name: string; sourceType: string } | null; errorCount: number }>
  pagination?: { page: number; limit: number; total: number }
}

interface FunctionErrorItem {
  id: string
  functionId: string
  functionName?: string
  status: string
  triggeredBy: string | null
  errorPayload: string | null
  durationMs: number | null
  startedAt: string
  completedAt: string | null
  input: string | null
}

interface FunctionErrorsResponse {
  errors?: FunctionErrorItem[]
  functionSummary?: Array<{ functionId: string; func: { name: string; triggerType: string } | null; errorCount: number }>
  pagination?: { page: number; limit: number; total: number }
}

const errorTypeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  fetch_error: AlertTriangle,
  validation_error: AlertCircle,
  transform_error: AlertCircle,
  network_error: XCircle,
  execution_error: XCircle,
  timeout: AlertTriangle,
}

const errorTypeColors: Record<string, string> = {
  fetch_error: 'text-amber-500',
  validation_error: 'text-amber-500',
  transform_error: 'text-amber-500',
  network_error: 'text-red-500',
  execution_error: 'text-red-500',
  timeout: 'text-amber-500',
}

const errorTypeBadgeColors: Record<string, string> = {
  fetch_error: 'bg-amber-500/10 text-amber-700 border-amber-200',
  validation_error: 'bg-amber-500/10 text-amber-700 border-amber-200',
  transform_error: 'bg-amber-500/10 text-amber-700 border-amber-200',
  network_error: 'bg-red-500/10 text-red-700 border-red-200',
  execution_error: 'bg-red-500/10 text-red-700 border-red-200',
  timeout: 'bg-amber-500/10 text-amber-700 border-amber-200',
}

const levelBadgeColors: Record<string, string> = {
  error: 'bg-red-500/10 text-red-600 border-red-200',
  warning: 'bg-amber-500/10 text-amber-600 border-amber-200',
  info: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  debug: 'bg-slate-500/10 text-slate-600 border-slate-200',
}

const levelDotColors: Record<string, string> = {
  error: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-emerald-500',
  debug: 'bg-slate-500',
}

const sourceIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  rest: GitBranch,
  rss: GitBranch,
  websocket: GitBranch,
  scraper: Globe,
  pipeline: GitBranch,
  function: Code2,
  system: Server,
}

function mapLevel(errorType: string): 'error' | 'warning' | 'info' {
  if (errorType === 'network_error' || errorType === 'execution_error') return 'error'
  if (errorType === 'fetch_error' || errorType === 'validation_error' || errorType === 'transform_error' || errorType === 'timeout')
    return 'warning'
  return 'info'
}

function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return
  const keys = Object.keys(rows[0])
  const csv = [
    keys.join(','),
    ...rows.map((r) =>
      keys
        .map((k) => {
          const v = r[k]
          if (v == null) return ''
          const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
          return `"${s.replace(/"/g, '""')}"`
        })
        .join(','),
    ),
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function LogsView() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [sourceErrors, setSourceErrors] = useState<SourceErrorItem[]>([])
  const [sourceErrorsDetailed, setSourceErrorsDetailed] = useState<SourceErrorItem[]>([])
  const [functionErrors, setFunctionErrors] = useState<FunctionErrorItem[]>([])
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [expandedLog, setExpandedLog] = useState<string | null>(null)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [se, sed, fe] = await Promise.all([
        apiGet<SourceErrorItem[]>('/api/logs?limit=100'),
        apiGet<SourceErrorsResponse>('/api/logs/source-errors?limit=100').catch(() => ({})),
        apiGet<FunctionErrorsResponse>('/api/logs/function-errors?limit=100').catch(() => ({})),
      ])
      setSourceErrors(Array.isArray(se) ? se : [])
      setSourceErrorsDetailed(Array.isArray(sed?.errors) ? sed.errors : [])
      setFunctionErrors(Array.isArray(fe?.errors) ? fe.errors : [])
    } catch (err) {
      toast({
        title: 'Failed to load logs',
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

  // Auto-refresh every 5 seconds
  useEffect(() => {
    if (autoRefresh) {
      autoRefreshRef.current = setInterval(() => {
        void loadAll()
      }, 5000)
    } else {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current)
        autoRefreshRef.current = null
      }
    }
    return () => {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current)
      }
    }
  }, [autoRefresh, loadAll])

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      // fallback - ignore
    }
  }

  const highlightSearch = (text: string, query: string) => {
    if (!query.trim()) return text
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    const parts = text.split(regex)
    if (parts.length <= 1) return text
    return parts.map((part, i) =>
      regex.test(part)
        ? `<mark class="bg-amber-200/80 text-amber-900 rounded px-0.5">${part}</mark>`
        : part
    ).join('')
  }

  const filteredLogs = sourceErrors.filter((log) => {
    const level = mapLevel(log.errorType)
    const matchSearch =
      log.message.toLowerCase().includes(search.toLowerCase()) ||
      (log.rawPayload ?? '').toLowerCase().includes(search.toLowerCase())
    const matchLevel = levelFilter === 'all' || level === levelFilter
    const matchSource = sourceFilter === 'all' || log.source?.sourceType === sourceFilter
    let matchDate = true
    if (dateFrom) matchDate = new Date(log.occurredAt) >= new Date(dateFrom)
    if (dateTo) matchDate = matchDate && new Date(log.occurredAt) <= new Date(dateTo)
    return matchSearch && matchLevel && matchSource && matchDate
  })

  const errorCount = sourceErrors.filter((l) => mapLevel(l.errorType) === 'error').length
  const warningCount = sourceErrors.filter((l) => mapLevel(l.errorType) === 'warning').length
  const infoCount = sourceErrors.filter((l) => mapLevel(l.errorType) === 'info').length

  const handleExport = () => {
    if (filteredLogs.length === 0) {
      toast({ title: 'No logs to export', variant: 'destructive' })
      return
    }
    downloadCsv(
      `selfbase-logs-${new Date().toISOString().slice(0, 10)}.csv`,
      filteredLogs.map((l) => ({
        id: l.id,
        level: mapLevel(l.errorType),
        errorType: l.errorType,
        source: l.source?.sourceType ?? '',
        sourceName: l.source?.name ?? '',
        table: l.tableName ?? l.table?.name ?? '',
        message: l.message,
        occurredAt: l.occurredAt,
      })),
    )
    toast({ title: 'Logs exported', description: `${filteredLogs.length} entries exported to CSV.` })
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    )
  }

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
            Logs
          </h1>
          <p className="text-muted-foreground">Error logs, pipeline errors, and system events</p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="flex items-center gap-2 bg-muted/50 rounded-md px-3 py-1.5">
            <Switch
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
              className="scale-75"
            />
            <span className="text-xs text-muted-foreground">Auto-refresh</span>
            {autoRefresh && (
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => void loadAll()}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-3.5 w-3.5 mr-1" /> Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive"
            onClick={() => setShowClearConfirm(true)}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-red-200">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Errors</div>
                <div className="text-2xl font-bold text-red-600">{errorCount}</div>
              </div>
              <div className="rounded-md bg-red-500/10 p-2">
                <XCircle className="h-5 w-5 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-200">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Warnings</div>
                <div className="text-2xl font-bold text-amber-600">{warningCount}</div>
              </div>
              <div className="rounded-md bg-amber-500/10 p-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-emerald-200">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Info</div>
                <div className="text-2xl font-bold text-emerald-600">{infoCount}</div>
              </div>
              <div className="rounded-md bg-emerald-500/10 p-2">
                <Info className="h-5 w-5 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" /> All Logs
          </TabsTrigger>
          <TabsTrigger value="source" className="gap-1.5">
            <GitBranch className="h-3.5 w-3.5" /> Source Errors
          </TabsTrigger>
          <TabsTrigger value="function" className="gap-1.5">
            <Code2 className="h-3.5 w-3.5" /> Function Errors
          </TabsTrigger>
        </TabsList>

        {/* All Logs Tab */}
        <TabsContent value="all" className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="system">System</SelectItem>
                <SelectItem value="pipeline">Pipeline</SelectItem>
                <SelectItem value="scraper">Scraper</SelectItem>
                <SelectItem value="function">Function</SelectItem>
                <SelectItem value="api">API</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-36"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-36"
            />
            <Badge variant="secondary">{filteredLogs.length} entries</Badge>
          </div>

          <Card>
            <CardContent className="p-0">
              {filteredLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <FileText className="h-12 w-12 mb-3 opacity-30" />
                  <p className="text-sm">No logs found</p>
                  <p className="text-xs mt-1">
                    {sourceErrors.length === 0
                      ? 'Logs will appear here when errors occur in your pipelines, scrapers, or functions.'
                      : 'Try adjusting your filters.'}
                  </p>
                </div>
              ) : (
                <div className="divide-y max-h-[700px] overflow-y-auto">
                  {filteredLogs.map((log) => {
                    const level = mapLevel(log.errorType)
                    const ErrorTypeIcon = errorTypeIcons[log.errorType] ?? AlertCircle
                    const isExpanded = expandedLog === log.id
                    const SourceIcon =
                      log.source?.sourceType ? sourceIcons[log.source.sourceType] ?? FileText : FileText
                    const highlightedMessage = search ? highlightSearch(log.message, search) : log.message
                    return (
                      <div key={log.id} className={`hover:bg-muted/30 transition-colors border-l-4 ${level === 'error' ? 'border-l-red-500' : level === 'warning' ? 'border-l-amber-500' : 'border-l-emerald-500'}`}>
                        <div
                          className="flex items-start gap-3 p-4 cursor-pointer"
                          onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                        >
                          <span className={`h-2.5 w-2.5 rounded-full mt-1.5 shrink-0 ${levelDotColors[level] ?? 'bg-slate-500'}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-sm font-medium" dangerouslySetInnerHTML={{ __html: highlightedMessage }} />
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                              <Badge variant="outline" className={levelBadgeColors[level] ?? ''}>
                                {level}
                              </Badge>
                              <Badge variant="outline" className={errorTypeBadgeColors[log.errorType] ?? ''}>
                                <ErrorTypeIcon className="h-2.5 w-2.5 mr-1" />
                                {log.errorType}
                              </Badge>
                              {log.source && (
                                <Badge variant="outline" className="text-xs gap-1">
                                  <SourceIcon className="h-2.5 w-2.5" />
                                  {log.source.sourceType}
                                </Badge>
                              )}
                              {log.source?.name && <span>· {log.source.name}</span>}
                              {(log.tableName || log.table?.name) && (
                                <span className="font-mono">· {log.tableName ?? log.table?.name}</span>
                              )}
                              <span>· {new Date(log.occurredAt).toLocaleString()}</span>
                            </div>
                          </div>
                          <div className="shrink-0">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="px-4 pb-4 pl-[52px] space-y-3">
                            <div className="grid gap-3 md:grid-cols-2 text-xs">
                              <div>
                                <div className="text-muted-foreground mb-1">Error Type</div>
                                <Badge variant="outline" className={errorTypeBadgeColors[log.errorType] ?? ''}>
                                  <ErrorTypeIcon className="h-2.5 w-2.5 mr-1" />
                                  {log.errorType}
                                </Badge>
                              </div>
                              <div>
                                <div className="text-muted-foreground mb-1">Level</div>
                                <Badge variant="outline" className={levelBadgeColors[level] ?? ''}>
                                  {level}
                                </Badge>
                              </div>
                              <div>
                                <div className="text-muted-foreground mb-1">Source</div>
                                <span>{log.source?.name ?? '—'}{log.source?.sourceType ? ` (${log.source.sourceType})` : ''}</span>
                              </div>
                              <div>
                                <div className="text-muted-foreground mb-1">Table</div>
                                <span className="font-mono">{log.tableName ?? log.table?.name ?? '—'}</span>
                              </div>
                              <div className="md:col-span-2">
                                <div className="text-muted-foreground mb-1">Timestamp (ISO)</div>
                                <span className="font-mono">{new Date(log.occurredAt).toISOString()}</span>
                              </div>
                            </div>
                            {log.message && (
                              <div>
                                <div className="text-muted-foreground mb-1 text-xs">Full Message</div>
                                <div className="rounded-md bg-muted/50 p-3 text-sm">{log.message}</div>
                              </div>
                            )}
                            {log.rawPayload && (
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-muted-foreground text-xs">Raw Payload</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-xs gap-1"
                                    onClick={() => void handleCopy(log.rawPayload ?? '', log.id)}
                                  >
                                    {copiedId === log.id ? (
                                      <><Check className="h-3 w-3" /> Copied</>
                                    ) : (
                                      <><Copy className="h-3 w-3" /> Copy</>
                                    )}
                                  </Button>
                                </div>
                                <pre className="rounded-md bg-slate-950 text-emerald-400 p-3 text-xs font-mono whitespace-pre-wrap overflow-auto max-h-[200px]">
                                  {log.rawPayload}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Source Errors Tab */}
        <TabsContent value="source" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pipeline & Scraper Source Errors</CardTitle>
              <CardDescription>
                Errors from data ingestion sources ({sourceErrorsDetailed.length} total)
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {sourceErrorsDetailed.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <GitBranch className="h-10 w-10 mb-2 opacity-30" />
                  <p className="text-sm">No source errors recorded</p>
                </div>
              ) : (
                <div className="divide-y max-h-[600px] overflow-y-auto">
                  {sourceErrorsDetailed.map((log) => {
                    const ErrorTypeIcon = errorTypeIcons[log.errorType] ?? AlertCircle
                    const level = mapLevel(log.errorType)
                    const SourceIcon = log.source?.sourceType ? sourceIcons[log.source.sourceType] ?? FileText : FileText
                    const isExpanded = expandedLog === log.id
                    const highlightedMessage = search ? highlightSearch(log.message, search) : log.message
                    return (
                      <div key={log.id} className={`hover:bg-muted/30 transition-colors border-l-4 ${level === 'error' ? 'border-l-red-500' : level === 'warning' ? 'border-l-amber-500' : 'border-l-emerald-500'}`}>
                        <div
                          className="flex items-start gap-3 p-4 cursor-pointer"
                          onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                        >
                          <span className={`h-2.5 w-2.5 rounded-full mt-1.5 shrink-0 ${levelDotColors[level] ?? 'bg-slate-500'}`} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium" dangerouslySetInnerHTML={{ __html: highlightedMessage }} />
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                              <Badge variant="outline" className={levelBadgeColors[level] ?? ''}>
                                {level}
                              </Badge>
                              <Badge variant="outline" className={errorTypeBadgeColors[log.errorType] ?? ''}>
                                {log.errorType}
                              </Badge>
                              {log.source && (
                                <Badge variant="outline" className="text-xs gap-1">
                                  <SourceIcon className="h-2.5 w-2.5" />
                                  {log.source.name}
                                </Badge>
                              )}
                              {log.table?.name && (
                                <span className="font-mono">→ {log.table.name}</span>
                              )}
                              <span>· {new Date(log.occurredAt).toLocaleString()}</span>
                            </div>
                          </div>
                          <div className="shrink-0">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="px-4 pb-4 pl-[52px] space-y-3">
                            <div className="grid gap-3 md:grid-cols-2 text-xs">
                              <div>
                                <div className="text-muted-foreground mb-1">Error Type</div>
                                <Badge variant="outline" className={errorTypeBadgeColors[log.errorType] ?? ''}>
                                  <ErrorTypeIcon className="h-2.5 w-2.5 mr-1" />
                                  {log.errorType}
                                </Badge>
                              </div>
                              <div>
                                <div className="text-muted-foreground mb-1">Level</div>
                                <Badge variant="outline" className={levelBadgeColors[level] ?? ''}>
                                  {level}
                                </Badge>
                              </div>
                              <div>
                                <div className="text-muted-foreground mb-1">Source</div>
                                <span>{log.source?.name ?? '—'}{log.source?.sourceType ? ` (${log.source.sourceType})` : ''}</span>
                              </div>
                              <div>
                                <div className="text-muted-foreground mb-1">Table</div>
                                <span className="font-mono">{log.table?.name ?? '—'}</span>
                              </div>
                              <div className="md:col-span-2">
                                <div className="text-muted-foreground mb-1">Timestamp (ISO)</div>
                                <span className="font-mono">{new Date(log.occurredAt).toISOString()}</span>
                              </div>
                            </div>
                            {log.message && (
                              <div>
                                <div className="text-muted-foreground mb-1 text-xs">Full Message</div>
                                <div className="rounded-md bg-muted/50 p-3 text-sm">{log.message}</div>
                              </div>
                            )}
                            {log.rawPayload && (
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-muted-foreground text-xs">Raw Payload</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-xs gap-1"
                                    onClick={() => void handleCopy(log.rawPayload ?? '', `src-${log.id}`)}
                                  >
                                    {copiedId === `src-${log.id}` ? (
                                      <><Check className="h-3 w-3" /> Copied</>
                                    ) : (
                                      <><Copy className="h-3 w-3" /> Copy</>
                                    )}
                                  </Button>
                                </div>
                                <pre className="rounded-md bg-slate-950 text-emerald-400 p-3 text-xs font-mono whitespace-pre-wrap overflow-auto max-h-[200px]">
                                  {log.rawPayload}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Function Errors Tab */}
        <TabsContent value="function" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Function Run Errors</CardTitle>
              <CardDescription>
                Failed and timed-out function executions ({functionErrors.length} total)
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {functionErrors.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Code2 className="h-10 w-10 mb-2 opacity-30" />
                  <p className="text-sm">No function errors recorded</p>
                </div>
              ) : (
                <div className="divide-y max-h-[600px] overflow-y-auto">
                  {functionErrors.map((err) => {
                    const isExpanded = expandedLog === err.id
                    const level = err.status === 'timeout' ? 'warning' : 'error'
                    return (
                      <div key={err.id} className={`hover:bg-muted/30 transition-colors border-l-4 ${err.status === 'timeout' ? 'border-l-amber-500' : 'border-l-red-500'}`}>
                        <div
                          className="flex items-start gap-3 p-4 cursor-pointer"
                          onClick={() => setExpandedLog(isExpanded ? null : err.id)}
                        >
                          <span className={`h-2.5 w-2.5 rounded-full mt-1.5 shrink-0 ${levelDotColors[level] ?? 'bg-red-500'}`} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium">
                              {err.functionName ?? 'Unknown function'} — {err.status}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                              <Badge variant="outline" className={levelBadgeColors[level] ?? ''}>
                                {level}
                              </Badge>
                              <Badge variant="outline" className="text-xs capitalize">
                                {err.status}
                              </Badge>
                              {err.triggeredBy && (
                                <Badge variant="outline" className="text-xs capitalize">
                                  via {err.triggeredBy}
                                </Badge>
                              )}
                              {err.durationMs != null && (
                                <span className="font-mono">· {err.durationMs}ms</span>
                              )}
                              <span>· {new Date(err.startedAt).toLocaleString()}</span>
                            </div>
                          </div>
                          <div className="shrink-0">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="px-4 pb-4 pl-[52px] space-y-3">
                            <div className="grid gap-3 md:grid-cols-2 text-xs">
                              <div>
                                <div className="text-muted-foreground mb-1">Function</div>
                                <span>{err.functionName ?? 'Unknown'}</span>
                              </div>
                              <div>
                                <div className="text-muted-foreground mb-1">Status</div>
                                <Badge variant="outline" className="text-xs capitalize">{err.status}</Badge>
                              </div>
                              <div>
                                <div className="text-muted-foreground mb-1">Triggered By</div>
                                <span>{err.triggeredBy ?? '—'}</span>
                              </div>
                              <div>
                                <div className="text-muted-foreground mb-1">Duration</div>
                                <span className="font-mono">{err.durationMs != null ? `${err.durationMs}ms` : '—'}</span>
                              </div>
                              <div className="md:col-span-2">
                                <div className="text-muted-foreground mb-1">Started At (ISO)</div>
                                <span className="font-mono">{new Date(err.startedAt).toISOString()}</span>
                              </div>
                              {err.completedAt && (
                                <div className="md:col-span-2">
                                  <div className="text-muted-foreground mb-1">Completed At (ISO)</div>
                                  <span className="font-mono">{new Date(err.completedAt).toISOString()}</span>
                                </div>
                              )}
                            </div>
                            {err.errorPayload && (
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-muted-foreground text-xs">Error Payload</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-xs gap-1"
                                    onClick={() => void handleCopy(err.errorPayload ?? '', `fn-${err.id}`)}
                                  >
                                    {copiedId === `fn-${err.id}` ? (
                                      <><Check className="h-3 w-3" /> Copied</>
                                    ) : (
                                      <><Copy className="h-3 w-3" /> Copy</>
                                    )}
                                  </Button>
                                </div>
                                <pre className="rounded-md bg-slate-950 text-red-400 p-3 text-xs font-mono whitespace-pre-wrap overflow-auto max-h-[200px]">
                                  {err.errorPayload}
                                </pre>
                              </div>
                            )}
                            {err.input && (
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-muted-foreground text-xs">Input</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-xs gap-1"
                                    onClick={() => void handleCopy(err.input ?? '', `fn-in-${err.id}`)}
                                  >
                                    {copiedId === `fn-in-${err.id}` ? (
                                      <><Check className="h-3 w-3" /> Copied</>
                                    ) : (
                                      <><Copy className="h-3 w-3" /> Copy</>
                                    )}
                                  </Button>
                                </div>
                                <pre className="rounded-md bg-slate-950 text-emerald-400 p-3 text-xs font-mono whitespace-pre-wrap overflow-auto max-h-[150px]">
                                  {err.input}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all logs?</AlertDialogTitle>
            <AlertDialogDescription>
              This will dismiss all currently loaded log entries from view. The underlying database
              records are not affected. Use this to clear your current view.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setSourceErrors([])
                setSourceErrorsDetailed([])
                setFunctionErrors([])
                setShowClearConfirm(false)
                toast({ title: 'Logs cleared', description: 'Log view has been cleared.' })
              }}
            >
              Clear Logs
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  )
}
