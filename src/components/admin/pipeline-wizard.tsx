'use client'

import { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Globe,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Database,
  Table2,
  ArrowRight,
  ArrowLeft,
  Wand2,
  Unlink,
  Clock,
  Loader2,
  ChevronDown,
  ChevronUp,
  Zap,
  Eye,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
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
import { useToast } from '@/hooks/use-toast'
import { apiPost } from '@/lib/api-client'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PipelineWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
  tables: Array<{
    id: string
    name: string
    displayName?: string
    rowCount: number
    columns: Array<{ name: string; type: string }>
  }>
}

interface DataPath {
  path: string
  label: string
  rowCount: number
  sampleColumns: string[]
  previewRows: Array<Record<string, unknown>>
  columns: Array<{ name: string; type: string; sampleValues: unknown[] }>
}

interface SmartPreviewResult {
  success: boolean
  url?: string
  method?: string
  statusCode?: number
  durationMs?: number
  sourceType?: 'json' | 'html'
  dataPaths?: DataPath[]
  error?: string
}

interface ColumnMapping {
  src: string
  target: string
  type: string
  transform?: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TYPE_BADGE_COLORS: Record<string, string> = {
  INTEGER: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200',
  TEXT: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200',
  DECIMAL: 'bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-200',
  BOOLEAN: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-200',
  TIMESTAMP: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200',
  JSON: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200',
}

const TRANSFORMS: Record<string, Record<string, string>> = {
  TEXT: {
    INTEGER: 'parseInt',
    DECIMAL: 'parseFloat',
    BOOLEAN: 'truthy check',
    TIMESTAMP: 'Date.parse',
    JSON: 'JSON.stringify',
  },
  INTEGER: { TEXT: 'String()' },
  DECIMAL: { TEXT: 'String()' },
  BOOLEAN: { TEXT: 'String()' },
}

function getTransform(srcType: string, targetType: string): string | undefined {
  if (srcType === targetType) return undefined
  return TRANSFORMS[srcType]?.[targetType]
}

const SCHEDULE_OPTIONS = [
  { label: 'Every 5 minutes', value: 300, icon: '⚡' },
  { label: 'Every 15 minutes', value: 900, icon: '🔄' },
  { label: 'Every hour', value: 3600, icon: '⏰' },
  { label: 'Every 6 hours', value: 21600, icon: '🕐' },
  { label: 'Every day', value: 86400, icon: '📅' },
  { label: 'Manual only', value: 0, icon: '👆' },
]

// ─── Step indicator ──────────────────────────────────────────────────────────

const STEPS = [
  { title: 'Data Source', subtitle: 'Paste URL' },
  { title: 'Choose Data', subtitle: 'Select table' },
  { title: 'Destination', subtitle: 'Target table' },
  { title: 'Map Columns', subtitle: 'Align fields' },
  { title: 'Schedule', subtitle: 'Set & create' },
]

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-1 mb-6">
      {STEPS.map((step, i) => (
        <div key={i} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                i < current
                  ? 'bg-emerald-500 text-white'
                  : i === current
                    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 ring-2 ring-emerald-500'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {i < current ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </div>
            <span className="text-[10px] mt-1 text-muted-foreground hidden sm:block">{step.title}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={`w-8 sm:w-12 h-0.5 mx-1 transition-colors ${
                i < current ? 'bg-emerald-500' : 'bg-muted'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function PipelineWizard({ open, onOpenChange, onCreated, tables }: PipelineWizardProps) {
  const { toast } = useToast()

  // Wizard state
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)

  // Step 1: URL fetch
  const [url, setUrl] = useState('')
  const [fetchMethod] = useState('GET')
  const [fetchLoading, setFetchLoading] = useState(false)
  const [fetchResult, setFetchResult] = useState<SmartPreviewResult | null>(null)

  // Step 2: Data path selection
  const [selectedPath, setSelectedPath] = useState<DataPath | null>(null)

  // Step 3: Destination table
  const [destMode, setDestMode] = useState<'existing' | 'new'>('existing')
  const [selectedTableId, setSelectedTableId] = useState('')
  const [newTableName, setNewTableName] = useState('')
  const [creatingTable, setCreatingTable] = useState(false)
  const [createdTable, setCreatedTable] = useState<{
    id: string
    name: string
    columns: Array<{ name: string; type: string }>
  } | null>(null)

  // Step 4: Column mapping
  const [mappings, setMappings] = useState<ColumnMapping[]>([])
  const [activeSource, setActiveSource] = useState<string | null>(null)

  // Step 5: Schedule
  const [fetchInterval, setFetchInterval] = useState(300)
  const [pipelineName, setPipelineName] = useState('')
  const [showConfig, setShowConfig] = useState(false)
  const [creating, setCreating] = useState(false)

  // ─── Reset wizard ────────────────────────────────────────────────────────
  const resetWizard = useCallback(() => {
    setStep(0)
    setDirection(1)
    setUrl('')
    setFetchResult(null)
    setSelectedPath(null)
    setDestMode('existing')
    setSelectedTableId('')
    setNewTableName('')
    setCreatingTable(false)
    setCreatedTable(null)
    setMappings([])
    setActiveSource(null)
    setFetchInterval(300)
    setPipelineName('')
    setShowConfig(false)
    setCreating(false)
  }, [])

  const handleClose = useCallback(
    (val: boolean) => {
      onOpenChange(val)
      if (!val) resetWizard()
    },
    [onOpenChange, resetWizard]
  )

  // ─── Step 1: Fetch data ──────────────────────────────────────────────────
  const handleFetch = async () => {
    if (!url.trim()) return
    setFetchLoading(true)
    setFetchResult(null)
    try {
      const result = await apiPost<SmartPreviewResult>('/api/pipelines/smart-preview', {
        url: url.trim(),
        method: fetchMethod,
      })
      setFetchResult(result)
    } catch (err) {
      setFetchResult({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fetch URL',
      })
    } finally {
      setFetchLoading(false)
    }
  }

  // ─── Step 2 → Step 3: When selecting a data path ────────────────────────
  const handleSelectPath = (path: DataPath) => {
    setSelectedPath(path)
    // Auto-generate pipeline name
    try {
      const u = new URL(url)
      const domainPart = u.hostname.replace('www.', '')
      const pathPart = u.pathname.split('/').filter(Boolean).slice(0, 2).join('_')
      setPipelineName(`${domainPart}${pathPart ? '_' + pathPart : ''}_pipeline`)
    } catch {
      setPipelineName('new_pipeline')
    }
  }

  // ─── Step 3: Get target columns ─────────────────────────────────────────
  const targetColumns = useMemo(() => {
    if (destMode === 'new' && createdTable) {
      return createdTable.columns
    }
    if (destMode === 'new' && selectedPath) {
      // Preview: source columns will become target columns
      return selectedPath.columns.map((c) => ({ name: c.name, type: c.type }))
    }
    const tbl = tables.find((t) => t.id === selectedTableId)
    return tbl?.columns || []
  }, [destMode, createdTable, selectedPath, tables, selectedTableId])

  const targetTableId = useMemo(() => {
    if (destMode === 'new' && createdTable) return createdTable.id
    return selectedTableId
  }, [destMode, createdTable, selectedTableId])

  // ─── Step 3: Create new table ───────────────────────────────────────────
  const handleCreateTable = async () => {
    if (!newTableName.trim() || !selectedPath) return
    setCreatingTable(true)
    try {
      const result = await apiPost<{
        id: string
        name: string
        columns: Array<{ name: string; type: string }>
      }>('/api/pipelines/auto-create-table', {
        name: newTableName.trim(),
        columns: selectedPath.columns.map((c) => ({ name: c.name, type: c.type })),
      })
      setCreatedTable(result)
      toast({ title: 'Table created', description: `"${result.name}" has been created.` })
    } catch (err) {
      toast({
        title: 'Failed to create table',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setCreatingTable(false)
    }
  }

  // ─── Step 4: Column mapping ─────────────────────────────────────────────
  const autoMap = useCallback(() => {
    if (!selectedPath || targetColumns.length === 0) return
    const newMappings: ColumnMapping[] = []
    const srcLower = selectedPath.columns.map((c) => ({
      ...c,
      lower: c.name.toLowerCase().replace(/[^a-z0-9]/g, ''),
    }))
    const tgtUsed = new Set<string>()

    for (const src of srcLower) {
      const match = targetColumns.find(
        (tgt) =>
          !tgtUsed.has(tgt.name) &&
          tgt.name.toLowerCase().replace(/[^a-z0-9]/g, '') === src.lower
      )
      if (match) {
        tgtUsed.add(match.name)
        const transform = getTransform(src.type, match.type)
        newMappings.push({
          src: src.name,
          target: match.name,
          type: match.type,
          transform,
        })
      }
    }
    setMappings(newMappings)
  }, [selectedPath, targetColumns])

  const unmapAll = useCallback(() => {
    setMappings([])
    setActiveSource(null)
  }, [])

  const handleSourceClick = useCallback(
    (srcName: string) => {
      if (activeSource === srcName) {
        setActiveSource(null)
        return
      }
      // If already mapped, unmap it
      const existing = mappings.find((m) => m.src === srcName)
      if (existing) {
        setMappings((prev) => prev.filter((m) => m.src !== srcName))
        setActiveSource(null)
        return
      }
      setActiveSource(srcName)
    },
    [activeSource, mappings]
  )

  const handleTargetClick = useCallback(
    (tgtName: string) => {
      if (!activeSource) return
      // Remove any existing mapping to this target
      const existing = mappings.find((m) => m.target === tgtName)
      let newMappings = mappings.filter((m) => m.target !== tgtName && m.src !== activeSource)

      const srcCol = selectedPath?.columns.find((c) => c.name === activeSource)
      const tgtCol = targetColumns.find((c) => c.name === tgtName)
      if (srcCol && tgtCol) {
        const transform = getTransform(srcCol.type, tgtCol.type)
        newMappings = [
          ...newMappings,
          { src: srcCol.name, target: tgtCol.name, type: tgtCol.type, transform },
        ]
      }
      setMappings(newMappings)
      setActiveSource(null)
    },
    [activeSource, mappings, selectedPath, targetColumns]
  )

  // ─── Step 5: Create pipeline ────────────────────────────────────────────
  const handleCreate = async () => {
    if (!pipelineName.trim() || !url.trim()) return
    setCreating(true)
    try {
      const payload: Record<string, unknown> = {
        name: pipelineName.trim(),
        sourceType: fetchResult?.sourceType === 'html' ? 'scraper' : 'rest',
        url: url.trim(),
        method: fetchMethod,
        fetchInterval,
        onConflict: 'update',
        isActive: fetchInterval > 0,
        columnMappings: JSON.stringify(mappings),
      }

      if (selectedPath && selectedPath.path !== '__html_table__' && selectedPath.path !== '(root)') {
        payload.jsonPath = selectedPath.path
      }

      if (targetTableId) {
        payload.targetTableId = targetTableId
      }

      // Auto-detect primary key columns (first mapped column or 'id' if exists)
      const pkCol = mappings.find(
        (m) => m.src.toLowerCase() === 'id' || m.target.toLowerCase() === 'id'
      )
      if (pkCol) {
        payload.primaryKeyCols = JSON.stringify([pkCol.target])
      }

      await apiPost('/api/pipelines', payload)
      toast({
        title: 'Pipeline created!',
        description: `"${pipelineName}" has been created and is now ${fetchInterval > 0 ? 'active' : 'in manual mode'}.`,
      })
      handleClose(false)
      onCreated()
    } catch (err) {
      toast({
        title: 'Failed to create pipeline',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setCreating(false)
    }
  }

  // ─── Navigation ─────────────────────────────────────────────────────────
  const canNext = useMemo(() => {
    switch (step) {
      case 0:
        return fetchResult?.success && (fetchResult.dataPaths?.length ?? 0) > 0
      case 1:
        return selectedPath !== null
      case 2:
        return (
          (destMode === 'existing' && selectedTableId !== '') ||
          (destMode === 'new' && createdTable !== null)
        )
      case 3:
        return true // mappings are optional
      case 4:
        return pipelineName.trim() !== '' && url.trim() !== ''
      default:
        return false
    }
  }, [step, fetchResult, selectedPath, destMode, selectedTableId, createdTable, pipelineName, url])

  const goNext = () => {
    if (step === 2 && destMode === 'new' && !createdTable) {
      // Auto-create table before proceeding
      handleCreateTable()
      return
    }
    if (step === 3 && mappings.length === 0) {
      autoMap()
    }
    setDirection(1)
    setStep((s) => Math.min(s + 1, 4))
  }

  const goBack = () => {
    setDirection(-1)
    setStep((s) => Math.max(s - 1, 0))
  }

  // ─── Slide animation variants ───────────────────────────────────────────
  const slideVariants = {
    enter: (d: number) => ({ x: d > 0 ? 200 : -200, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -200 : 200, opacity: 0 }),
  }

  // ─── Step content rendering ─────────────────────────────────────────────

  const renderStep1 = () => (
    <div className="space-y-4">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold">Paste Your Data Source URL</h2>
        <p className="text-sm text-muted-foreground">
          Enter any API URL, webpage, or data feed — we&apos;ll analyze what&apos;s available
        </p>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste any API URL, webpage, or data feed..."
            className="pl-10 h-11"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleFetch()
            }}
          />
        </div>
        <Button
          onClick={handleFetch}
          disabled={fetchLoading || !url.trim()}
          className="h-11 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white px-6"
        >
          {fetchLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing...
            </>
          ) : (
            <>
              <Search className="mr-2 h-4 w-4" /> Fetch Data
            </>
          )}
        </Button>
      </div>

      {fetchResult && fetchResult.success && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-emerald-700 dark:text-emerald-400">
                  Found {fetchResult.dataPaths?.length ?? 0} data table
                  {(fetchResult.dataPaths?.length ?? 0) !== 1 ? 's' : ''}!
                </p>
                <p className="text-xs text-muted-foreground">
                  Fetched in {fetchResult.durationMs ?? 0}ms
                </p>
              </div>
              <Badge
                variant="outline"
                className={
                  fetchResult.sourceType === 'json'
                    ? 'bg-amber-500/10 text-amber-700 border-amber-200'
                    : 'bg-teal-500/10 text-teal-700 border-teal-200'
                }
              >
                {fetchResult.sourceType?.toUpperCase()}
              </Badge>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {fetchResult && !fetchResult.success && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20">
            <CardContent className="p-4 flex items-center gap-3">
              <XCircle className="h-5 w-5 text-red-500 shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-red-700 dark:text-red-400">
                  {fetchResult.error || 'Failed to fetch data'}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={handleFetch}>
                Retry
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  )

  const renderStep2 = () => {
    const dataPaths = fetchResult?.dataPaths || []
    return (
      <div className="space-y-4">
        <div className="text-center space-y-1">
          <h2 className="text-xl font-bold">Choose Your Data</h2>
          <p className="text-sm text-muted-foreground">
            Click on the data table you want to import
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {dataPaths.map((dp) => (
            <motion.div
              key={dp.path}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card
                className={`cursor-pointer transition-all hover:shadow-md ${
                  selectedPath?.path === dp.path
                    ? 'ring-2 ring-emerald-500 border-emerald-300 dark:border-emerald-700'
                    : 'hover:border-emerald-200 dark:hover:border-emerald-800'
                }`}
                onClick={() => handleSelectPath(dp)}
              >
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Table2 className="h-4 w-4 text-emerald-500" />
                      {dp.label}
                    </CardTitle>
                    {selectedPath?.path === dp.path && (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pb-3 px-4 space-y-2">
                  <Badge variant="secondary" className="text-xs">
                    {dp.rowCount} rows
                  </Badge>
                  <div className="flex flex-wrap gap-1">
                    {dp.sampleColumns.map((col) => (
                      <Badge key={col} variant="outline" className="text-[10px] px-1.5 py-0">
                        {col}
                      </Badge>
                    ))}
                    {dp.columns.length > 5 && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        +{dp.columns.length - 5} more
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {selectedPath && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <Separator />
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Eye className="h-4 w-4 text-muted-foreground" /> Preview (first 5 rows)
              </h3>
              <div className="rounded-md border overflow-auto max-h-48">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {selectedPath.columns.slice(0, 6).map((col) => (
                        <TableHead key={col.name} className="text-xs whitespace-nowrap">
                          {col.name}
                        </TableHead>
                      ))}
                      {selectedPath.columns.length > 6 && (
                        <TableHead className="text-xs">...</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedPath.previewRows.map((row, i) => (
                      <TableRow key={i}>
                        {selectedPath.columns.slice(0, 6).map((col) => (
                          <TableCell key={col.name} className="text-xs whitespace-nowrap max-w-[120px] truncate">
                            {String(row[col.name] ?? '—')}
                          </TableCell>
                        ))}
                        {selectedPath.columns.length > 6 && (
                          <TableCell className="text-xs text-muted-foreground">...</TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-2">Detected Columns</h3>
              <div className="flex flex-wrap gap-2">
                {selectedPath.columns.map((col) => (
                  <div
                    key={col.name}
                    className="flex items-center gap-1.5 rounded-md border px-2 py-1"
                  >
                    <span className="text-xs font-medium">{col.name}</span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1 py-0 ${TYPE_BADGE_COLORS[col.type] || ''}`}
                    >
                      {col.type}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {col.sampleValues
                        .filter((v) => v !== null && v !== undefined)
                        .slice(0, 2)
                        .map((v) => String(v).substring(0, 15))
                        .join(', ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    )
  }

  const renderStep3 = () => (
    <div className="space-y-4">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold">Select Destination Table</h2>
        <p className="text-sm text-muted-foreground">
          Where should the data be stored?
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Existing Table */}
        <Card
          className={`cursor-pointer transition-all ${
            destMode === 'existing'
              ? 'ring-2 ring-emerald-500 border-emerald-300 dark:border-emerald-700'
              : 'hover:border-emerald-200'
          }`}
          onClick={() => setDestMode('existing')}
        >
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Database className="h-4 w-4 text-emerald-500" />
                Existing Table
              </CardTitle>
              {destMode === 'existing' && (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              )}
            </div>
          </CardHeader>
          <CardContent className="pb-4 px-4">
            <p className="text-xs text-muted-foreground mb-3">
              Write data to an existing table in your database
            </p>
            {destMode === 'existing' && (
              <Select value={selectedTableId} onValueChange={setSelectedTableId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a table..." />
                </SelectTrigger>
                <SelectContent>
                  {tables.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      <span className="font-medium">{t.displayName || t.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({t.rowCount.toLocaleString()} rows · {t.columns?.length || 0} cols)
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>

        {/* Create New Table */}
        <Card
          className={`cursor-pointer transition-all ${
            destMode === 'new'
              ? 'ring-2 ring-emerald-500 border-emerald-300 dark:border-emerald-700'
              : 'hover:border-emerald-200'
          }`}
          onClick={() => {
            if (!createdTable) setDestMode('new')
          }}
        >
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Zap className="h-4 w-4 text-teal-500" />
                Create New Table
              </CardTitle>
              {destMode === 'new' && (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              )}
            </div>
          </CardHeader>
          <CardContent className="pb-4 px-4">
            <p className="text-xs text-muted-foreground mb-3">
              Auto-create a table matching your source columns
            </p>
            {destMode === 'new' && !createdTable && (
              <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                <Input
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value)}
                  placeholder="Table name (e.g., stock_data)"
                  className="h-9"
                />
                <p className="text-[10px] text-muted-foreground">
                  Columns will be auto-created: {selectedPath?.columns.map((c) => c.name).join(', ')}
                </p>
              </div>
            )}
            {destMode === 'new' && createdTable && (
              <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                <span className="font-medium">{createdTable.name}</span>
                <span className="text-xs text-muted-foreground">
                  ({createdTable.columns.length} columns)
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Show target columns preview */}
      {targetColumns.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Target Columns</h3>
          <div className="flex flex-wrap gap-2">
            {targetColumns.map((col) => (
              <div
                key={col.name}
                className="flex items-center gap-1.5 rounded-md border px-2 py-1"
              >
                <span className="text-xs font-medium">{col.name}</span>
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1 py-0 ${TYPE_BADGE_COLORS[col.type] || ''}`}
                >
                  {col.type}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  const renderStep4 = () => {
    const sourceCols = selectedPath?.columns || []
    const mappedSources = new Set(mappings.map((m) => m.src))
    const mappedTargets = new Set(mappings.map((m) => m.target))
    const unmappedSourceCount = sourceCols.filter((c) => !mappedSources.has(c.name)).length
    const unmappedTargetCount = targetColumns.filter((c) => !mappedTargets.has(c.name)).length

    return (
      <div className="space-y-4">
        <div className="text-center space-y-1">
          <h2 className="text-xl font-bold">Map Your Columns</h2>
          <p className="text-sm text-muted-foreground">
            Click a source column, then click a target column to map them
          </p>
        </div>

        <div className="flex gap-2 justify-center flex-wrap">
          <Button size="sm" variant="outline" onClick={autoMap}>
            <Wand2 className="mr-1 h-3.5 w-3.5" /> Auto-Map
          </Button>
          <Button size="sm" variant="outline" onClick={unmapAll}>
            <Unlink className="mr-1 h-3.5 w-3.5" /> Unmap All
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Source Columns */}
          <div>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-emerald-500" />
              Source Columns
              <Badge variant="secondary" className="text-xs">
                {sourceCols.length}
              </Badge>
            </h3>
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
              {sourceCols.map((col) => {
                const mapped = mappings.find((m) => m.src === col.name)
                const isActive = activeSource === col.name
                return (
                  <Card
                    key={col.name}
                    className={`cursor-pointer transition-all py-0 ${
                      isActive
                        ? 'ring-2 ring-emerald-500 border-emerald-300'
                        : mapped
                          ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20'
                          : 'hover:border-emerald-200'
                    }`}
                    onClick={() => handleSourceClick(col.name)}
                  >
                    <CardContent className="p-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              mapped ? 'bg-emerald-500' : 'bg-muted-foreground/30'
                            }`}
                          />
                          <span className="text-xs font-medium truncate">{col.name}</span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1 py-0 shrink-0 ${TYPE_BADGE_COLORS[col.type] || ''}`}
                          >
                            {col.type}
                          </Badge>
                        </div>
                        {mapped && (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 shrink-0 ml-1">
                            → {mapped.target}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                        {col.sampleValues
                          .filter((v) => v !== null && v !== undefined)
                          .slice(0, 2)
                          .map((v) => String(v).substring(0, 20))
                          .join(', ')}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>

          {/* Target Columns */}
          <div>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Database className="h-4 w-4 text-teal-500" />
              Target Columns
              <Badge variant="secondary" className="text-xs">
                {targetColumns.length}
              </Badge>
            </h3>
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
              {targetColumns.map((col) => {
                const mapped = mappings.find((m) => m.target === col.name)
                return (
                  <Card
                    key={col.name}
                    className={`cursor-pointer transition-all py-0 ${
                      activeSource && !mapped
                        ? 'hover:ring-2 hover:ring-emerald-400 border-dashed'
                        : mapped
                          ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20'
                          : ''
                    } ${mapped ? 'border-l-4 border-l-emerald-500' : ''}`}
                    onClick={() => handleTargetClick(col.name)}
                  >
                    <CardContent className="p-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-medium truncate">{col.name}</span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1 py-0 shrink-0 ${TYPE_BADGE_COLORS[col.type] || ''}`}
                          >
                            {col.type}
                          </Badge>
                        </div>
                        {mapped && (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 shrink-0 ml-1">
                            ← {mapped.src}
                          </span>
                        )}
                      </div>
                      {mapped && mapped.transform && (
                        <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5 flex items-center gap-1">
                          <Wand2 className="h-3 w-3" />
                          Auto-transform: {mapped.src}({sourceCols.find((c) => c.name === mapped.src)?.type}) → {col.type}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        </div>

        {/* Warnings */}
        {(unmappedSourceCount > 0 || unmappedTargetCount > 0) && (
          <div className="flex flex-wrap gap-2">
            {unmappedSourceCount > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                {unmappedSourceCount} source column{unmappedSourceCount !== 1 ? 's' : ''} not mapped
              </div>
            )}
            {unmappedTargetCount > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                {unmappedTargetCount} target column{unmappedTargetCount !== 1 ? 's' : ''} will be NULL
              </div>
            )}
          </div>
        )}

        {/* Transformation Preview */}
        {mappings.filter((m) => m.transform).length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-2">Transformations</h3>
            <div className="space-y-1">
              {mappings
                .filter((m) => m.transform)
                .map((m) => {
                  const srcType = sourceCols.find((c) => c.name === m.src)?.type || 'TEXT'
                  return (
                    <div
                      key={m.src}
                      className="flex items-center gap-2 text-xs rounded-md border px-2 py-1.5"
                    >
                      <Wand2 className="h-3 w-3 text-amber-500" />
                      <span className="font-medium">{m.src}</span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1 py-0 ${TYPE_BADGE_COLORS[srcType] || ''}`}
                      >
                        {srcType}
                      </Badge>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">{m.target}</span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1 py-0 ${TYPE_BADGE_COLORS[m.type] || ''}`}
                      >
                        {m.type}
                      </Badge>
                      <span className="text-muted-foreground">({m.transform})</span>
                    </div>
                  )
                })}
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderStep5 = () => (
    <div className="space-y-4">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold">Set Schedule &amp; Create</h2>
        <p className="text-sm text-muted-foreground">
          Choose how often to fetch data and finalize your pipeline
        </p>
      </div>

      {/* Schedule */}
      <div>
        <Label className="text-sm font-semibold mb-2 block">Fetch Schedule</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {SCHEDULE_OPTIONS.map((opt) => (
            <Card
              key={opt.value}
              className={`cursor-pointer transition-all py-0 ${
                fetchInterval === opt.value
                  ? 'ring-2 ring-emerald-500 border-emerald-300 dark:border-emerald-700'
                  : 'hover:border-emerald-200'
              }`}
              onClick={() => setFetchInterval(opt.value)}
            >
              <CardContent className="p-3 text-center">
                <span className="text-lg">{opt.icon}</span>
                <p className="text-xs font-medium mt-1">{opt.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Pipeline Name */}
      <div>
        <Label className="text-sm font-semibold mb-2 block">Pipeline Name</Label>
        <Input
          value={pipelineName}
          onChange={(e) => setPipelineName(e.target.value)}
          placeholder="My Pipeline"
          className="h-10"
        />
      </div>

      {/* Preview Config */}
      <div>
        <button
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setShowConfig(!showConfig)}
        >
          {showConfig ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          Preview Generated Config
        </button>
        <AnimatePresence>
          {showConfig && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <pre className="mt-2 text-[11px] bg-muted/50 rounded-md p-3 overflow-auto max-h-48 font-mono">
                {JSON.stringify(
                  {
                    name: pipelineName,
                    url,
                    method: fetchMethod,
                    sourceType: fetchResult?.sourceType === 'html' ? 'scraper' : 'rest',
                    jsonPath:
                      selectedPath &&
                      selectedPath.path !== '__html_table__' &&
                      selectedPath.path !== '(root)'
                        ? selectedPath.path
                        : undefined,
                    targetTableId: targetTableId || undefined,
                    columnMappings: mappings,
                    fetchInterval,
                    onConflict: 'update',
                    isActive: fetchInterval > 0,
                  },
                  null,
                  2
                )}
              </pre>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Create Button */}
      <Button
        onClick={handleCreate}
        disabled={creating || !pipelineName.trim()}
        className="w-full h-12 text-base bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white"
      >
        {creating ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Creating Pipeline...
          </>
        ) : (
          <>
            🚀 Create Pipeline
          </>
        )}
      </Button>
    </div>
  )

  const stepRenderers = [renderStep1, renderStep2, renderStep3, renderStep4, renderStep5]

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle className="sr-only">Smart Pipeline Wizard</DialogTitle>
          <DialogDescription className="sr-only">
            Step-by-step pipeline creation wizard
          </DialogDescription>
          <StepIndicator current={step} />
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 scrollbar-thin">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: 'easeInOut' }}
            >
              {stepRenderers[step]()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t shrink-0">
          <Button
            variant="outline"
            onClick={goBack}
            disabled={step === 0}
          >
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>

          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            Step {step + 1} of 5
          </div>

          {step < 4 ? (
            <Button onClick={goNext} disabled={!canNext}>
              Next <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleCreate}
              disabled={creating || !canNext}
              className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white"
            >
              {creating ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Zap className="mr-1 h-4 w-4" />
              )}
              Create
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
