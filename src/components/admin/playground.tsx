'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Terminal,
  Play,
  Copy,
  Plus,
  Trash2,
  Send,
  Clock,
  Search,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  RotateCcw,
  FileJson,
  ArrowDownToLine,
  Hash,
  Zap,
  Activity,
  Gauge,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { useToast } from '@/hooks/use-toast'

// =====================================================================
// TYPES
// =====================================================================

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

interface EndpointTemplate {
  id: string
  category: string
  method: HttpMethod
  path: string
  description: string
  defaultBody?: string
  defaultParams?: Array<{ key: string; value: string }>
  defaultHeaders?: Array<{ key: string; value: string }>
}

interface KeyValueRow {
  id: string
  key: string
  value: string
}

interface ResponseData {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  durationMs: number
  sizeBytes: number
  ok: boolean
}

interface HistoryEntry {
  status: number
  durationMs: number
  timestamp: number
  ok: boolean
}

// =====================================================================
// CONSTANTS
// =====================================================================

const methodColors: Record<HttpMethod, string> = {
  GET: 'bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:text-emerald-400 dark:border-emerald-900',
  POST: 'bg-blue-500/10 text-blue-700 border-blue-200 dark:text-blue-400 dark:border-blue-900',
  PUT: 'bg-amber-500/10 text-amber-700 border-amber-200 dark:text-amber-400 dark:border-amber-900',
  DELETE: 'bg-red-500/10 text-red-700 border-red-200 dark:text-red-400 dark:border-red-900',
  PATCH: 'bg-purple-500/10 text-purple-700 border-purple-200 dark:text-purple-400 dark:border-purple-900',
}

const methodSelectColors: Record<HttpMethod, string> = {
  GET: 'text-emerald-600 dark:text-emerald-400',
  POST: 'text-blue-600 dark:text-blue-400',
  PUT: 'text-amber-600 dark:text-amber-400',
  DELETE: 'text-red-600 dark:text-red-400',
  PATCH: 'text-purple-600 dark:text-purple-400',
}

