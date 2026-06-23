'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Code2,
  Plus,
  Play,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MoreHorizontal,
  Pencil,
  Trash2,
  Search,
  Zap,
  Calendar,
  Radio,
  ArrowRight,
  Terminal,
  Copy,
  RefreshCw,
  Loader2,
  Globe,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
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
import { Switch } from '@/components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useToast } from '@/hooks/use-toast'
import { apiGet, apiPost, apiPut, apiDelete, parseJsonField } from '@/lib/api-client'

interface FunctionRunItem {
  id: string
  status: 'pending' | 'running' | 'success' | 'failed' | 'timeout'
  triggeredBy: string | null
  durationMs: number | null
  memoryUsedMb: number | null
  startedAt: string
  completedAt: string | null
  errorPayload?: string | null
  output?: string | null
}

interface SbFunctionItem {
  id: string
  name: string
  description: string | null
  code: string
  runtime: string
  triggerType: 'http' | 'schedule' | 'event'
  triggerConfig: string | null
  envVars?: string | null
  timeoutMs: number
  memoryMb: number
  isActive: boolean
  createdAt: string
  functionRuns?: FunctionRunItem[]
}

const triggerIcons = {
  http: Globe,
  schedule: Clock,
  event: Zap,
  manual: Play,
}

const triggerBadgeColors: Record<string, string> = {
  http: 'bg-teal-500/10 text-teal-700 border-teal-200',
  schedule: 'bg-amber-500/10 text-amber-700 border-amber-200',
  event: 'bg-purple-500/10 text-purple-700 border-purple-200',
  manual: 'bg-slate-500/10 text-slate-700 border-slate-200',
}

const runtimeBadgeColors: Record<string, string> = {
  javascript: 'bg-amber-500/10 text-amber-700 border-amber-200',
  typescript: 'bg-blue-600/10 text-blue-600 border-blue-200',
  python: 'bg-emerald-500/10 text-emerald-700 border-emerald-200',
  wasm: 'bg-slate-500/10 text-slate-700 border-slate-200',
}

