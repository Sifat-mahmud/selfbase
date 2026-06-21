'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Globe,
  Plus,
  Play,
  Eye,
  MoreHorizontal,
  Pencil,
  Trash2,
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  ArrowRight,
  Code,
  Layers,
  RefreshCw,
  Loader2,
  Shield,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useToast } from '@/hooks/use-toast'
import { apiGet, apiPost, apiPut, apiDelete, parseJsonField } from '@/lib/api-client'

interface ScrapeRunItem {
  id: string
  status: 'pending' | 'running' | 'success' | 'failed'
  startedAt: string
  completedAt: string | null
  durationMs: number | null
  pagesScraped: number
  rowsExtracted: number
  rowsWritten: number
  errorPayload?: string | null
  isPreview: boolean
}

interface ScraperSitemapItem {
  id: string
  name: string
  description: string | null
  startUrl: string
  selectorTree: string
  paginationType: 'none' | 'click' | 'scroll' | 'url_pattern'
  paginationConfig?: string | null
  targetTableId?: string | null
  targetTable?: { name: string } | null
  outputFormat: string
  isActive: boolean
  useStealth?: boolean
  respectRobotsTxt?: boolean
  fetchInterval: number
  rateLimitMs: number
  concurrency: number
  maxPages: number
  createdAt: string
  scrapeRuns?: ScrapeRunItem[]
}

interface ScrapeRunsResponse {
  data?: ScrapeRunItem[]
  meta?: { page: number; limit: number; total: number }
}

interface PreviewResult {
  id?: string
  status?: string
  message?: string
  error?: string
  rows?: Array<Record<string, unknown>>
}

const statusIcons = {
  pending: Clock,
  running: Play,
  success: CheckCircle2,
  failed: XCircle,
}

const statusColors = {
  pending: 'text-amber-500',
  running: 'text-blue-500',
  success: 'text-emerald-500',
  failed: 'text-red-500',
}

const paginationBadgeColors: Record<string, string> = {
  none: 'bg-slate-400/10 text-slate-700 border-slate-200',
  click: 'bg-emerald-500/10 text-emerald-700 border-emerald-200',
  scroll: 'bg-teal-500/10 text-teal-700 border-teal-200',
  url_pattern: 'bg-amber-500/10 text-amber-700 border-amber-200',
}

const defaultSelectorTree = {
  container: '.item',
  fields: {
    title: 'h2',
    description: '.desc',
    link: 'a@href',
  },
}