const ENDPOINT_TEMPLATES: EndpointTemplate[] = [
  // Data API (REST SDK)
  {
    id: 'data-query-collection',
    category: 'Data API',
    method: 'GET',
    path: '/api/v1/data/{table}',
    description: 'Query rows from a collection (REST SDK)',
    defaultParams: [
      { key: 'limit', value: '50' },
      { key: 'offset', value: '0' },
    ],
  },
  {
    id: 'data-version-hash',
    category: 'Data API',
    method: 'GET',
    path: '/api/v1/version/{table}',
    description: 'Get the version hash for a collection',
  },
  {
    id: 'data-insert-row',
    category: 'Data API',
    method: 'POST',
    path: '/api/tables/{id}/rows',
    description: 'Insert a new row into a table',
    defaultBody: '{\n  "data": {\n    "name": "Example",\n    "value": 42\n  }\n}',
  },
  {
    id: 'data-update-row',
    category: 'Data API',
    method: 'PUT',
    path: '/api/tables/{id}/rows/{rowId}',
    description: 'Update an existing row by ID',
    defaultBody: '{\n  "data": {\n    "name": "Updated Example",\n    "value": 100\n  }\n}',
  },
  {
    id: 'data-delete-row',
    category: 'Data API',
    method: 'DELETE',
    path: '/api/tables/{id}/rows/{rowId}',
    description: 'Delete a row by ID',
  },
  // Tables
  {
    id: 'tables-list',
    category: 'Tables',
    method: 'GET',
    path: '/api/tables',
    description: 'List all tables in the workspace',
  },
  {
    id: 'tables-create',
    category: 'Tables',
    method: 'POST',
    path: '/api/tables',
    description: 'Create a new table with schema',
    defaultBody: '{\n  "name": "items",\n  "displayName": "Items",\n  "description": "Demo table",\n  "columns": [\n    { "name": "title", "type": "TEXT", "nullable": false },\n    { "name": "qty", "type": "INTEGER", "nullable": true }\n  ]\n}',
  },
  {
    id: 'tables-detail',
    category: 'Tables',
    method: 'GET',
    path: '/api/tables/{id}',
    description: 'Get detailed schema for a table',
  },
  {
    id: 'tables-delete',
    category: 'Tables',
    method: 'DELETE',
    path: '/api/tables/{id}',
    description: 'Delete a table by ID',
  },
  // Pipelines
  {
    id: 'pipelines-list',
    category: 'Pipelines',
    method: 'GET',
    path: '/api/pipelines',
    description: 'List all pipeline sources',
    defaultParams: [{ key: 'isActive', value: 'true' }],
  },
  {
    id: 'pipelines-preview',
    category: 'Pipelines',
    method: 'POST',
    path: '/api/pipelines/{id}/preview',
    description: 'Preview pipeline fetch + transformation',
  },
  {
    id: 'pipelines-run',
    category: 'Pipelines',
    method: 'POST',
    path: '/api/pipelines/{id}/run',
    description: 'Trigger a manual pipeline run',
  },
  // Auth
  {
    id: 'auth-users',
    category: 'Auth',
    method: 'GET',
    path: '/api/auth/users',
    description: 'List registered users',
  },
  {
    id: 'auth-create-key',
    category: 'Auth',
    method: 'POST',
    path: '/api/auth/api-keys',
    description: 'Create a new API key',
    defaultBody: '{\n  "name": "playground-key",\n  "scopes": ["read", "write"]\n}',
  },
  {
    id: 'auth-sessions',
    category: 'Auth',
    method: 'GET',
    path: '/api/auth/sessions',
    description: 'List active sessions',
  },
  // Monitoring
  {
    id: 'monitoring-load',
    category: 'Monitoring',
    method: 'GET',
    path: '/api/monitoring/load',
    description: 'Server load snapshot (CPU, RAM, jobs)',
  },
  {
    id: 'monitoring-uptime',
    category: 'Monitoring',
    method: 'GET',
    path: '/api/monitoring/uptime',
    description: 'Uptime statistics',
  },
  {
    id: 'monitoring-heartbeat',
    category: 'Monitoring',
    method: 'GET',
    path: '/api/monitoring/heartbeat',
    description: 'Recent heartbeats',
    defaultParams: [{ key: 'limit', value: '60' }],
  },
  {
    id: 'monitoring-alerts',
    category: 'Monitoring',
    method: 'GET',
    path: '/api/monitoring/alerts',
    description: 'List active alerts',
  },
  // AI
  {
    id: 'ai-chat',
    category: 'AI',
    method: 'POST',
    path: '/api/ai/chat',
    description: 'Send a chat completion request',
    defaultBody: '{\n  "messages": [\n    { "role": "user", "content": "Hello, what is SelfBase?" }\n  ],\n  "model": "default"\n}',
  },
  {
    id: 'ai-embed',
    category: 'AI',
    method: 'POST',
    path: '/api/ai/embed',
    description: 'Generate embeddings for input text',
    defaultBody: '{\n  "input": "SelfBase is a local-first BaaS"\n}',
  },
  {
    id: 'ai-search',
    category: 'AI',
    method: 'POST',
    path: '/api/ai/search',
    description: 'Semantic vector search',
    defaultBody: '{\n  "query": "backend as a service",\n  "topK": 5\n}',
  },
  // Functions
  {
    id: 'functions-list',
    category: 'Functions',
    method: 'GET',
    path: '/api/functions',
    description: 'List deployed functions',
  },
  {
    id: 'functions-run',
    category: 'Functions',
    method: 'POST',
    path: '/api/functions/{id}/run',
    description: 'Invoke a function with input',
    defaultBody: '{\n  "input": {\n    "key": "value"\n  }\n}',
  },
  // Storage
  {
    id: 'storage-list',
    category: 'Storage',
    method: 'GET',
    path: '/api/storage',
    description: 'List uploaded files',
  },
  {
    id: 'storage-upload-url',
    category: 'Storage',
    method: 'POST',
    path: '/api/storage/upload-url',
    description: 'Get a presigned upload URL',
    defaultBody: '{\n  "filename": "example.png",\n  "contentType": "image/png"\n}',
  },
  // Queue
  {
    id: 'queue-status',
    category: 'Queue',
    method: 'GET',
    path: '/api/queue',
    description: 'Deferred request queue status',
  },
  {
    id: 'queue-drain',
    category: 'Queue',
    method: 'POST',
    path: '/api/queue/drain',
    description: 'Drain the queue (process all pending)',
  },
]