const statusIcons = {
  pending: Clock,
  running: Play,
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

const defaultCode = `export default async function handler(ctx) {
  const { input, env } = ctx;
  // Your code here
  console.log('Input:', input);
  return { ok: true, received: Object.keys(input || {}).length };
}
`

function highlightCode(code: string): React.ReactNode[] {
  const lines = code.split('\n')
  return lines.map((line, lineIdx) => {
    const parts: React.ReactNode[] = []
    let remaining = line
    let keyIdx = 0
    while (remaining.length > 0) {
      // Comments
      const commentMatch = remaining.match(/^(\/\/.*$)/)
      if (commentMatch) {
        parts.push(<span key={`${lineIdx}-${keyIdx++}`} className="text-slate-500 dark:text-slate-400">{commentMatch[1]}</span>)
        remaining = remaining.slice(commentMatch[1].length)
        continue
      }
      // Strings (single and double quoted)
      const stringMatch = remaining.match(/^("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/)
      if (stringMatch) {
        parts.push(<span key={`${lineIdx}-${keyIdx++}`} className="text-emerald-400">{stringMatch[1]}</span>)
        remaining = remaining.slice(stringMatch[1].length)
        continue
      }
      // Keywords
      const keywordMatch = remaining.match(/^(function|const|let|var|async|await|return|if|else|for|while|class|import|export|from|new|try|catch|throw|typeof|instanceof|switch|case|break|default|yield)\b/)
      if (keywordMatch) {
        parts.push(<span key={`${lineIdx}-${keyIdx++}`} className="text-violet-400 font-medium">{keywordMatch[1]}</span>)
        remaining = remaining.slice(keywordMatch[1].length)
        continue
      }
      // Numbers
      const numberMatch = remaining.match(/^(\d+\.?\d*)/)
      if (numberMatch) {
        parts.push(<span key={`${lineIdx}-${keyIdx++}`} className="text-amber-400">{numberMatch[1]}</span>)
        remaining = remaining.slice(numberMatch[1].length)
        continue
      }
      // Default: take one character
      parts.push(<span key={`${lineIdx}-${keyIdx++}`}>{remaining[0]}</span>)
      remaining = remaining.slice(1)
    }
    if (lineIdx < lines.length - 1) {
      parts.push('\n')
    }
    return <span key={`line-${lineIdx}`}>{parts}</span>
  })
}

export function FunctionsView() {
  const { toast } = useToast()
  const [functions, setFunctions] = useState<SbFunctionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [selectedFunction, setSelectedFunction] = useState<SbFunctionItem | null>(null)
  const [runningId, setRunningId] = useState<string | null>(null)
  const [runResult, setRunResult] = useState<{ fn: SbFunctionItem; result: { runId: string; status: string; output?: unknown; durationMs?: number; error?: string } } | null>(null)

  // Create form
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newRuntime, setNewRuntime] = useState('javascript')
  const [newTrigger, setNewTrigger] = useState<'http' | 'schedule' | 'event'>('http')
  const [newTimeout, setNewTimeout] = useState('30000')
  const [newMemory, setNewMemory] = useState('128')
  const [newCron, setNewCron] = useState('')
  const [newEventPattern, setNewEventPattern] = useState('')
  const [newEnvVars, setNewEnvVars] = useState('{}')
  const [codeText, setCodeText] = useState(defaultCode)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiGet<SbFunctionItem[]>('/api/functions')
      setFunctions(Array.isArray(data) ? data : [])
    } catch (err) {
      toast({
        title: 'Failed to load functions',
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

  const handleCreate = async () => {
    if (!newName.trim()) {
      toast({ title: 'Name required', variant: 'destructive' })
      return
    }
    const triggerConfig: Record<string, unknown> = {}
    if (newTrigger === 'schedule' && newCron) triggerConfig.cron = newCron
    if (newTrigger === 'event' && newEventPattern) triggerConfig.pattern = newEventPattern
    try {
      const created = await apiPost<SbFunctionItem>('/api/functions', {
        name: newName.trim(),
        description: newDesc || null,
        code: codeText,
        runtime: newRuntime,
        triggerType: newTrigger,
        triggerConfig: Object.keys(triggerConfig).length > 0 ? JSON.stringify(triggerConfig) : null,
        envVars: newEnvVars || null,
        timeoutMs: Number(newTimeout) || 30000,
        memoryMb: Number(newMemory) || 128,
        isActive: true,
      })
      setFunctions((prev) => [{ ...created, functionRuns: [] }, ...prev])
      setShowCreateDialog(false)
      setNewName('')
      setNewDesc('')
      setNewRuntime('javascript')
      setNewTrigger('http')
      setNewTimeout('30000')
      setNewMemory('128')
      setNewCron('')
      setNewEventPattern('')
      setNewEnvVars('{}')
      setCodeText(defaultCode)
      toast({ title: 'Function created', description: `"${created.name}" has been deployed.` })
    } catch (err) {
      toast({
        title: 'Failed to create function',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  const handleToggleActive = async (fn: SbFunctionItem) => {
    try {
      await apiPut(`/api/functions/${fn.id}`, { isActive: !fn.isActive })
      setFunctions((prev) =>
        prev.map((f) => (f.id === fn.id ? { ...f, isActive: !f.isActive } : f)),
      )
      if (selectedFunction?.id === fn.id) {
        setSelectedFunction((prev) => (prev ? { ...prev, isActive: !prev.isActive } : prev))
      }
      toast({ title: `Function ${fn.isActive ? 'deactivated' : 'activated'}` })
    } catch (err) {
      toast({
        title: 'Failed to toggle function',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  const handleRun = async (fn: SbFunctionItem) => {
    setRunningId(fn.id)
    try {
      const result = await apiPost<{ runId: string; status: string; output?: unknown; durationMs?: number; error?: string }>(
        `/api/functions/${fn.id}/run`,
        {},
      )
      setRunResult({ fn, result })
      toast({
        title: result.status === 'success' ? 'Function executed' : 'Function run failed',
        description:
          result.status === 'success'
            ? `Completed in ${result.durationMs ?? 0}ms.`
            : result.error ?? `Status: ${result.status}`,
        variant: result.status === 'success' ? 'default' : 'destructive',
      })
      await loadAll()
      if (selectedFunction?.id === fn.id) {
        const fresh = (await apiGet<SbFunctionItem[]>('/api/functions')).find((f) => f.id === fn.id)
        if (fresh) setSelectedFunction(fresh)
      }
    } catch (err) {
      toast({
        title: 'Function run failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setRunningId(null)
    }
  }

  const handleDelete = async (fn: SbFunctionItem) => {
    try {
      await apiDelete(`/api/functions/${fn.id}`)
      setFunctions((prev) => prev.filter((f) => f.id !== fn.id))
      if (selectedFunction?.id === fn.id) setSelectedFunction(null)
      toast({ title: 'Function deleted', variant: 'destructive' })
    } catch (err) {
      toast({
        title: 'Failed to delete function',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  const filteredFunctions = functions.filter(
    (f) =>
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      (f.description ?? '').toLowerCase().includes(search.toLowerCase()),
  )

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-40 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (selectedFunction) {
    const TriggerIcon = triggerIcons[selectedFunction.triggerType]
    const runs = selectedFunction.functionRuns ?? []
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="space-y-6"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => setSelectedFunction(null)}>
            <ArrowRight className="h-4 w-4 rotate-180" /> Back
          </Button>
          <div className="h-6 w-px bg-border" />
          <div className="rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 p-2 text-white">
            <Code2 className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{selectedFunction.name}</h1>
          <Badge variant="outline" className={`capitalize ${triggerBadgeColors[selectedFunction.triggerType]}`}>
            <TriggerIcon className="h-3 w-3 mr-1" />
            {selectedFunction.triggerType}
          </Badge>
          <Badge variant={selectedFunction.isActive ? 'default' : 'secondary'}>
            {selectedFunction.isActive ? <><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />Active</> : 'Inactive'}
          </Badge>
          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              onClick={() => void handleRun(selectedFunction)}
              disabled={runningId === selectedFunction.id || !selectedFunction.isActive}
            >
              {runningId === selectedFunction.id ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="mr-1 h-3.5 w-3.5" />
              )}
              Run
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Trigger</div>
              <div className="flex items-center gap-1 text-lg font-bold capitalize">
                <TriggerIcon className="h-4 w-4" />
                {selectedFunction.triggerType}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Timeout</div>
              <div className="text-lg font-bold">{selectedFunction.timeoutMs / 1000}s</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Memory</div>
              <div className="text-lg font-bold">{selectedFunction.memoryMb} MB</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Total Runs</div>
              <div className="text-lg font-bold">{runs.length}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Source Code</CardTitle>
              <CardDescription>
                {selectedFunction.runtime} · {selectedFunction.code.split('\n').length} lines
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(selectedFunction.code)
                      toast({ title: 'Code copied' })
                    }}
                  >
                    <Copy className="h-3.5 w-3.5 mr-1" /> Copy
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copy code to clipboard</TooltipContent>
              </Tooltip>
              <Button size="sm" onClick={() => void handleRun(selectedFunction)} disabled={runningId === selectedFunction.id || !selectedFunction.isActive}>
                <Play className="h-3.5 w-3.5 mr-1" /> Run
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md bg-slate-950 text-slate-200 p-4 overflow-auto max-h-[400px]">
              <pre className="text-sm font-mono whitespace-pre-wrap">{highlightCode(selectedFunction.code)}</pre>
            </div>
          </CardContent>
        </Card>

        {selectedFunction.triggerConfig && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Trigger Configuration</CardTitle>
              <CardDescription>How this function is invoked</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md bg-muted/50 p-3">
                <pre className="text-sm font-mono">
                  {JSON.stringify(parseJsonField(selectedFunction.triggerConfig, {}), null, 2)}
                </pre>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Run History</CardTitle>
            <CardDescription>Recent function executions</CardDescription>
          </CardHeader>
          <CardContent>
            {runs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Terminal className="h-10 w-10 mb-2 opacity-40" />
                <p className="text-sm">No runs yet</p>
                <p className="text-xs mt-1">Click "Run" to execute this function.</p>
              </div>
            ) : (
              <div className="rounded-md border max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Trigger</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Memory</TableHead>
                      <TableHead>Started</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {runs.map((run) => {
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
                          <TableCell>
                            <Badge variant="outline" className="text-xs capitalize">
                              {run.triggeredBy ?? '—'}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {run.durationMs ? `${run.durationMs}ms` : '—'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {run.memoryUsedMb ? `${Math.round(run.memoryUsedMb)} MB` : '—'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(run.startedAt).toLocaleString()}
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

        {/* Run Result Dialog */}
        <Dialog open={!!runResult} onOpenChange={(open) => !open && setRunResult(null)}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {runResult?.result.status === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                Function Result: {runResult?.fn.name}
              </DialogTitle>
              <DialogDescription>
                {runResult?.result.status === 'success' ? 'Executed successfully' : 'Execution failed'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className={`rounded-lg border-2 p-4 ${
                runResult?.result.status === 'success'
                  ? 'border-emerald-300 bg-emerald-500/5 dark:border-emerald-700 dark:bg-emerald-500/10'
                  : 'border-red-300 bg-red-500/5 dark:border-red-700 dark:bg-red-500/10'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  {runResult?.result.status === 'success' ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                  <span className={`font-semibold capitalize ${runResult?.result.status === 'success' ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                    {runResult?.result.status}
                  </span>
                </div>
                <div className="flex flex-wrap gap-3 text-xs">
                  {runResult?.result.durationMs !== undefined && runResult.result.durationMs !== null && (
                    <div className="rounded-md bg-background/60 px-2.5 py-1.5 border">
                      <span className="text-muted-foreground">Duration: </span>
                      <span className="font-mono font-medium">{runResult.result.durationMs}ms</span>
                    </div>
                  )}
                  <div className="rounded-md bg-background/60 px-2.5 py-1.5 border">
                    <span className="text-muted-foreground">Run ID: </span>
                    <span className="font-mono font-medium">{runResult?.result.runId?.slice(0, 8)}...</span>
                  </div>
                  <div className="rounded-md bg-background/60 px-2.5 py-1.5 border">
                    <span className="text-muted-foreground">Runtime: </span>
                    <span className="font-medium capitalize">{runResult?.fn.runtime}</span>
                  </div>
                </div>
              </div>
              {runResult?.result.error && (
                <div className="rounded-md bg-red-500/10 border border-red-200 p-3 text-sm text-red-700 dark:text-red-400">
                  <div className="flex items-center gap-1.5 mb-1 font-medium">
                    <XCircle className="h-3.5 w-3.5" />
                    Error
                  </div>
                  <pre className="whitespace-pre-wrap font-mono text-xs">{runResult.result.error}</pre>
                </div>
              )}
              {runResult?.result.output !== undefined && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="text-sm font-medium">Output</div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs gap-1"
                      onClick={() => {
                        if (runResult?.result.output) {
                          navigator.clipboard.writeText(
                            typeof runResult.result.output === 'string'
                              ? runResult.result.output
                              : JSON.stringify(runResult.result.output, null, 2),
                          )
                          toast({ title: 'Result copied' })
                        }
                      }}
                    >
                      <Copy className="h-3 w-3" /> Copy Result
                    </Button>
                  </div>
                  <div className="rounded-md bg-slate-950 text-slate-200 p-3 overflow-auto max-h-[40vh]">
                    <pre className="text-sm font-mono whitespace-pre-wrap">
                      {typeof runResult.result.output === 'string'
                        ? runResult.result.output
                        : JSON.stringify(runResult.result.output, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRunResult(null)}>Close</Button>
            </DialogFooter>
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
            Functions
          </h1>
          <p className="text-muted-foreground">Manage serverless functions and triggers</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-1 h-4 w-4" /> New Function
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>Create Function</DialogTitle>
              <DialogDescription>Deploy a new serverless function</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2 max-h-[65vh] overflow-y-auto">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Function Name</Label>
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="myFunction" />
                </div>
                <div className="space-y-2">
                  <Label>Runtime</Label>
                  <Select value={newRuntime} onValueChange={setNewRuntime}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="javascript">JavaScript</SelectItem>
                      <SelectItem value="typescript">TypeScript</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="What does this function do?" />
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Trigger Type</Label>
                  <Select value={newTrigger} onValueChange={(v) => setNewTrigger(v as typeof newTrigger)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="http">HTTP Endpoint</SelectItem>
                      <SelectItem value="schedule">Scheduled (Cron)</SelectItem>
                      <SelectItem value="event">Event-driven</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Timeout (ms)</Label>
                  <Input type="number" value={newTimeout} onChange={(e) => setNewTimeout(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Memory (MB)</Label>
                  <Input type="number" value={newMemory} onChange={(e) => setNewMemory(e.target.value)} />
                </div>
              </div>
              {newTrigger === 'schedule' && (
                <div className="space-y-2">
                  <Label>Cron Expression</Label>
                  <Input
                    value={newCron}
                    onChange={(e) => setNewCron(e.target.value)}
                    placeholder="0 9 * * *"
                  />
                  <p className="text-xs text-muted-foreground">Standard cron format (min hour day month weekday)</p>
                </div>
              )}
              {newTrigger === 'event' && (
                <div className="space-y-2">
                  <Label>Event Pattern</Label>
                  <Input
                    value={newEventPattern}
                    onChange={(e) => setNewEventPattern(e.target.value)}
                    placeholder="orders.*"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>Environment Variables (JSON)</Label>
                <Textarea
                  value={newEnvVars}
                  onChange={(e) => setNewEnvVars(e.target.value)}
                  className="font-mono text-xs"
                  rows={3}
                  placeholder='{"API_KEY": "..."}'
                />
              </div>
              <div className="space-y-2">
                <Label>Code</Label>
                <Textarea
                  value={codeText}
                  onChange={(e) => setCodeText(e.target.value)}
                  className="font-mono text-xs bg-slate-950 text-emerald-400 min-h-[260px]"
                  rows={12}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate}>Create Function</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Total Functions</div>
            <div className="text-2xl font-bold">{functions.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Active</div>
            <div className="text-2xl font-bold text-emerald-600">
              {functions.filter((f) => f.isActive).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">HTTP Triggers</div>
            <div className="text-2xl font-bold">
              {functions.filter((f) => f.triggerType === 'http').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Total Runs</div>
            <div className="text-2xl font-bold">
              {functions.reduce((s, f) => s + (f.functionRuns?.length ?? 0), 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search functions..."
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
        {filteredFunctions.length === 0 ? (
          <Card className="md:col-span-2">
            <CardContent className="py-16 flex flex-col items-center justify-center text-muted-foreground">
              <Code2 className="h-14 w-14 mb-3 opacity-30" />
              <p className="text-base font-medium">No functions yet</p>
              <p className="text-sm mt-1">Deploy your first serverless function to get started.</p>
              <Button className="mt-4" onClick={() => setShowCreateDialog(true)}>
                <Plus className="mr-1 h-4 w-4" /> New Function
              </Button>
            </CardContent>
          </Card>
        ) : (
          filteredFunctions.map((fn, idx) => {
            const TriggerIcon = triggerIcons[fn.triggerType]
            const lastRun = fn.functionRuns?.[0]
            const LastStatusIcon = lastRun ? statusIcons[lastRun.status] : null
            return (
              <motion.div
                key={fn.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: idx * 0.05 }}
              >
              <Card
                className="cursor-pointer hover:shadow-md hover:-translate-y-0.5 hover:border-emerald-200 transition-all duration-200"
                onClick={() => setSelectedFunction(fn)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="rounded-md bg-gradient-to-br from-emerald-500/10 to-teal-500/10 p-1.5">
                        <Code2 className="h-4 w-4 text-emerald-600" />
                      </div>
                      <CardTitle className="text-base font-mono">{fn.name}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={fn.isActive}
                        onCheckedChange={() => void handleToggleActive(fn)}
                        onClick={(e) => e.stopPropagation()}
                      />
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
                              void handleRun(fn)
                            }}
                          >
                            <Play className="mr-2 h-3.5 w-3.5" /> Run Now
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                            <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={(e) => {
                              e.stopPropagation()
                              void handleDelete(fn)
                            }}
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <CardDescription className="line-clamp-1">{fn.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <Badge variant="outline" className={`text-xs capitalize ${triggerBadgeColors[fn.triggerType]}`}>
                      <TriggerIcon className="h-3 w-3 mr-1" />
                      {fn.triggerType}
                    </Badge>
                    <Badge variant="outline" className={`text-xs ${runtimeBadgeColors[fn.runtime] ?? ''}`}>
                      {fn.runtime}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{fn.timeoutMs / 1000}s timeout</span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">{fn.memoryMb} MB</span>
                  </div>
                  <div className="rounded-md bg-slate-950 text-slate-200 p-2 overflow-hidden">
                    <pre className="text-xs font-mono line-clamp-3 whitespace-pre-wrap">{highlightCode(fn.code.slice(0, 180) + (fn.code.length > 180 ? '...' : ''))}</pre>
                  </div>
                  {lastRun && LastStatusIcon && (
                    <div className="mt-3 flex items-center gap-2 text-xs border-t pt-2">
                      <LastStatusIcon className={`h-3 w-3 ${statusColors[lastRun.status]}`} />
                      <span className={`capitalize ${statusColors[lastRun.status]}`}>{lastRun.status}</span>
                      <span className="text-muted-foreground">
                        · {lastRun.durationMs ? `${lastRun.durationMs}ms` : 'running'}
                      </span>
                      <span className="text-muted-foreground ml-auto">
                        {new Date(lastRun.startedAt).toLocaleString()}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
              </motion.div>
            )
          })
        )}
      </div>
    </motion.div>
  )
}
