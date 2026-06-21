'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  GitBranch,
  Plus,
  Play,
  Pause,
  Pencil,
  RefreshCw,
  MoreHorizontal,
  Trash2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Globe,
  Rss,
  Radio,
  Code,
  ArrowRight,
  ExternalLink,
  Search,
  Eye,
  Activity,
  BarChart3,
  TrendingUp,
  Timer,
  Database,
  Copy,
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
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useToast } from '@/hooks/use-toast'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import { apiGet, apiPost, apiPut, parseJsonField } from '@/lib/api-client'

interface ColumnMapping {
  src: string
  target: string
  type?: string
  transform?: string
}

interface PipelineRunItem {
  id: string
  sourceId: string
  status: 'pending' | 'running' | 'success' | 'failed' | 'timeout'
  startedAt: string
  completedAt: string | null
  durationMs: number | null
  rowsFetched: number
  rowsWritten: number
  rowsFailed: number
  errorPayload?: string | null
  isManual: boolean
  source?: { id: string; name: string; sourceType: string; url: string }
}

interface PipelineSourceItem {
  id: string
  name: string
  description: string | null
  sourceType: 'rest' | 'rss' | 'websocket' | 'scraper'
  url: string
  method: string
  headers?: string | null
  isActive: boolean
  fetchInterval: number
  jsonPath?: string | null
  onConflict?: string
  preRunAction?: string
  primaryKeyCols?: string
  targetTableId?: string | null
  targetTableName?: string | null
  targetTable?: { name: string; displayName?: string | null } | null
  columnMappings: string
  lastRun?: PipelineRunItem | null
  pipelineRuns?: PipelineRunItem[]
  createdAt: string
}

interface PipelineRunsResponse {
  data?: PipelineRunItem[]
  meta?: { page: number; limit: number; total: number }
}

interface PreviewResult {
  success?: boolean
  url?: string
  method?: string
  statusCode?: number
  durationMs?: number
  totalRows?: number
  previewRows?: Array<Record<string, unknown>>
  columns?: Array<{ name: string; type: string }>
  error?: string
}

const sourceIcons = {
  rest: Code,
  rss: Rss,
  websocket: Radio,
  scraper: Globe,
}

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

const statusBadgeColors: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-700 border-amber-200',
  running: 'bg-blue-500/10 text-blue-700 border-blue-200',
  success: 'bg-emerald-500/10 text-emerald-700 border-emerald-200',
  failed: 'bg-red-500/10 text-red-700 border-red-200',
  timeout: 'bg-amber-500/10 text-amber-700 border-amber-200',
}

const sourceTypeBadge: Record<string, string> = {
  rest: 'bg-emerald-500/10 text-emerald-700 border-emerald-200',
  rss: 'bg-teal-500/10 text-teal-700 border-teal-200',
  websocket: 'bg-amber-500/10 text-amber-700 border-amber-200',
  scraper: 'bg-purple-500/10 text-purple-700 border-purple-200',
}

// Theme-aware status colors for chart cells (oklch works in both light & dark mode).
const STATUS_COLORS: Record<string, string> = {
  success: 'oklch(0.65 0.17 162)', // emerald
  failed: 'oklch(0.577 0.245 27.325)', // red
  running: 'oklch(0.6 0.118 184.704)', // teal/blue
  pending: 'oklch(0.769 0.188 70.08)', // amber
  timeout: 'oklch(0.7 0.19 50)', // orange
}

// Framer Motion variants for staggered analytics card entrance.
const analyticsContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.05 },
  },
}

const analyticsItemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' as const } },
}