export function ScraperView() {
  const { toast } = useToast()
  const [sitemaps, setSitemaps] = useState<ScraperSitemapItem[]>([])
  const [allRuns, setAllRuns] = useState<ScrapeRunItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [selectedSitemap, setSelectedSitemap] = useState<ScraperSitemapItem | null>(null)
  const [previewTarget, setPreviewTarget] = useState<ScraperSitemapItem | null>(null)
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [runningId, setRunningId] = useState<string | null>(null)

  // Create form
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [newPagination, setNewPagination] = useState<'none' | 'click' | 'scroll' | 'url_pattern'>('none')
  const [newMaxPages, setNewMaxPages] = useState('50')
  const [newRateLimit, setNewRateLimit] = useState('1000')
  const [newConcurrency, setNewConcurrency] = useState('1')
  const [newSelectorTree, setNewSelectorTree] = useState(JSON.stringify(defaultSelectorTree, null, 2))
  const [newStealth, setNewStealth] = useState(false)
  const [newTargetTable, setNewTargetTable] = useState('')

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [s, r] = await Promise.all([
        apiGet<ScraperSitemapItem[]>('/api/scrapers'),
        apiGet<ScrapeRunsResponse>('/api/scrapers/runs?limit=100').catch(() => null),
      ])
      const list = Array.isArray(s) ? s : []
      setSitemaps(
        list.map((sm) => ({
          ...sm,
          targetTable: sm.targetTable ?? null,
        })),
      )
      setAllRuns(Array.isArray(r?.data) ? r.data : [])
    } catch (err) {
      toast({
        title: 'Failed to load scrapers',
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
    if (!newName.trim() || !newUrl.trim()) {
      toast({ title: 'Name and URL required', variant: 'destructive' })
      return
    }
    let parsedSelector: unknown
    try {
      parsedSelector = JSON.parse(newSelectorTree)
    } catch {
      toast({ title: 'Invalid selector tree JSON', variant: 'destructive' })
      return
    }
    try {
      const created = await apiPost<ScraperSitemapItem>('/api/scrapers', {
        name: newName.trim(),
        description: newDesc || null,
        startUrl: newUrl.trim(),
        selectorTree: JSON.stringify(parsedSelector),
        paginationType: newPagination,
        paginationConfig: null,
        outputFormat: 'table',
        isActive: true,
        useStealth: newStealth,
        respectRobotsTxt: true,
        fetchInterval: 3600,
        rateLimitMs: Number(newRateLimit) || 1000,
        concurrency: Number(newConcurrency) || 1,
        maxPages: Number(newMaxPages) || 50,
        targetTableId: newTargetTable || null,
      })
      setSitemaps((prev) => [{ ...created, scrapeRuns: [] }, ...prev])
      setShowCreateDialog(false)
      setNewName('')
      setNewDesc('')
      setNewUrl('')
      setNewPagination('none')
      setNewMaxPages('50')
      setNewRateLimit('1000')
      setNewConcurrency('1')
      setNewStealth(false)
      setNewTargetTable('')
      setNewSelectorTree(JSON.stringify(defaultSelectorTree, null, 2))
      toast({ title: 'Sitemap created', description: `"${created.name}" has been created.` })
    } catch (err) {
      toast({
        title: 'Failed to create sitemap',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  const handleToggleStealth = async (sm: ScraperSitemapItem) => {
    try {
      await apiPut(`/api/scrapers/${sm.id}`, { useStealth: !sm.useStealth })
      setSitemaps((prev) =>
        prev.map((s) => (s.id === sm.id ? { ...s, useStealth: !s.useStealth } : s)),
      )
      if (selectedSitemap?.id === sm.id) {
        setSelectedSitemap((prev) => (prev ? { ...prev, useStealth: !prev.useStealth } : prev))
      }
      toast({ title: `Stealth mode ${sm.useStealth ? 'disabled' : 'enabled'}` })
    } catch (err) {
      toast({
        title: 'Failed to toggle stealth',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  const handleRun = async (sm: ScraperSitemapItem) => {
    setRunningId(sm.id)
    try {
      const result = await apiPost<{ id?: string; status?: string; message?: string; error?: string }>(
        `/api/scrapers/${sm.id}/run`,
        {},
      )
      toast({
        title: 'Scrape triggered',
        description: result.message ?? result.error ?? `Status: ${result.status ?? 'started'}`,
      })
      await loadAll()
    } catch (err) {
      toast({
        title: 'Failed to trigger scrape',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setRunningId(null)
    }
  }

  const handlePreview = async (sm: ScraperSitemapItem) => {
    setPreviewTarget(sm)
    setPreviewResult(null)
    setPreviewLoading(true)
    try {
      const result = await apiPost<PreviewResult>(`/api/scrapers/${sm.id}/preview`, {})
      setPreviewResult(result)
    } catch (err) {
      setPreviewResult({
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleDelete = async (sm: ScraperSitemapItem) => {
    try {
      await apiDelete(`/api/scrapers/${sm.id}`)
      setSitemaps((prev) => prev.filter((s) => s.id !== sm.id))
      if (selectedSitemap?.id === sm.id) setSelectedSitemap(null)
      toast({ title: 'Sitemap deleted', variant: 'destructive' })
    } catch (err) {
      toast({
        title: 'Failed to delete sitemap',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  const filteredSitemaps = sitemaps.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.description ?? '').toLowerCase().includes(search.toLowerCase()) ||
      s.startUrl.toLowerCase().includes(search.toLowerCase()),
  )

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-36" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (selectedSitemap) {
    const runs = selectedSitemap.scrapeRuns ?? allRuns.filter((r) => r.id === selectedSitemap.id)
    const selectorTree = parseJsonField<unknown>(selectedSitemap.selectorTree, {})
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="space-y-6"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => setSelectedSitemap(null)}>
            <ArrowRight className="h-4 w-4 rotate-180" /> Back
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div className="rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 p-2 text-white">
            <Globe className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{selectedSitemap.name}</h1>
          <Badge variant={selectedSitemap.isActive ? 'default' : 'secondary'}>
            {selectedSitemap.isActive ? 'Active' : 'Inactive'}
          </Badge>
          <Badge variant="outline" className={`capitalize ${paginationBadgeColors[selectedSitemap.paginationType]}`}>
            {selectedSitemap.paginationType}
          </Badge>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void handlePreview(selectedSitemap)}>
              <Eye className="mr-1 h-3.5 w-3.5" /> Preview
            </Button>
            <Button
              size="sm"
              onClick={() => void handleRun(selectedSitemap)}
              disabled={runningId === selectedSitemap.id}
            >
              {runningId === selectedSitemap.id ? (
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
              <div className="text-sm text-muted-foreground">Start URL</div>
              <div className="text-sm font-mono truncate">{selectedSitemap.startUrl}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Pagination</div>
              <div className="text-lg font-bold capitalize">{selectedSitemap.paginationType}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Max Pages</div>
              <div className="text-lg font-bold">{selectedSitemap.maxPages}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Target Table</div>
              <div className="text-lg font-bold font-mono">
                {selectedSitemap.targetTable?.name ?? '—'}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Selector Tree</CardTitle>
            <CardDescription>CSS selectors for data extraction (JSON)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md bg-slate-950 text-emerald-400 p-4 overflow-auto max-h-[400px]">
              <pre className="text-sm font-mono whitespace-pre-wrap">
                {JSON.stringify(selectorTree, null, 2)}
              </pre>
            </div>
            <Button variant="outline" size="sm" className="mt-3">
              <Code className="mr-1 h-3.5 w-3.5" /> Edit Selector Tree
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Rate Limiting</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Delay</span>
                <span className="font-mono">{selectedSitemap.rateLimitMs}ms</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Concurrency</span>
                <span>{selectedSitemap.concurrency}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Max Pages</span>
                <span>{selectedSitemap.maxPages}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Output</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Format</span>
                <Badge variant="outline">{selectedSitemap.outputFormat}</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Target</span>
                <span className="font-mono">{selectedSitemap.targetTable?.name ?? '—'}</span>
              </div>
              <div className="flex justify-between text-sm items-center">
                <span className="text-muted-foreground">Stealth mode</span>
                <Switch
                  checked={!!selectedSitemap.useStealth}
                  onCheckedChange={() => void handleToggleStealth(selectedSitemap)}
                />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button size="sm" className="w-full" onClick={() => void handleRun(selectedSitemap)} disabled={runningId === selectedSitemap.id}>
                <Play className="mr-1 h-3.5 w-3.5" /> Run Scrape
              </Button>
              <Button variant="outline" size="sm" className="w-full" onClick={() => void handlePreview(selectedSitemap)}>
                <Eye className="mr-1 h-3.5 w-3.5" /> Preview
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Scrape Run History</CardTitle>
            <CardDescription>Previous scrape executions ({runs.length} total)</CardDescription>
          </CardHeader>
          <CardContent>
            {runs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <FileText className="h-10 w-10 mb-2 opacity-40" />
                <p className="text-sm">No runs yet</p>
                <p className="text-xs mt-1">Click "Run" to trigger a scrape.</p>
              </div>
            ) : (
              <div className="rounded-md border max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Pages</TableHead>
                      <TableHead>Extracted</TableHead>
                      <TableHead>Written</TableHead>
                      <TableHead>Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {runs.slice(0, 30).map((run) => {
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
                          <TableCell className="text-sm font-mono">
                            {run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : '—'}
                          </TableCell>
                          <TableCell className="text-sm">{run.pagesScraped}</TableCell>
                          <TableCell className="text-sm">{run.rowsExtracted.toLocaleString()}</TableCell>
                          <TableCell className="text-sm">{run.rowsWritten.toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {run.isPreview ? 'Preview' : 'Full'}
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
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-emerald-600" />
                Preview: {previewTarget?.name}
              </DialogTitle>
              <DialogDescription>
                Preview scrape — no rows are written to the database.
              </DialogDescription>
            </DialogHeader>
            {previewLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : previewResult ? (
              <div className="space-y-3">
                {previewResult.error ? (
                  <div className="rounded-md bg-red-500/10 border border-red-200 p-3 text-sm text-red-700">
                    {previewResult.error}
                  </div>
                ) : (
                  <div className="rounded-md bg-emerald-500/10 border border-emerald-200 p-3 text-sm text-emerald-700">
                    {previewResult.message ?? `Status: ${previewResult.status ?? 'OK'}`}
                  </div>
                )}
                {previewResult.rows && previewResult.rows.length > 0 && (
                  <div className="rounded-md border max-h-[50vh] overflow-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background">
                        <TableRow>
                          {Object.keys(previewResult.rows[0]).map((k) => (
                            <TableHead key={k} className="font-mono text-xs">
                              {k}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewResult.rows.map((row, i) => (
                          <TableRow key={i}>
                            {Object.values(row).map((v, j) => (
                              <TableCell key={j} className="font-mono text-xs">
                                {v != null ? String(v).slice(0, 80) : '—'}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
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
            Web Scraper
          </h1>
          <p className="text-muted-foreground">Manage sitemaps and web scraping configurations</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-1 h-4 w-4" /> New Sitemap
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Sitemap</DialogTitle>
              <DialogDescription>Configure a new web scraper</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2 max-h-[65vh] overflow-y-auto">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="My Scraper" />
                </div>
                <div className="space-y-2">
                  <Label>Pagination</Label>
                  <Select value={newPagination} onValueChange={(v) => setNewPagination(v as typeof newPagination)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="click">Click-based</SelectItem>
                      <SelectItem value="scroll">Infinite Scroll</SelectItem>
                      <SelectItem value="url_pattern">URL Pattern</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="What does this scraper collect?" />
              </div>
              <div className="space-y-2">
                <Label>Start URL</Label>
                <Input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://example.com/page" />
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Max Pages</Label>
                  <Input type="number" value={newMaxPages} onChange={(e) => setNewMaxPages(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Rate Limit (ms)</Label>
                  <Input type="number" value={newRateLimit} onChange={(e) => setNewRateLimit(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Concurrency</Label>
                  <Input type="number" value={newConcurrency} onChange={(e) => setNewConcurrency(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Selector Tree (JSON)</Label>
                <Textarea
                  value={newSelectorTree}
                  onChange={(e) => setNewSelectorTree(e.target.value)}
                  className="font-mono text-xs bg-slate-950 text-emerald-400"
                  rows={8}
                />
                <p className="text-xs text-muted-foreground">
                  Define <code>container</code> and <code>fields</code> with CSS selectors. Use
                  <code> @attr</code> suffix to extract attributes (e.g. <code>img@src</code>).
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-md border p-3">
                <Shield className="h-4 w-4 text-emerald-600" />
                <div className="flex-1">
                  <Label className="cursor-pointer">Stealth mode</Label>
                  <p className="text-xs text-muted-foreground">Use stealth plugins to avoid bot detection.</p>
                </div>
                <Switch checked={newStealth} onCheckedChange={setNewStealth} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate}>Create Sitemap</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Total Sitemaps</div>
            <div className="text-2xl font-bold">{sitemaps.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Active</div>
            <div className="text-2xl font-bold text-emerald-600">
              {sitemaps.filter((s) => s.isActive).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Total Runs</div>
            <div className="text-2xl font-bold">{allRuns.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Rows Extracted</div>
            <div className="text-2xl font-bold">
              {allRuns.reduce((s, r) => s + r.rowsExtracted, 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search sitemaps..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadAll()}>
          <RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      <div className="space-y-4">
        {filteredSitemaps.length === 0 ? (
          <Card>
            <CardContent className="py-16 flex flex-col items-center justify-center text-muted-foreground">
              <Globe className="h-14 w-14 mb-3 opacity-30" />
              <p className="text-base font-medium">No sitemaps yet</p>
              <p className="text-sm mt-1">Create a sitemap to start scraping web pages.</p>
              <Button className="mt-4" onClick={() => setShowCreateDialog(true)}>
                <Plus className="mr-1 h-4 w-4" /> New Sitemap
              </Button>
            </CardContent>
          </Card>
        ) : (
          filteredSitemaps.map((sitemap) => {
            const lastRun = sitemap.scrapeRuns?.[0] ?? allRuns.find((r) => r.id === sitemap.id)
            return (
              <Card
                key={sitemap.id}
                className="cursor-pointer hover:shadow-md hover:border-emerald-200 transition-all"
                onClick={() => setSelectedSitemap(sitemap)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between flex-wrap gap-2">
                    <div className="flex items-start gap-3">
                      <div className="rounded-md bg-gradient-to-br from-emerald-500/10 to-teal-500/10 p-2">
                        <Layers className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold">{sitemap.name}</h3>
                          <Badge variant={sitemap.isActive ? 'default' : 'secondary'} className="text-xs">
                            {sitemap.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`text-xs capitalize ${paginationBadgeColors[sitemap.paginationType]}`}
                          >
                            {sitemap.paginationType}
                          </Badge>
                          {sitemap.useStealth && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="outline" className="text-xs gap-1 bg-purple-500/10 text-purple-700">
                                  <Shield className="h-2.5 w-2.5" /> Stealth
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>Stealth mode enabled</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">{sitemap.description}</p>
                        <p className="text-xs font-mono text-muted-foreground mt-1">{sitemap.startUrl}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          void handlePreview(sitemap)
                        }}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" /> Preview
                      </Button>
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          void handleRun(sitemap)
                        }}
                        disabled={runningId === sitemap.id}
                      >
                        {runningId === sitemap.id ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                        ) : (
                          <Play className="h-3.5 w-3.5 mr-1" />
                        )}
                        Run
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                            <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              void handleToggleStealth(sitemap)
                            }}
                          >
                            <Shield className="mr-2 h-3.5 w-3.5" />
                            {sitemap.useStealth ? 'Disable' : 'Enable'} Stealth
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={(e) => {
                              e.stopPropagation()
                              void handleDelete(sitemap)
                            }}
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  {lastRun && (
                    <div className="mt-3 flex items-center gap-4 text-sm border-t pt-3 flex-wrap">
                      <div className="flex items-center gap-1">
                        {(() => {
                          const Icon = statusIcons[lastRun.status]
                          return <Icon className={`h-3.5 w-3.5 ${statusColors[lastRun.status]}`} />
                        })()}
                        <span className={`capitalize font-medium ${statusColors[lastRun.status]}`}>
                          {lastRun.status}
                        </span>
                      </div>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">{lastRun.pagesScraped} pages</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">
                        {lastRun.rowsExtracted.toLocaleString()} extracted
                      </span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">
                        {lastRun.durationMs ? `${(lastRun.durationMs / 1000).toFixed(1)}s` : 'Running...'}
                      </span>
                      <span className="text-muted-foreground ml-auto">
                        {new Date(lastRun.startedAt).toLocaleString()}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </motion.div>
  )
}