const ALL_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

let _rowIdCounter = 0
function newRowId() {
  _rowIdCounter += 1
  return `row-${Date.now()}-${_rowIdCounter}`
}

function toKv(arr: Array<{ key: string; value: string }> | undefined): KeyValueRow[] {
  if (!arr || arr.length === 0) {
    return [{ id: newRowId(), key: '', value: '' }]
  }
  return arr.map((r) => ({ id: newRowId(), key: r.key, value: r.value }))
}

// =====================================================================
// SUB-COMPONENTS
// =====================================================================

function MethodBadge({ method, className }: { method: HttpMethod; className?: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-[10px] font-bold tracking-wide ${methodColors[method]} ${className ?? ''}`}
    >
      {method}
    </span>
  )
}

function StatusBadge({ status }: { status: number }) {
  const firstDigit = String(status).charAt(0)
  const colorMap: Record<string, string> = {
    '2': 'bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:text-emerald-400 dark:border-emerald-900',
    '3': 'bg-blue-500/10 text-blue-700 border-blue-200 dark:text-blue-400 dark:border-blue-900',
    '4': 'bg-amber-500/10 text-amber-700 border-amber-200 dark:text-amber-400 dark:border-amber-900',
    '5': 'bg-red-500/10 text-red-700 border-red-200 dark:text-red-400 dark:border-red-900',
  }
  const cls = colorMap[firstDigit] ?? 'bg-muted text-muted-foreground border-border'
  return (
    <span className={`inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-bold ${cls}`}>
      {status}
    </span>
  )
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

// =====================================================================
// KEY-VALUE EDITOR
// =====================================================================

interface KvEditorProps {
  rows: KeyValueRow[]
  onChange: (rows: KeyValueRow[]) => void
  keyPlaceholder?: string
  valuePlaceholder?: string
}

function KvEditor({ rows, onChange, keyPlaceholder = 'key', valuePlaceholder = 'value' }: KvEditorProps) {
  const updateRow = (id: string, field: 'key' | 'value', val: string) => {
    onChange(rows.map((r) => (r.id === id ? { ...r, [field]: val } : r)))
  }
  const removeRow = (id: string) => {
    onChange(rows.filter((r) => r.id !== id))
  }
  const addRow = () => {
    onChange([...rows, { id: newRowId(), key: '', value: '' }])
  }

  return (
    <div className="space-y-2">
      {rows.length === 0 && (
        <p className="text-xs text-muted-foreground italic py-2">No entries. Click &quot;Add row&quot; to add one.</p>
      )}
      {rows.map((row) => (
        <div key={row.id} className="flex items-center gap-2">
          <Input
            value={row.key}
            onChange={(e) => updateRow(row.id, 'key', e.target.value)}
            placeholder={keyPlaceholder}
            className="h-8 font-mono text-xs flex-1"
          />
          <span className="text-muted-foreground text-xs">:</span>
          <Input
            value={row.value}
            onChange={(e) => updateRow(row.id, 'value', e.target.value)}
            placeholder={valuePlaceholder}
            className="h-8 font-mono text-xs flex-1"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => removeRow(row.id)}
            aria-label="Remove row"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs gap-1"
        onClick={addRow}
      >
        <Plus className="h-3 w-3" />
        Add row
      </Button>
    </div>
  )
}

// =====================================================================
// MAIN COMPONENT
// =====================================================================

export function PlaygroundView() {
  const { toast } = useToast()

  const [selectedTemplate, setSelectedTemplate] = useState<EndpointTemplate | null>(null)
  const [method, setMethod] = useState<HttpMethod>('GET')
  const [url, setUrl] = useState('')
  const [params, setParams] = useState<KeyValueRow[]>(toKv([]))
  const [headers, setHeaders] = useState<KeyValueRow[]>(toKv([]))
  const [body, setBody] = useState('')
  const [activeTab, setActiveTab] = useState<'params' | 'headers' | 'body'>('params')
  const [response, setResponse] = useState<ResponseData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [headersOpen, setHeadersOpen] = useState(false)

  // Stats
  const successRate = useMemo(() => {
    if (history.length === 0) return 0
    const ok = history.filter((h) => h.ok).length
    return Math.round((ok / history.length) * 100)
  }, [history])
  const lastDuration = useMemo(() => {
    if (history.length === 0) return null
    return history[history.length - 1].durationMs
  }, [history])

  // Filtered templates
  const filteredTemplates = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return ENDPOINT_TEMPLATES
    return ENDPOINT_TEMPLATES.filter(
      (t) =>
        t.path.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.method.toLowerCase().includes(q),
    )
  }, [search])

  const groupedTemplates = useMemo(() => {
    const map = new Map<string, EndpointTemplate[]>()
    filteredTemplates.forEach((t) => {
      if (!map.has(t.category)) map.set(t.category, [])
      map.get(t.category)!.push(t)
    })
    return Array.from(map.entries())
  }, [filteredTemplates])

  // Load template into request builder
  const loadTemplate = useCallback((template: EndpointTemplate) => {
    setSelectedTemplate(template)
    setMethod(template.method)
    setUrl(template.path)
    setParams(toKv(template.defaultParams))
    setHeaders(toKv(template.defaultHeaders))
    setBody(template.defaultBody ?? '')
    setResponse(null)
    setError(null)
    if (template.method === 'GET' || template.method === 'DELETE') {
      setActiveTab('params')
    } else {
      setActiveTab('body')
    }
  }, [])

  // Send request
  const sendRequest = useCallback(async () => {
    if (!url) {
      toast({
        title: 'URL is required',
        description: 'Pick a template from the library or type a URL.',
        variant: 'destructive',
      })
      return
    }
    setLoading(true)
    setError(null)
    setResponse(null)
    const startTime = performance.now()
    try {
      // Build URL with params
      const urlObj = new URL(url, window.location.origin)
      params.forEach((p) => {
        if (p.key.trim()) {
          urlObj.searchParams.set(p.key, p.value)
        }
      })

      // Build headers
      const headerObj: Record<string, string> = {}
      headers.forEach((h) => {
        if (h.key.trim()) headerObj[h.key] = h.value
      })
      const hasBody = method === 'POST' || method === 'PUT' || method === 'PATCH'
      if (!headerObj['Content-Type'] && hasBody) {
        headerObj['Content-Type'] = 'application/json'
      }

      const res = await fetch(urlObj.toString(), {
        method,
        headers: headerObj,
        body: hasBody && body ? body : undefined,
      })

      const responseText = await res.text()
      const durationMs = Math.round(performance.now() - startTime)

      // Parse response headers
      const responseHeaders: Record<string, string> = {}
      res.headers.forEach((value, key) => {
        responseHeaders[key] = value
      })

      // Try to pretty-print JSON
      let responseBody = responseText
      try {
        const parsed = JSON.parse(responseText)
        responseBody = JSON.stringify(parsed, null, 2)
      } catch {
        // not JSON, keep raw text
      }

      const sizeBytes = new Blob([responseText]).size
      const newResponse: ResponseData = {
        status: res.status,
        statusText: res.statusText,
        headers: responseHeaders,
        body: responseBody,
        durationMs,
        sizeBytes,
        ok: res.ok,
      }
      setResponse(newResponse)
      setHistory((prev) => [...prev, {
        status: res.status,
        durationMs,
        timestamp: Date.now(),
        ok: res.ok,
      }].slice(-20))
      toast({
        title: res.ok ? 'Request completed' : 'Request returned non-OK',
        description: `${res.status} ${res.statusText} · ${formatDuration(durationMs)} · ${formatBytes(sizeBytes)}`,
        variant: res.ok ? 'default' : 'destructive',
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Request failed'
      setError(msg)
      setHistory((prev) => [...prev, {
        status: 0,
        durationMs: Math.round(performance.now() - startTime),
        timestamp: Date.now(),
        ok: false,
      }].slice(-20))
      toast({
        title: 'Request failed',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [url, params, headers, body, method, toast])

  // Copy as cURL
  const copyAsCurl = useCallback(() => {
    if (!url) {
      toast({ title: 'Nothing to copy', description: 'URL is empty.', variant: 'destructive' })
      return
    }
    let cmd = `curl -X ${method} '${url}'`
    headers.forEach((h) => {
      if (h.key.trim()) cmd += ` \\\n  -H '${h.key}: ${h.value}'`
    })
    const hasBody = method === 'POST' || method === 'PUT' || method === 'PATCH'
    if (hasBody && body.trim()) {
      cmd += ` \\\n  -d '${body.replace(/'/g, "'\\''")}'`
    }
    navigator.clipboard.writeText(cmd)
    toast({ title: 'Copied as cURL', description: 'Command copied to clipboard.' })
  }, [url, method, headers, body, toast])

  // Copy response body
  const copyResponse = useCallback(() => {
    if (!response) return
    navigator.clipboard.writeText(response.body)
    toast({ title: 'Response copied', description: 'Body copied to clipboard.' })
  }, [response, toast])

  // Reset state
  const reset = useCallback(() => {
    setSelectedTemplate(null)
    setMethod('GET')
    setUrl('')
    setParams(toKv([]))
    setHeaders(toKv([]))
    setBody('')
    setResponse(null)
    setError(null)
  }, [])

  // Keyboard shortcut: Ctrl/Cmd + Enter to send
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        if (!loading) sendRequest()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [sendRequest, loading])

  const hasBody = method === 'POST' || method === 'PUT' || method === 'PATCH'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-emerald-50 via-teal-50 to-background dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-background p-6">
        <div className="absolute inset-0 bg-animated-gradient opacity-30 pointer-events-none" style={{ background: 'linear-gradient(135deg, oklch(0.65 0.17 162 / 0.15), oklch(0.55 0.15 180 / 0.1))' }} />
        <div className="relative flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500 text-white shadow-sm">
                <Terminal className="h-5 w-5" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gradient-emerald">
                API Playground
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Test your SelfBase REST API endpoints interactively
            </p>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap gap-3">
            <div className="rounded-lg border border-border bg-background/70 backdrop-blur px-3 py-2 min-w-[120px]">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                <Hash className="h-3 w-3" />
                Endpoints
              </div>
              <div className="text-lg font-bold text-foreground">{ENDPOINT_TEMPLATES.length}</div>
            </div>
            <div className="rounded-lg border border-border bg-background/70 backdrop-blur px-3 py-2 min-w-[120px]">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                <Clock className="h-3 w-3" />
                Last Time
              </div>
              <div className="text-lg font-bold text-foreground">
                {lastDuration !== null ? formatDuration(lastDuration) : '—'}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-background/70 backdrop-blur px-3 py-2 min-w-[120px]">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                <Gauge className="h-3 w-3" />
                Success Rate
              </div>
              <div className="text-lg font-bold text-foreground">{successRate}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main layout: 2 columns on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        {/* Left: Endpoint Library */}
        <Card className="lg:col-span-1 flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileJson className="h-4 w-4 text-emerald-500" />
                  Endpoint Library
                </CardTitle>
                <CardDescription className="text-xs mt-1">
                  {filteredTemplates.length} of {ENDPOINT_TEMPLATES.length} endpoints
                </CardDescription>
              </div>
            </div>
            <div className="relative mt-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search endpoints..."
                className="h-8 pl-8 text-xs"
              />
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto max-h-[70vh] scrollbar-thin pr-2 -mr-2">
            <div className="space-y-5">
              {groupedTemplates.map(([category, endpoints], gIdx) => (
                <div key={category} className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <span>{category}</span>
                    <Badge variant="outline" className="text-[9px] h-4 px-1.5">{endpoints.length}</Badge>
                  </div>
                  <div className="space-y-1">
                    {endpoints.map((tpl, idx) => (
                      <motion.button
                        key={tpl.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: (gIdx * 0.02) + (idx * 0.015), duration: 0.2 }}
                        whileHover={{ x: 2 }}
                        onClick={() => loadTemplate(tpl)}
                        className={`w-full text-left rounded-md border px-2.5 py-2 transition-colors ${
                          selectedTemplate?.id === tpl.id
                            ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40'
                            : 'border-border bg-background hover:bg-accent/50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <MethodBadge method={tpl.method} />
                          <code className="text-[11px] font-mono text-foreground truncate flex-1">{tpl.path}</code>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1">{tpl.description}</p>
                      </motion.button>
                    ))}
                  </div>
                </div>
              ))}
              {filteredTemplates.length === 0 && (
                <div className="text-center py-10 text-muted-foreground">
                  <Search className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No endpoints match &quot;{search}&quot;</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Right: Request Builder + Response Viewer */}
        <div className="lg:col-span-2 space-y-4">
          {/* Request Builder */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Zap className="h-4 w-4 text-emerald-500" />
                    Request Builder
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    {selectedTemplate ? selectedTemplate.description : 'Pick an endpoint to start'}
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1 text-muted-foreground"
                  onClick={reset}
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* URL row */}
              <div className="flex flex-col sm:flex-row gap-2">
                <Select value={method} onValueChange={(v) => setMethod(v as HttpMethod)}>
                  <SelectTrigger className={`w-full sm:w-[120px] font-bold text-sm ${methodSelectColors[method]}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_METHODS.map((m) => (
                      <SelectItem key={m} value={m} className={`font-bold ${methodSelectColors[m]}`}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="/api/tables"
                  className="flex-1 font-mono text-xs h-9"
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1.5"
                    onClick={copyAsCurl}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">cURL</span>
                  </Button>
                  <Button
                    size="sm"
                    className="h-9 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={sendRequest}
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    Send
                    <kbd className="hidden sm:inline-flex h-4 items-center gap-0.5 rounded border border-emerald-700/50 bg-emerald-700/30 px-1 font-mono text-[10px] text-emerald-50">
                      ⌘↵
                    </kbd>
                  </Button>
                </div>
              </div>

              {/* Tabs */}
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
                <TabsList className="h-8">
                  <TabsTrigger value="params" className="text-xs gap-1.5">
                    <Hash className="h-3 w-3" />
                    Params
                    {params.filter((p) => p.key.trim()).length > 0 && (
                      <Badge variant="secondary" className="h-4 px-1 text-[9px]">{params.filter((p) => p.key.trim()).length}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="headers" className="text-xs gap-1.5">
                    <Activity className="h-3 w-3" />
                    Headers
                    {headers.filter((h) => h.key.trim()).length > 0 && (
                      <Badge variant="secondary" className="h-4 px-1 text-[9px]">{headers.filter((h) => h.key.trim()).length}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="body" className="text-xs gap-1.5" disabled={!hasBody}>
                    <FileJson className="h-3 w-3" />
                    Body
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="params" className="mt-3">
                  <KvEditor
                    rows={params}
                    onChange={setParams}
                    keyPlaceholder="param name"
                    valuePlaceholder="value"
                  />
                </TabsContent>

                <TabsContent value="headers" className="mt-3">
                  <KvEditor
                    rows={headers}
                    onChange={setHeaders}
                    keyPlaceholder="header name"
                    valuePlaceholder="value"
                  />
                </TabsContent>

                <TabsContent value="body" className="mt-3">
                  {hasBody ? (
                    <div className="space-y-2">
                      <Textarea
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        placeholder='{\n  "key": "value"\n}'
                        className="font-mono text-xs min-h-[180px] scrollbar-thin"
                      />
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-muted-foreground">
                          Content-Type: application/json (added automatically if missing)
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] gap-1"
                          onClick={() => {
                            try {
                              const parsed = JSON.parse(body)
                              setBody(JSON.stringify(parsed, null, 2))
                              toast({ title: 'JSON formatted' })
                            } catch {
                              toast({ title: 'Invalid JSON', variant: 'destructive' })
                            }
                          }}
                        >
                          <FileJson className="h-3 w-3" />
                          Format
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic py-4 text-center">
                      Body is only available for POST, PUT, and PATCH requests
                    </p>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Response Viewer */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="h-4 w-4 text-emerald-500" />
                    Response
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    {response ? 'API response' : loading ? 'Waiting for response...' : 'No request sent yet'}
                  </CardDescription>
                </div>
                {response && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={copyResponse}
                  >
                    <Copy className="h-3 w-3" />
                    Copy
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <AnimatePresence mode="wait">
                {/* Empty state */}
                {!loading && !response && !error && (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center py-16 text-center"
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 mb-3">
                      <Play className="h-6 w-6" />
                    </div>
                    <p className="text-sm font-medium text-foreground">Ready to send</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                      Select an endpoint from the library and click <span className="font-mono text-emerald-600">Send</span> to see the response here.
                    </p>
                  </motion.div>
                )}

                {/* Loading state */}
                {loading && (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-3"
                  >
                    <div className="flex items-center gap-3 py-2">
                      <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Sending {method} request...</p>
                        <p className="text-xs text-muted-foreground font-mono">{url}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="h-4 w-1/3 bg-accent rounded shimmer" />
                      <div className="h-32 w-full bg-accent rounded shimmer" />
                    </div>
                  </motion.div>
                )}

                {/* Error state */}
                {error && !loading && (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/10 text-red-600 dark:text-red-400 shrink-0">
                        <XCircle className="h-5 w-5" />
                      </div>
                      <div className="space-y-1 flex-1 min-w-0">
                        <p className="text-sm font-semibold text-red-700 dark:text-red-300">Request failed</p>
                        <p className="text-xs text-red-600 dark:text-red-400 font-mono break-all">{error}</p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Response state */}
                {response && !loading && !error && (
                  <motion.div
                    key="response"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className="space-y-3"
                  >
                    {/* Status row */}
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={response.status} />
                      <span className="text-xs text-muted-foreground">{response.statusText || '—'}</span>
                      <div className="flex items-center gap-1 ml-auto text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{formatDuration(response.durationMs)}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <ArrowDownToLine className="h-3 w-3" />
                        <span>{formatBytes(response.sizeBytes)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {response.ok ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" />
                            Success
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                            <AlertTriangle className="h-3 w-3" />
                            Non-2xx
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Response Headers (collapsible) */}
                    <Collapsible open={headersOpen} onOpenChange={setHeadersOpen}>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 w-full justify-between text-xs text-muted-foreground hover:text-foreground">
                          <span className="flex items-center gap-1.5">
                            {headersOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            Response Headers ({Object.keys(response.headers).length})
                          </span>
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-2 rounded-md border border-border bg-muted/30 p-3 max-h-48 overflow-y-auto scrollbar-thin">
                          <div className="space-y-1">
                            {Object.entries(response.headers).map(([k, v]) => (
                              <div key={k} className="flex items-baseline gap-2 text-xs">
                                <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400 shrink-0">{k}:</span>
                                <span className="font-mono text-muted-foreground break-all">{v}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>

                    {/* Response Body */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Response Body
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {response.body.length} chars
                        </span>
                      </div>
                      <pre className="rounded-md border border-border bg-muted/30 p-3 overflow-auto max-h-[400px] scrollbar-thin font-mono text-xs leading-relaxed text-foreground">
                        <code>{response.body || '(empty body)'}</code>
                      </pre>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>

          {/* History */}
          {history.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4 text-emerald-500" />
                  Recent Requests
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5">{history.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto scrollbar-thin">
                  {[...history].reverse().map((h, i) => (
                    <div
                      key={`${h.timestamp}-${i}`}
                      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-mono ${
                        h.status === 0
                          ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400'
                          : h.ok
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400'
                            : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-400'
                      }`}
                      title={new Date(h.timestamp).toLocaleString()}
                    >
                      {h.status === 0 ? (
                        <XCircle className="h-3 w-3" />
                      ) : h.ok ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <AlertTriangle className="h-3 w-3" />
                      )}
                      <span>{h.status === 0 ? 'ERR' : h.status}</span>
                      <span className="opacity-70">·</span>
                      <span>{formatDuration(h.durationMs)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