export function PipelineView() {
  const { toast } = useToast()
  const [pipelines, setPipelines] = useState<PipelineSourceItem[]>([])
  const [allRuns, setAllRuns] = useState<PipelineRunItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [selectedPipeline, setSelectedPipeline] = useState<PipelineSourceItem | null>(null)
  const [previewTarget, setPreviewTarget] = useState<PipelineSourceItem | null>(null)
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [runningId, setRunningId] = useState<string | null>(null)

  // Create form
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newType, setNewType] = useState<'rest' | 'rss' | 'websocket' | 'scraper'>('rest')
  const [newUrl, setNewUrl] = useState('')
  const [newMethod, setNewMethod] = useState('GET')
  const [newHeaders, setNewHeaders] = useState('{}')
  const [newJsonPath, setNewJsonPath] = useState('')
  const [newInterval, setNewInterval] = useState('300')
  const [newOnConflict, setNewOnConflict] = useState('update')
  const [newTargetTableId, setNewTargetTableId] = useState('')
  const [newPreRunAction, setNewPreRunAction] = useState('none')
  const [newPrimaryKeyCols, setNewPrimaryKeyCols] = useState<string[]>([])
  const [newMappings, setNewMappings] = useState<ColumnMapping[]>([])
  // Edit dialog state (mirrors the create form)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editPipeline, setEditPipeline] = useState<PipelineSourceItem | null>(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editType, setEditType] = useState<'rest' | 'rss' | 'websocket' | 'scraper'>('rest')
  const [editUrl, setEditUrl] = useState('')
  const [editMethod, setEditMethod] = useState('GET')
  const [editHeaders, setEditHeaders] = useState('{}')
  const [editJsonPath, setEditJsonPath] = useState('')
  const [editInterval, setEditInterval] = useState('300')
  const [editOnConflict, setEditOnConflict] = useState('update')
  const [editTargetTableId, setEditTargetTableId] = useState('')
  const [editPreRunAction, setEditPreRunAction] = useState('none')
  const [editPrimaryKeyCols, setEditPrimaryKeyCols] = useState<string[]>([])
  const [editMappings, setEditMappings] = useState<ColumnMapping[]>([])
  const [tables, setTables] = useState<Array<{ id: string; name: string; displayName?: string | null; rowCount?: number; columns: Array<{ id: string; name: string; type: string }> }>>([])
  // Next-run countdown (seconds remaining until the next scheduled fetch).
  const [nextRunIn, setNextRunIn] = useState<number | null>(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [p, r, t] = await Promise.all([
        apiGet<PipelineSourceItem[]>('/api/pipelines'),
        apiGet<PipelineRunItem[] | PipelineRunsResponse>('/api/pipelines/runs?limit=100').catch(() => null),
        apiGet<Array<{ id: string; name: string; displayName?: string | null; columns: Array<{ id: string; name: string; type: string }> }>>('/api/tables').catch(() => []),
      ])
      if (Array.isArray(t)) setTables(t)
      const list = Array.isArray(p) ? p : []
      // Map targetTable.name -> targetTableName for convenience, normalize columnMappings
      const normalized = list.map((pl) => ({
        ...pl,
        targetTableName: pl.targetTableName ?? pl.targetTable?.name ?? null,
        lastRun: pl.pipelineRuns && pl.pipelineRuns.length > 0 ? pl.pipelineRuns[0] : null,
      }))
      setPipelines(normalized)
      // apiGet already unwraps `{ success, data }` envelopes, so the result is usually
      // the raw array. Handle both shapes defensively.
      const runs = Array.isArray(r) ? r : (r?.data ?? [])
      setAllRuns(Array.isArray(runs) ? runs : [])
    } catch (err) {
      toast({
        title: 'Failed to load pipelines',
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

  // Live countdown to the next scheduled run, based on the most recent run
  // for the currently selected pipeline. Updates every second.
  useEffect(() => {
    if (
      !selectedPipeline ||
      !selectedPipeline.isActive ||
      selectedPipeline.fetchInterval <= 0
    ) {
      setNextRunIn(null)
      return
    }
    const lastRun = allRuns.find((r) => r.sourceId === selectedPipeline.id)
    if (!lastRun) {
      setNextRunIn(null)
      return
    }
    const lastRunTime = new Date(lastRun.startedAt).getTime()
    const nextRunTime = lastRunTime + selectedPipeline.fetchInterval * 1000

    const updateCountdown = () => {
      const remaining = Math.max(0, Math.round((nextRunTime - Date.now()) / 1000))
      setNextRunIn(remaining)
    }
    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)
    return () => clearInterval(interval)
  }, [selectedPipeline, allRuns])

  const handleCreate = async () => {
    if (!newName.trim() || !newUrl.trim()) {
      toast({ title: 'Name and URL required', variant: 'destructive' })
      return
    }
    try {
      const payload: Record<string, unknown> = {
        name: newName.trim(),
        description: newDesc || null,
        sourceType: newType,
        url: newUrl.trim(),
        method: newMethod,
        headers: newHeaders || null,
        jsonPath: newJsonPath || null,
        fetchInterval: Number(newInterval) || 300,
        onConflict: newOnConflict,
        targetTableId: newTargetTableId && newTargetTableId !== '_none' ? newTargetTableId : null,
        preRunAction: newPreRunAction,
        primaryKeyCols: JSON.stringify(newPrimaryKeyCols),
        isActive: true,
        columnMappings: JSON.stringify(newMappings),
      }
      const created = await apiPost<PipelineSourceItem>('/api/pipelines', payload)
      setPipelines((prev) => [
        {
          ...created,
          targetTableName: created.targetTable?.name ?? null,
          lastRun: null,
        },
        ...prev,
      ])
      setShowCreateDialog(false)
      setNewName('')
      setNewDesc('')
      setNewUrl('')
      setNewMethod('GET')
      setNewHeaders('{}')
      setNewJsonPath('')
      setNewInterval('300')
      setNewOnConflict('update')
      setNewTargetTableId('')
      setNewPreRunAction('none')
      setNewPrimaryKeyCols([])
      setNewMappings([])
      toast({ title: 'Pipeline created', description: `"${created.name}" has been created.` })
    } catch (err) {
      toast({
        title: 'Failed to create pipeline',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  const handleToggleActive = async (pipeline: PipelineSourceItem) => {
    try {
      await apiPut(`/api/pipelines/${pipeline.id}`, { isActive: !pipeline.isActive })
      setPipelines((prev) =>
        prev.map((p) => (p.id === pipeline.id ? { ...p, isActive: !p.isActive } : p)),
      )
      toast({ title: `Pipeline ${pipeline.isActive ? 'paused' : 'activated'}` })
    } catch (err) {
      toast({
        title: 'Failed to update pipeline',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  const handleRunNow = async (pipeline: PipelineSourceItem) => {
    setRunningId(pipeline.id)
    try {
      const result = await apiPost<{ runId: string; status: string; rowsFetched?: number; rowsWritten?: number; error?: string }>(
        `/api/pipelines/${pipeline.id}/run`,
        {},
      )
      toast({
        title: result.status === 'success' ? 'Pipeline run completed' : 'Pipeline run finished',
        description:
          result.status === 'success'
            ? `Fetched ${result.rowsFetched ?? 0} rows, wrote ${result.rowsWritten ?? 0}.`
            : result.error ?? `Status: ${result.status}`,
        variant: result.status === 'success' ? 'default' : 'destructive',
      })
      await loadAll()
    } catch (err) {
      toast({
        title: 'Pipeline run failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setRunningId(null)
    }
  }

  const handlePreview = async (pipeline: PipelineSourceItem) => {
    setPreviewTarget(pipeline)
    setPreviewResult(null)
    setPreviewLoading(true)
    try {
      const result = await apiPost<PreviewResult>(`/api/pipelines/${pipeline.id}/preview`, {})
      setPreviewResult(result)
    } catch (err) {
      setPreviewResult({
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    } finally {
      setPreviewLoading(false)
    }
  }

  const openEditDialog = (pipeline: PipelineSourceItem) => {
    setEditPipeline(pipeline)
    setEditName(pipeline.name)
    setEditDesc(pipeline.description || '')
    setEditType(pipeline.sourceType)
    setEditUrl(pipeline.url)
    setEditMethod(pipeline.method || 'GET')
    setEditHeaders(pipeline.headers || '{}')
    setEditJsonPath(pipeline.jsonPath || '')
    setEditInterval(String(pipeline.fetchInterval || 300))
    setEditOnConflict(pipeline.onConflict || 'update')
    setEditTargetTableId(pipeline.targetTableId || '')
    setEditPreRunAction(pipeline.preRunAction || 'none')
    setEditPrimaryKeyCols(parseJsonField<string[]>(pipeline.primaryKeyCols, []))
    setEditMappings(parseJsonField<ColumnMapping[]>(pipeline.columnMappings, []))
    setShowEditDialog(true)
  }

  // Duplicate a pipeline's configuration into a new (inactive) pipeline.
  const handleDuplicate = async (pipeline: PipelineSourceItem) => {
    try {
      const mappings = parseJsonField<ColumnMapping[]>(pipeline.columnMappings, [])
      const pkCols = parseJsonField<string[]>(pipeline.primaryKeyCols, [])
      const payload = {
        name: `${pipeline.name} (copy)`,
        description: pipeline.description,
        sourceType: pipeline.sourceType,
        url: pipeline.url,
        method: pipeline.method || 'GET',
        headers: pipeline.headers || null,
        jsonPath: pipeline.jsonPath || null,
        fetchInterval: pipeline.fetchInterval,
        onConflict: pipeline.onConflict || 'update',
        preRunAction: pipeline.preRunAction || 'none',
        primaryKeyCols: JSON.stringify(pkCols),
        targetTableId: pipeline.targetTableId || null,
        columnMappings: JSON.stringify(mappings),
        isActive: false, // Duplicated pipelines start inactive
      }
      const created = await apiPost<PipelineSourceItem>('/api/pipelines', payload)
      const normalized: PipelineSourceItem = {
        ...created,
        targetTableName: created.targetTable?.name ?? null,
        lastRun: null,
      }
      setPipelines((prev) => [normalized, ...prev])
      toast({
        title: 'Pipeline duplicated',
        description: `"${created.name}" created (inactive). Activate it when ready.`,
      })
      // Navigate to the new pipeline
      setSelectedPipeline(normalized)
    } catch (err) {
      toast({
        title: 'Failed to duplicate pipeline',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  const handleSaveEdit = async () => {
    if (!editPipeline || !editName.trim() || !editUrl.trim()) {
      toast({ title: 'Name and URL required', variant: 'destructive' })
      return
    }
    try {
      const payload: Record<string, unknown> = {
        name: editName.trim(),
        description: editDesc || null,
        sourceType: editType,
        url: editUrl.trim(),
        method: editMethod,
        headers: editHeaders || null,
        jsonPath: editJsonPath || null,
        fetchInterval: Number(editInterval) || 300,
        onConflict: editOnConflict,
        preRunAction: editPreRunAction,
        primaryKeyCols: JSON.stringify(editPrimaryKeyCols),
        targetTableId: editTargetTableId && editTargetTableId !== '_none' ? editTargetTableId : null,
        columnMappings: JSON.stringify(editMappings),
      }
      const updated = await apiPut<PipelineSourceItem>(`/api/pipelines/${editPipeline.id}`, payload)
      // Update local state
      setPipelines((prev) =>
        prev.map((p) =>
          p.id === editPipeline.id
            ? { ...p, ...updated, targetTableName: updated.targetTable?.name ?? null }
            : p,
        ),
      )
      if (selectedPipeline?.id === editPipeline.id) {
        setSelectedPipeline({
          ...selectedPipeline,
          ...updated,
          targetTableName: updated.targetTable?.name ?? null,
        })
      }
      setShowEditDialog(false)
      toast({ title: 'Pipeline updated', description: `"${updated.name}" has been saved.` })
    } catch (err) {
      toast({
        title: 'Failed to update pipeline',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  const filteredPipelines = pipelines.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description ?? '').toLowerCase().includes(search.toLowerCase()) ||
      p.url.toLowerCase().includes(search.toLowerCase()),
  )

  // Build chart data from allRuns grouped by day
  const chartData = (() => {
    const map = new Map<string, { day: string; success: number; failed: number; rows: number }>()
    for (const r of allRuns) {
      const d = new Date(r.startedAt)
      const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const entry = map.get(key) ?? { day: key, success: 0, failed: 0, rows: 0 }
      if (r.status === 'success') entry.success += 1
      if (r.status === 'failed' || r.status === 'timeout') entry.failed += 1
      entry.rows += r.rowsWritten ?? 0
      map.set(key, entry)
    }
    return Array.from(map.values()).slice(-7)
  })()

  // ----- Pipeline Analytics (Task 12) -----
  // Most recent 20 runs, oldest first so the timeline reads left → right.
  const timelineData = allRuns
    .slice(0, 20)
    .reverse()
    .map((run) => {
      const d = new Date(run.startedAt)
      const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
      return {
        time,
        duration: run.durationMs ?? 0,
        status: run.status,
        rows: run.rowsWritten ?? 0,
        name: run.source?.name ?? 'Pipeline',
      }
    })

  // Status distribution for the donut chart.
  const statusCounts = allRuns.reduce((acc, run) => {
    acc[run.status] = (acc[run.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const pieData = Object.entries(statusCounts).map(([name, value]) => ({
    name,
    value,
    color: STATUS_COLORS[name] ?? STATUS_COLORS.pending,
  }))

  // Stat cards
  const totalRuns = allRuns.length
  const successCount = allRuns.filter((r) => r.status === 'success').length
  const successRate = totalRuns > 0 ? Math.round((successCount / totalRuns) * 100) : 0
  const completedRuns = allRuns.filter((r) => r.durationMs != null)
  const avgDuration =
    completedRuns.length > 0
      ? Math.round(completedRuns.reduce((s, r) => s + (r.durationMs ?? 0), 0) / completedRuns.length)
      : 0
  const totalRowsWritten = allRuns.reduce((s, r) => s + (r.rowsWritten ?? 0), 0)

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-32 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (selectedPipeline) {
    const SourceIcon = sourceIcons[selectedPipeline.sourceType]
    const lastRun = selectedPipeline.lastRun ?? selectedPipeline.pipelineRuns?.[0] ?? null
    const LastStatusIcon = lastRun ? statusIcons[lastRun.status] : Clock
    const mappings = parseJsonField<ColumnMapping[]>(selectedPipeline.columnMappings, [])
    const sourceRuns = allRuns.filter((r) => r.sourceId === selectedPipeline.id)

    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="space-y-6"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => setSelectedPipeline(null)}>
            <ArrowRight className="h-4 w-4 rotate-180" /> Back
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div className="rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 p-2 text-white">
            <SourceIcon className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{selectedPipeline.name}</h1>
          <Badge variant="outline" className={`capitalize ${sourceTypeBadge[selectedPipeline.sourceType]}`}>
            {selectedPipeline.sourceType}
          </Badge>
          <Badge variant={selectedPipeline.isActive ? 'default' : 'secondary'}>
            {selectedPipeline.isActive ? 'Active' : 'Paused'}
          </Badge>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={() => openEditDialog(selectedPipeline)}>
              <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleDuplicate(selectedPipeline)}
            >
              <Copy className="mr-1 h-3.5 w-3.5" /> Duplicate
            </Button>
            <Button variant="outline" size="sm" onClick={() => void handlePreview(selectedPipeline)}>
              <Eye className="mr-1 h-3.5 w-3.5" /> Preview
            </Button>
            <Button
              size="sm"
              onClick={() => void handleRunNow(selectedPipeline)}
              disabled={runningId === selectedPipeline.id}
            >
              <Play className="mr-1 h-3.5 w-3.5" />
              {runningId === selectedPipeline.id ? 'Running...' : 'Run Now'}
            </Button>
          </div>
        </div>

        {/* Config Summary */}
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-emerald-500/5 border border-emerald-200/50 dark:border-emerald-800/30">
          <div className="flex items-center gap-1.5 text-xs">
            <Database className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-muted-foreground">Target:</span>
            <span className="font-mono font-medium">{selectedPipeline.targetTableName ?? 'Not set'}</span>
          </div>
          <Separator orientation="vertical" className="h-4" />
          <div className="flex items-center gap-1.5 text-xs">
            <RefreshCw className="h-3.5 w-3.5 text-teal-600" />
            <span className="text-muted-foreground">Conflict:</span>
            <Badge variant="outline" className="text-[10px] capitalize py-0">{selectedPipeline.onConflict}</Badge>
          </div>
          {(() => {
            const pkCols = parseJsonField<string[]>(selectedPipeline.primaryKeyCols, [])
            return pkCols.length > 0 ? (
              <>
                <Separator orientation="vertical" className="h-4" />
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-muted-foreground">🔑 PK:</span>
                  <span className="font-mono">{pkCols.join(', ')}</span>
                </div>
              </>
            ) : null
          })()}
          {selectedPipeline.preRunAction && selectedPipeline.preRunAction !== 'none' && (
            <>
              <Separator orientation="vertical" className="h-4" />
              <div className="flex items-center gap-1.5 text-xs">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                <span className="text-muted-foreground">Pre-run:</span>
                <Badge variant="outline" className="text-[10px] capitalize py-0 text-amber-700 border-amber-300">
                  {selectedPipeline.preRunAction}
                </Badge>
              </div>
            </>
          )}
        </div>

        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Source Type</div>
              <div className="text-lg font-bold capitalize">{selectedPipeline.sourceType}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Fetch Interval</div>
              <div className="text-lg font-bold">
                {selectedPipeline.fetchInterval > 0 ? `${selectedPipeline.fetchInterval}s` : 'Real-time'}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Target Table</div>
              <div className="text-lg font-bold font-mono">{selectedPipeline.targetTableName ?? '—'}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Last Run</div>
              <div className="flex items-center gap-1">
                {lastRun && <LastStatusIcon className={`h-4 w-4 ${statusColors[lastRun.status]}`} />}
                <span className="text-lg font-bold capitalize">{lastRun?.status ?? 'Never'}</span>
              </div>
              {lastRun?.durationMs != null && (
                <p className="text-xs text-muted-foreground mt-0.5">{lastRun.durationMs}ms · {lastRun.rowsWritten ?? 0} rows written</p>
              )}
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden">
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Next Run</div>
              {nextRunIn !== null && nextRunIn > 0 ? (
                <>
                  <div className="text-lg font-bold font-mono text-emerald-600">
                    {Math.floor(nextRunIn / 60)}m {nextRunIn % 60}s
                  </div>
                  <div className="mt-1 h-1 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-1000"
                      style={{
                        width: `${Math.min(
                          100,
                          ((selectedPipeline.fetchInterval - nextRunIn) /
                            selectedPipeline.fetchInterval) *
                            100,
                        )}%`,
                      }}
                    />
                  </div>
                </>
              ) : (
                <div className="text-lg font-bold text-muted-foreground">
                  {selectedPipeline?.isActive ? 'Due now' : 'Paused'}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Source URL & Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
              Source URL &amp; Configuration
            </CardTitle>
            <CardDescription>Pipeline source endpoint and extraction settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* URL row */}
            <div className="flex items-center gap-2 p-2 rounded-md bg-muted/30">
              <Badge variant="outline" className="font-mono">{selectedPipeline.method}</Badge>
              <code className="text-sm font-mono break-all flex-1">{selectedPipeline.url}</code>
              <a
                href={selectedPipeline.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-emerald-600"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>

            {/* Config grid */}
            <div className="grid gap-3 md:grid-cols-2">
              {selectedPipeline.jsonPath && (
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">JSONPath</span>
                  <code className="text-sm font-mono block p-2 rounded bg-muted/30">{selectedPipeline.jsonPath}</code>
                </div>
              )}
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">On Conflict</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">{selectedPipeline.onConflict}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {selectedPipeline.onConflict === 'update' && '— Insert new, update existing by PK'}
                    {selectedPipeline.onConflict === 'insert' && '— Always insert (no dedup)'}
                    {selectedPipeline.onConflict === 'replace' && '— Overwrite row on PK match'}
                    {selectedPipeline.onConflict === 'skip' && '— Skip rows matching PK'}
                    {selectedPipeline.onConflict === 'truncate' && '— Clear table then insert'}
                  </span>
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Pre-Run Action</span>
                <Badge variant="outline" className="capitalize">{selectedPipeline.preRunAction || 'none'}</Badge>
              </div>
              {(() => {
                const pkCols = parseJsonField<string[]>(selectedPipeline.primaryKeyCols, [])
                return pkCols.length > 0 ? (
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">Primary Key Columns</span>
                    <div className="flex flex-wrap gap-1.5">
                      {pkCols.map((col) => (
                        <Badge key={col} variant="secondary" className="gap-1">
                          <span>🔑</span> {col}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null
              })()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Table Mapping &amp; Conflict Resolution</CardTitle>
            <CardDescription>How fetched data is written to the target table</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <div className="text-sm text-muted-foreground">Target Table</div>
                <div className="text-base font-bold font-mono">{selectedPipeline.targetTableName ?? 'Not configured'}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Pre-Run Action</div>
                <Badge variant="outline" className="capitalize">
                  {selectedPipeline.preRunAction || 'none'}
                </Badge>
              </div>
            </div>

            <Separator />

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <div className="text-sm text-muted-foreground">On Conflict</div>
                <Badge variant="outline" className="capitalize">
                  {selectedPipeline.onConflict || 'update'}
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedPipeline.onConflict === 'update' && 'Insert new rows, update existing rows matching primary key'}
                  {selectedPipeline.onConflict === 'insert' && 'Always insert new rows (no dedup)'}
                  {selectedPipeline.onConflict === 'replace' && 'Overwrite entire row when primary key matches'}
                  {selectedPipeline.onConflict === 'skip' && 'Skip rows where primary key already exists'}
                  {selectedPipeline.onConflict === 'truncate' && 'Clear table then insert all rows'}
                  {!selectedPipeline.onConflict && 'Insert new rows, update existing rows matching primary key'}
                </p>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Primary Key Columns</div>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {(() => {
                    const pkCols = parseJsonField<string[]>(selectedPipeline.primaryKeyCols, [])
                    return pkCols.length > 0
                      ? pkCols.map(col => (
                        <Badge key={col} variant="secondary" className="gap-1">
                          <span>🔑</span> {col}
                        </Badge>
                      ))
                      : <span className="text-xs text-muted-foreground">None — all rows inserted</span>
                  })()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Column Mappings</CardTitle>
            <CardDescription>Source-to-target field mappings</CardDescription>
          </CardHeader>
          <CardContent>
            {mappings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <GitBranch className="h-10 w-10 mb-2 opacity-40" />
                <p className="text-sm">No column mappings configured</p>
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
                  {mappings.map((m, i) => (
                    <TableRow key={i} className="hover:bg-muted/40">
                      <TableCell className="font-mono text-sm">{m.src}</TableCell>
                      <TableCell>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                      </TableCell>
                      <TableCell className="font-mono text-sm font-medium">{m.target}</TableCell>
                      <TableCell>
                        {m.type && (
                          <Badge variant="outline" className="font-mono text-xs">
                            {m.type}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{m.transform ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Run History</CardTitle>
            <CardDescription>Recent pipeline executions ({sourceRuns.length} total)</CardDescription>
          </CardHeader>
          <CardContent>
            {sourceRuns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Clock className="h-10 w-10 mb-2 opacity-40" />
                <p className="text-sm">No runs yet</p>
                <p className="text-xs mt-1">Click "Run Now" to trigger a pipeline execution.</p>
              </div>
            ) : (
              <div className="rounded-md border max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Fetched</TableHead>
                      <TableHead>Written</TableHead>
                      <TableHead>Failed</TableHead>
                      <TableHead>Trigger</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sourceRuns.slice(0, 30).map((run) => {
                      const RunIcon = statusIcons[run.status]
                      return (
                        <TableRow key={run.id} className="hover:bg-muted/40">
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <RunIcon className={`h-3.5 w-3.5 ${statusColors[run.status]}`} />
                              <span className={`text-sm capitalize font-medium ${statusColors[run.status]}`}>
                                {run.status}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(run.startedAt).toLocaleString()}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {run.durationMs ? `${run.durationMs}ms` : '—'}
                          </TableCell>
                          <TableCell>{run.rowsFetched.toLocaleString()}</TableCell>
                          <TableCell>{run.rowsWritten.toLocaleString()}</TableCell>
                          <TableCell className={run.rowsFailed > 0 ? 'text-red-600' : ''}>
                            {run.rowsFailed}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {run.isManual ? 'Manual' : 'Scheduled'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Preview Dialog */}
        <Dialog open={!!previewTarget} onOpenChange={(open) => !open && setPreviewTarget(null)}>
          <DialogContent className="max-w-5xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-emerald-600" />
                Preview: {previewTarget?.name}
              </DialogTitle>
              <DialogDescription>
                Dry-run fetch — no rows are written to the database.
              </DialogDescription>
            </DialogHeader>
            {previewLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : previewResult ? (
              <div className="space-y-4">
                {previewResult.error ? (
                  <div className="rounded-md bg-red-500/10 border border-red-200 p-3 text-sm text-red-700">
                    {previewResult.error}
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-3 text-xs">
                      <Badge variant="outline">Status: {previewResult.statusCode ?? '—'}</Badge>
                      <Badge variant="outline">Duration: {previewResult.durationMs ?? 0}ms</Badge>
                      <Badge variant="outline">Total rows: {previewResult.totalRows ?? 0}</Badge>
                      <Badge variant="outline">Preview rows: {previewResult.previewRows?.length ?? 0}</Badge>
                    </div>
                    <div className="rounded-md border max-h-[50vh] overflow-auto">
                      <Table>
                        <TableHeader className="sticky top-0 bg-background">
                          <TableRow>
                            {(previewResult.columns ?? []).map((c) => (
                              <TableHead key={c.name} className="font-mono text-xs">
                                {c.name}
                                <span className="text-muted-foreground ml-1">({c.type})</span>
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(previewResult.previewRows ?? []).length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={(previewResult.columns ?? []).length || 1}
                                className="text-center text-muted-foreground py-8"
                              >
                                No rows returned
                              </TableCell>
                            </TableRow>
                          ) : (
                            (previewResult.previewRows ?? []).map((row, i) => (
                              <TableRow key={i}>
                                {(previewResult.columns ?? []).map((c) => (
                                  <TableCell key={c.name} className="font-mono text-xs">
                                    {row[c.name] !== undefined && row[c.name] !== null
                                      ? String(row[c.name]).slice(0, 80)
                                      : '—'}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </motion.div>
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
            Pipeline Studio
          </h1>
          <p className="text-muted-foreground">Configure and manage data source ingestion</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-1 h-4 w-4" /> New Pipeline
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Pipeline Source</DialogTitle>
              <DialogDescription>Configure a new data ingestion pipeline</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2 max-h-[65vh] overflow-y-auto">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="My Pipeline" />
                </div>
                <div className="space-y-2">
                  <Label>Source Type</Label>
                  <Select value={newType} onValueChange={(v) => setNewType(v as typeof newType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rest">REST API</SelectItem>
                      <SelectItem value="rss">RSS Feed</SelectItem>
                      <SelectItem value="websocket">WebSocket</SelectItem>
                      <SelectItem value="scraper">Web Scraper</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Brief description" />
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-2 md:col-span-2">
                  <Label>URL</Label>
                  <Input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://api.example.com/data" />
                </div>
                <div className="space-y-2">
                  <Label>Method</Label>
                  <Select value={newMethod} onValueChange={setNewMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GET">GET</SelectItem>
                      <SelectItem value="POST">POST</SelectItem>
                      <SelectItem value="PUT">PUT</SelectItem>
                      <SelectItem value="DELETE">DELETE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>JSONPath (optional)</Label>
                  <Input value={newJsonPath} onChange={(e) => setNewJsonPath(e.target.value)} placeholder="data.items" />
                </div>
                <div className="space-y-2">
                  <Label>Fetch Interval (sec)</Label>
                  <Input type="number" value={newInterval} onChange={(e) => setNewInterval(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Target Table</Label>
                <Select value={newTargetTableId} onValueChange={(v) => {
                  setNewTargetTableId(v)
                  setNewPrimaryKeyCols([])
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select target table..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">None (preview only)</SelectItem>
                    {tables.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        <span className="font-medium">{t.displayName || t.name}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({(t.rowCount ?? 0).toLocaleString()} rows · {t.columns?.length || 0} cols)
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Fetched data will be written to this table. Leave empty for preview-only mode.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Pre-Run Action</Label>
                <Select value={newPreRunAction} onValueChange={setNewPreRunAction}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None — Keep existing data</SelectItem>
                    <SelectItem value="truncate">Truncate — Delete all rows before insert</SelectItem>
                    <SelectItem value="archive">Archive — Archive old data before insert</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  What to do with existing table data before writing new rows.
                </p>
              </div>
              <div className="space-y-2">
                <Label>On Conflict (Duplicate Rows)</Label>
                <Select value={newOnConflict} onValueChange={setNewOnConflict}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="update">Upsert — Insert new, update existing</SelectItem>
                    <SelectItem value="insert">Insert Only — Always insert new rows</SelectItem>
                    <SelectItem value="replace">Replace — Overwrite entire row</SelectItem>
                    <SelectItem value="skip">Skip — Skip rows that already exist</SelectItem>
                    <SelectItem value="truncate">Truncate — Clear table then insert all</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  How to handle rows where the primary key matches an existing row.
                </p>
              </div>
              {newTargetTableId && newTargetTableId !== '_none' && (newOnConflict === 'update' || newOnConflict === 'replace' || newOnConflict === 'skip') && (
                <div className="space-y-2">
                  <Label>Primary Key Columns</Label>
                  <p className="text-xs text-muted-foreground">
                    Select which columns uniquely identify a row. Used for upsert, replace, and skip logic.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(() => {
                      const selectedTable = tables.find(t => t.id === newTargetTableId)
                      const availableCols = selectedTable?.columns || []
                      const mappingTargets = newMappings.map(m => m.target).filter(Boolean)
                      const allCols = [...new Set([...availableCols.map(c => c.name), ...mappingTargets])]
                      return allCols.map(colName => (
                        <Badge
                          key={colName}
                          variant={newPrimaryKeyCols.includes(colName) ? 'default' : 'outline'}
                          className="cursor-pointer select-none"
                          onClick={() => {
                            setNewPrimaryKeyCols(prev =>
                              prev.includes(colName)
                                ? prev.filter(c => c !== colName)
                                : [...prev, colName]
                            )
                          }}
                        >
                          {newPrimaryKeyCols.includes(colName) && <span className="mr-1">🔑</span>}
                          {colName}
                        </Badge>
                      ))
                    })()}
                  </div>
                  {newPrimaryKeyCols.length === 0 && (
                    <p className="text-xs text-amber-600 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      No primary key selected — all rows will be inserted (no upsert/skip).
                    </p>
                  )}
                </div>
              )}
              <div className="space-y-2">
                <Label>Headers (JSON)</Label>
                <Textarea
                  value={newHeaders}
                  onChange={(e) => setNewHeaders(e.target.value)}
                  className="font-mono text-xs"
                  rows={3}
                  placeholder='{"Authorization": "Bearer ..."}'
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Column Mappings</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setNewMappings((prev) => [
                        ...prev,
                        { src: '', target: '', type: 'TEXT' },
                      ])
                    }
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" /> Add Mapping
                  </Button>
                </div>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Source</TableHead>
                        <TableHead>Target</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="w-8" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {newMappings.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground text-xs py-4">
                            No mappings — source rows will be written as-is.
                          </TableCell>
                        </TableRow>
                      ) : (
                        newMappings.map((m, i) => (
                          <TableRow key={i}>
                            <TableCell>
                              <Input
                                value={m.src}
                                onChange={(e) => {
                                  const v = e.target.value
                                  setNewMappings((prev) =>
                                    prev.map((x, idx) => (idx === i ? { ...x, src: v } : x)),
                                  )
                                }}
                                className="h-8 font-mono text-xs"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={m.target}
                                onChange={(e) => {
                                  const v = e.target.value
                                  setNewMappings((prev) =>
                                    prev.map((x, idx) => (idx === i ? { ...x, target: v } : x)),
                                  )
                                }}
                                className="h-8 font-mono text-xs"
                              />
                            </TableCell>
                            <TableCell>
                              <Select
                                value={m.type ?? 'TEXT'}
                                onValueChange={(v) =>
                                  setNewMappings((prev) =>
                                    prev.map((x, idx) => (idx === i ? { ...x, type: v } : x)),
                                  )
                                }
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {['TEXT', 'INTEGER', 'DECIMAL', 'BOOLEAN', 'TIMESTAMP', 'JSON'].map((t) => (
                                    <SelectItem key={t} value={t}>
                                      {t}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive"
                                onClick={() =>
                                  setNewMappings((prev) => prev.filter((_, idx) => idx !== i))
                                }
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate}>Create Pipeline</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Pipeline Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Pipeline Source</DialogTitle>
              <DialogDescription>Modify pipeline configuration</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2 max-h-[65vh] overflow-y-auto scrollbar-thin">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="My Pipeline" />
                </div>
                <div className="space-y-2">
                  <Label>Source Type</Label>
                  <Select value={editType} onValueChange={(v) => setEditType(v as typeof editType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rest">REST API</SelectItem>
                      <SelectItem value="rss">RSS Feed</SelectItem>
                      <SelectItem value="websocket">WebSocket</SelectItem>
                      <SelectItem value="scraper">Web Scraper</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Brief description" />
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-2 md:col-span-2">
                  <Label>URL</Label>
                  <Input value={editUrl} onChange={(e) => setEditUrl(e.target.value)} placeholder="https://api.example.com/data" />
                </div>
                <div className="space-y-2">
                  <Label>Method</Label>
                  <Select value={editMethod} onValueChange={setEditMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GET">GET</SelectItem>
                      <SelectItem value="POST">POST</SelectItem>
                      <SelectItem value="PUT">PUT</SelectItem>
                      <SelectItem value="DELETE">DELETE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>JSONPath (optional)</Label>
                  <Input value={editJsonPath} onChange={(e) => setEditJsonPath(e.target.value)} placeholder="data.items" />
                </div>
                <div className="space-y-2">
                  <Label>Fetch Interval (sec)</Label>
                  <Input type="number" value={editInterval} onChange={(e) => setEditInterval(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Target Table</Label>
                <Select value={editTargetTableId || '_none'} onValueChange={(v) => {
                  setEditTargetTableId(v)
                  setEditPrimaryKeyCols([])
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select target table..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">None (preview only)</SelectItem>
                    {tables.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        <span className="font-medium">{t.displayName || t.name}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({(t.rowCount ?? 0).toLocaleString()} rows · {t.columns?.length || 0} cols)
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Fetched data will be written to this table. Leave empty for preview-only mode.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Pre-Run Action</Label>
                <Select value={editPreRunAction} onValueChange={setEditPreRunAction}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None — Keep existing data</SelectItem>
                    <SelectItem value="truncate">Truncate — Delete all rows before insert</SelectItem>
                    <SelectItem value="archive">Archive — Archive old data before insert</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  What to do with existing table data before writing new rows.
                </p>
              </div>
              <div className="space-y-2">
                <Label>On Conflict (Duplicate Rows)</Label>
                <Select value={editOnConflict} onValueChange={setEditOnConflict}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="update">Upsert — Insert new, update existing</SelectItem>
                    <SelectItem value="insert">Insert Only — Always insert new rows</SelectItem>
                    <SelectItem value="replace">Replace — Overwrite entire row</SelectItem>
                    <SelectItem value="skip">Skip — Skip rows that already exist</SelectItem>
                    <SelectItem value="truncate">Truncate — Clear table then insert all</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  How to handle rows where the primary key matches an existing row.
                </p>
              </div>
              {editTargetTableId && editTargetTableId !== '_none' && (editOnConflict === 'update' || editOnConflict === 'replace' || editOnConflict === 'skip') && (
                <div className="space-y-2">
                  <Label>Primary Key Columns</Label>
                  <p className="text-xs text-muted-foreground">
                    Select which columns uniquely identify a row. Used for upsert, replace, and skip logic.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(() => {
                      const selectedTable = tables.find((t) => t.id === editTargetTableId)
                      const availableCols = selectedTable?.columns || []
                      const mappingTargets = editMappings.map((m) => m.target).filter(Boolean)
                      const allCols = [...new Set([...availableCols.map((c) => c.name), ...mappingTargets])]
                      return allCols.map((colName) => (
                        <Badge
                          key={colName}
                          variant={editPrimaryKeyCols.includes(colName) ? 'default' : 'outline'}
                          className="cursor-pointer select-none"
                          onClick={() => {
                            setEditPrimaryKeyCols((prev) =>
                              prev.includes(colName)
                                ? prev.filter((c) => c !== colName)
                                : [...prev, colName],
                            )
                          }}
                        >
                          {editPrimaryKeyCols.includes(colName) && <span className="mr-1">🔑</span>}
                          {colName}
                        </Badge>
                      ))
                    })()}
                  </div>
                  {editPrimaryKeyCols.length === 0 && (
                    <p className="text-xs text-amber-600 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      No primary key selected — all rows will be inserted (no upsert/skip).
                    </p>
                  )}
                </div>
              )}
              <div className="space-y-2">
                <Label>Headers (JSON)</Label>
                <Textarea
                  value={editHeaders}
                  onChange={(e) => setEditHeaders(e.target.value)}
                  className="font-mono text-xs"
                  rows={3}
                  placeholder='{"Authorization": "Bearer ..."}'
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Column Mappings</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setEditMappings((prev) => [
                        ...prev,
                        { src: '', target: '', type: 'TEXT' },
                      ])
                    }
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" /> Add Mapping
                  </Button>
                </div>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Source</TableHead>
                        <TableHead>Target</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="w-8" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {editMappings.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground text-xs py-4">
                            No mappings — source rows will be written as-is.
                          </TableCell>
                        </TableRow>
                      ) : (
                        editMappings.map((m, i) => (
                          <TableRow key={i}>
                            <TableCell>
                              <Input
                                value={m.src}
                                onChange={(e) => {
                                  const v = e.target.value
                                  setEditMappings((prev) =>
                                    prev.map((x, idx) => (idx === i ? { ...x, src: v } : x)),
                                  )
                                }}
                                className="h-8 font-mono text-xs"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={m.target}
                                onChange={(e) => {
                                  const v = e.target.value
                                  setEditMappings((prev) =>
                                    prev.map((x, idx) => (idx === i ? { ...x, target: v } : x)),
                                  )
                                }}
                                className="h-8 font-mono text-xs"
                              />
                            </TableCell>
                            <TableCell>
                              <Select
                                value={m.type ?? 'TEXT'}
                                onValueChange={(v) =>
                                  setEditMappings((prev) =>
                                    prev.map((x, idx) => (idx === i ? { ...x, type: v } : x)),
                                  )
                                }
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {['TEXT', 'INTEGER', 'DECIMAL', 'BOOLEAN', 'TIMESTAMP', 'JSON'].map((t) => (
                                    <SelectItem key={t} value={t}>
                                      {t}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive"
                                onClick={() =>
                                  setEditMappings((prev) => prev.filter((_, idx) => idx !== i))
                                }
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Total Pipelines</div>
            <div className="text-2xl font-bold">{pipelines.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Active</div>
            <div className="text-2xl font-bold text-emerald-600">
              {pipelines.filter((p) => p.isActive).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Failed (recent)</div>
            <div className="text-2xl font-bold text-red-600">
              {allRuns.filter((r) => r.status === 'failed').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Total Rows Written</div>
            <div className="text-2xl font-bold">
              {allRuns.reduce((s, r) => s + (r.rowsWritten ?? 0), 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pipeline Runs & Rows Written</CardTitle>
            <CardDescription>Rows written per day across all pipelines</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <RTooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="rows" fill="#10b981" radius={[4, 4, 0, 0]} name="Rows Written" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search pipelines..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadAll()}>
          <RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {filteredPipelines.length === 0 ? (
          <Card className="md:col-span-2">
            <CardContent className="py-16 flex flex-col items-center justify-center text-muted-foreground">
              <GitBranch className="h-14 w-14 mb-3 opacity-30" />
              <p className="text-base font-medium">No pipelines yet</p>
              <p className="text-sm mt-1">Create a pipeline source to start ingesting data.</p>
              <Button className="mt-4" onClick={() => setShowCreateDialog(true)}>
                <Plus className="mr-1 h-4 w-4" /> New Pipeline
              </Button>
            </CardContent>
          </Card>
        ) : (
          filteredPipelines.map((pipeline) => {
            const SourceIcon = sourceIcons[pipeline.sourceType]
            const lastRun = pipeline.lastRun ?? pipeline.pipelineRuns?.[0] ?? null
            const StatusIcon = lastRun ? statusIcons[lastRun.status] : Clock
            return (
              <Card
                key={pipeline.id}
                className="cursor-pointer hover:shadow-md hover:border-emerald-200 transition-all"
                onClick={() => setSelectedPipeline(pipeline)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="rounded-md bg-gradient-to-br from-emerald-500/10 to-teal-500/10 p-1.5">
                        <SourceIcon className="h-4 w-4 text-emerald-600" />
                      </div>
                      <CardTitle className="text-base">{pipeline.name}</CardTitle>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            void handleRunNow(pipeline)
                          }}
                        >
                          <Play className="mr-2 h-3.5 w-3.5" /> Run Now
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            void handlePreview(pipeline)
                          }}
                        >
                          <Eye className="mr-2 h-3.5 w-3.5" /> Preview
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            void handleToggleActive(pipeline)
                          }}
                        >
                          {pipeline.isActive ? (
                            <>
                              <Pause className="mr-2 h-3.5 w-3.5" /> Pause
                            </>
                          ) : (
                            <>
                              <Play className="mr-2 h-3.5 w-3.5" /> Activate
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={(e) => e.stopPropagation()}>
                          <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <CardDescription className="line-clamp-1">{pipeline.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`capitalize ${sourceTypeBadge[pipeline.sourceType]}`}>
                        {pipeline.sourceType}
                      </Badge>
                      {pipeline.isActive ? (
                        <Badge className="bg-emerald-500/10 text-emerald-600 border-0">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Paused</Badge>
                      )}
                      {pipeline.isActive && pipeline.fetchInterval > 0 && pipeline.lastRun &&
                        (() => {
                          const lastRunTime = new Date(pipeline.lastRun.startedAt).getTime()
                          const nextRunTime = lastRunTime + pipeline.fetchInterval * 1000
                          const isOverdue = Date.now() > nextRunTime
                          return (
                            isOverdue && (
                              <Badge
                                variant="outline"
                                className="text-[10px] text-amber-700 border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800"
                              >
                                Overdue
                              </Badge>
                            )
                          )
                        })()}
                    </div>
                    {lastRun && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1">
                            <StatusIcon className={`h-3.5 w-3.5 ${statusColors[lastRun.status]}`} />
                            <span className={`text-xs font-medium capitalize ${statusColors[lastRun.status]}`}>
                              {lastRun.status}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          {lastRun.durationMs ? `${lastRun.durationMs}ms` : 'In progress'} · {new Date(lastRun.startedAt).toLocaleString()}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-md bg-muted/50 p-2">
                      <div className="text-xs text-muted-foreground">Fetched</div>
                      <div className="text-sm font-bold">{lastRun?.rowsFetched.toLocaleString() ?? '—'}</div>
                    </div>
                    <div className="rounded-md bg-muted/50 p-2">
                      <div className="text-xs text-muted-foreground">Written</div>
                      <div className="text-sm font-bold">{lastRun?.rowsWritten.toLocaleString() ?? '—'}</div>
                    </div>
                    <div className="rounded-md bg-muted/50 p-2">
                      <div className="text-xs text-muted-foreground">Failed</div>
                      <div className="text-sm font-bold text-red-500">{lastRun?.rowsFailed ?? '—'}</div>
                    </div>
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
          })
        )}
      </div>

      {/* Pipeline Analytics — run history timeline + status distribution */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="space-y-4"
      >
        <div className="flex items-center gap-3 pt-2">
          <div className="rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 p-2 text-white shadow-sm">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
              Pipeline Analytics
            </h2>
            <p className="text-sm text-muted-foreground">
              Run history and performance metrics across all pipelines
            </p>
          </div>
        </div>

        {/* Stat cards row */}
        <motion.div
          variants={analyticsContainerVariants}
          initial="hidden"
          animate="visible"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <motion.div variants={analyticsItemVariants}>
            <Card className="overflow-hidden relative">
              <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-emerald-500 to-teal-500 opacity-60" />
              <CardContent className="pt-5">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Total Runs
                  </div>
                  <div className="rounded-md bg-emerald-500/10 p-1.5">
                    <BarChart3 className="h-3.5 w-3.5 text-emerald-600" />
                  </div>
                </div>
                <div className="mt-2 text-2xl font-bold">{totalRuns.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {successCount} successful · {totalRuns - successCount} other
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={analyticsItemVariants}>
            <Card className="overflow-hidden relative">
              <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-emerald-500 to-teal-500 opacity-60" />
              <CardContent className="pt-5">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Success Rate
                  </div>
                  <div className="rounded-md bg-emerald-500/10 p-1.5">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                  </div>
                </div>
                <div className="mt-2 text-2xl font-bold text-emerald-600">{successRate}%</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {totalRuns > 0 ? `${successCount} of ${totalRuns} runs` : 'No runs yet'}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={analyticsItemVariants}>
            <Card className="overflow-hidden relative">
              <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-emerald-500 to-teal-500 opacity-60" />
              <CardContent className="pt-5">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Avg Duration
                  </div>
                  <div className="rounded-md bg-emerald-500/10 p-1.5">
                    <Timer className="h-3.5 w-3.5 text-emerald-600" />
                  </div>
                </div>
                <div className="mt-2 text-2xl font-bold">
                  {avgDuration > 0 ? `${avgDuration.toLocaleString()}ms` : '—'}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {completedRuns.length > 0
                    ? `across ${completedRuns.length} completed runs`
                    : 'no completed runs'}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={analyticsItemVariants}>
            <Card className="overflow-hidden relative">
              <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-emerald-500 to-teal-500 opacity-60" />
              <CardContent className="pt-5">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Total Rows Written
                  </div>
                  <div className="rounded-md bg-emerald-500/10 p-1.5">
                    <Database className="h-3.5 w-3.5 text-emerald-600" />
                  </div>
                </div>
                <div className="mt-2 text-2xl font-bold">{totalRowsWritten.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground mt-0.5">across all runs</div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        {totalRuns === 0 ? (
          <Card>
            <CardContent className="py-12 flex flex-col items-center justify-center text-muted-foreground">
              <Activity className="h-10 w-10 mb-2 opacity-40" />
              <p className="text-sm font-medium">No run history yet</p>
              <p className="text-xs mt-1">
                Run a pipeline to populate the timeline and status charts.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Run Duration Timeline (Bar Chart) */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-emerald-600" />
                  Run Duration Timeline
                </CardTitle>
                <CardDescription>
                  Duration (ms) of the last {timelineData.length} pipeline runs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={timelineData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis
                        dataKey="time"
                        tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                        tickLine={false}
                        axisLine={{ stroke: 'var(--border)' }}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                        tickLine={false}
                        axisLine={false}
                        width={48}
                      />
                      <RTooltip
                        cursor={{ fill: 'var(--muted)', opacity: 0.3 }}
                        contentStyle={{
                          backgroundColor: 'var(--popover)',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                          fontSize: '12px',
                          color: 'var(--popover-foreground)',
                        }}
                        labelStyle={{ color: 'var(--muted-foreground)', fontWeight: 600 }}
                        itemStyle={{ color: 'var(--popover-foreground)' }}
                        formatter={(value: number, _name, entry) => {
                          const status = (entry?.payload as { status?: string })?.status ?? 'unknown'
                          const rows = (entry?.payload as { rows?: number })?.rows ?? 0
                          return [
                            `${Number(value).toLocaleString()}ms · ${rows.toLocaleString()} rows`,
                            status.charAt(0).toUpperCase() + status.slice(1),
                          ]
                        }}
                        labelFormatter={(label) => `Started ${label}`}
                      />
                      <Bar dataKey="duration" radius={[4, 4, 0, 0]} name="Duration">
                        {timelineData.map((entry, i) => (
                          <Cell
                            key={`cell-${i}`}
                            fill={STATUS_COLORS[entry.status] ?? STATUS_COLORS.pending}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {/* Status legend */}
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                  {Object.entries(STATUS_COLORS).map(([status, color]) => {
                    const count = statusCounts[status] ?? 0
                    if (count === 0) return null
                    return (
                      <div key={status} className="flex items-center gap-1.5">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-sm"
                          style={{ backgroundColor: color }}
                          aria-hidden
                        />
                        <span className="capitalize text-muted-foreground">{status}</span>
                        <span className="font-medium">{count}</span>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Status Distribution (Donut Chart) */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-600" />
                  Status Distribution
                </CardTitle>
                <CardDescription>Run outcome breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[280px] w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={2}
                        stroke="var(--background)"
                        strokeWidth={2}
                      >
                        {pieData.map((entry, i) => (
                          <Cell key={`pie-cell-${i}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RTooltip
                        contentStyle={{
                          backgroundColor: 'var(--popover)',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                          fontSize: '12px',
                          color: 'var(--popover-foreground)',
                        }}
                        labelStyle={{ color: 'var(--muted-foreground)', fontWeight: 600 }}
                        itemStyle={{ color: 'var(--popover-foreground)' }}
                        formatter={(value: number, name: string) => [
                          `${value} run${value === 1 ? '' : 's'}`,
                          name.charAt(0).toUpperCase() + name.slice(1),
                        ]}
                      />
                      <Legend
                        verticalAlign="bottom"
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{
                          fontSize: '11px',
                          color: 'var(--muted-foreground)',
                          paddingTop: '4px',
                        }}
                        formatter={(value: string) => (
                          <span style={{ color: 'var(--muted-foreground)' }} className="capitalize">
                            {value}
                          </span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center label overlay */}
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center -mt-7">
                    <div className="text-2xl font-bold">{totalRuns}</div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Total Runs
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
