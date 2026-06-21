'use client'

import { useState, useEffect } from 'react'
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
import { useToast } from '@/hooks/use-toast'

interface ScraperSitemapItem {
  id: string
  name: string
  description: string | null
  startUrl: string
  selectorTree: Record<string, unknown>
  paginationType: 'none' | 'click' | 'scroll' | 'url_pattern'
  isActive: boolean
  targetTableName: string | null
  outputFormat: string
  maxPages: number
  concurrency: number
  rateLimitMs: number
  createdAt: string
  runs: ScrapeRunItem[]
}

interface ScrapeRunItem {
  id: string
  status: 'pending' | 'running' | 'success' | 'failed'
  startedAt: string
  completedAt: string | null
  durationMs: number | null
  pagesScraped: number
  rowsExtracted: number
  rowsWritten: number
  isPreview: boolean
}

const mockSitemaps: ScraperSitemapItem[] = [
  {
    id: '1', name: 'Product Catalog Scraper', description: 'Scrape product details from e-commerce sites',
    startUrl: 'https://shop.example.com/products', selectorTree: {
      container: '.product-card',
      fields: { title: 'h2.product-title', price: '.price-tag', image: 'img.product-img@src' },
    },
    paginationType: 'click', isActive: true, targetTableName: 'products', outputFormat: 'table',
    maxPages: 50, concurrency: 2, rateLimitMs: 1000, createdAt: '2025-04-10',
    runs: [
      { id: 'sr1', status: 'success', startedAt: '2025-06-21T08:00:00Z', completedAt: '2025-06-21T08:12:30Z', durationMs: 750000, pagesScraped: 48, rowsExtracted: 960, rowsWritten: 955, isPreview: false },
      { id: 'sr2', status: 'success', startedAt: '2025-06-20T08:00:00Z', completedAt: '2025-06-20T08:10:15Z', durationMs: 615000, pagesScraped: 45, rowsExtracted: 900, rowsWritten: 897, isPreview: false },
    ],
  },
  {
    id: '2', name: 'News Article Scraper', description: 'Scrape news articles for RAG processing',
    startUrl: 'https://news.example.com/latest', selectorTree: {
      container: 'article.news-item',
      fields: { title: 'h1.headline', content: '.article-body', date: 'time@datetime' },
    },
    paginationType: 'scroll', isActive: true, targetTableName: 'articles', outputFormat: 'table',
    maxPages: 20, concurrency: 1, rateLimitMs: 2000, createdAt: '2025-05-01',
    runs: [
      { id: 'sr3', status: 'failed', startedAt: '2025-06-21T06:00:00Z', completedAt: '2025-06-21T06:03:00Z', durationMs: 180000, pagesScraped: 3, rowsExtracted: 12, rowsWritten: 0, isPreview: false },
    ],
  },
  {
    id: '3', name: 'Documentation Scraper', description: 'Scrape API documentation pages',
    startUrl: 'https://docs.example.com/api', selectorTree: {
      container: '.doc-section',
      fields: { title: 'h2', content: '.doc-content', endpoint: 'code.endpoint' },
    },
    paginationType: 'none', isActive: false, targetTableName: 'docs', outputFormat: 'json',
    maxPages: 100, concurrency: 1, rateLimitMs: 500, createdAt: '2025-06-01',
    runs: [],
  },
]

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

export function ScraperView() {
  const { toast } = useToast()
  const [sitemaps, setSitemaps] = useState<ScraperSitemapItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newName, setNewName] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [newPagination, setNewPagination] = useState<'none' | 'click' | 'scroll' | 'url_pattern'>('none')
  const [selectedSitemap, setSelectedSitemap] = useState<ScraperSitemapItem | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => { setSitemaps(mockSitemaps); setLoading(false) }, 600)
    return () => clearTimeout(timer)
  }, [])

  const handleCreate = () => {
    if (!newName.trim() || !newUrl.trim()) return
    const newSitemap: ScraperSitemapItem = {
      id: String(Date.now()), name: newName, description: null, startUrl: newUrl,
      selectorTree: { container: '', fields: {} }, paginationType: newPagination,
      isActive: false, targetTableName: null, outputFormat: 'table',
      maxPages: 50, concurrency: 1, rateLimitMs: 1000, createdAt: new Date().toISOString(), runs: [],
    }
    setSitemaps((prev) => [...prev, newSitemap])
    setShowCreateDialog(false); setNewName(''); setNewUrl('')
    toast({ title: 'Sitemap created', description: `"${newName}" has been created.` })
  }

  const handleRun = (id: string) => {
    toast({ title: 'Scrape triggered', description: 'The scrape run has been started.' })
  }

  const handlePreview = (id: string) => {
    toast({ title: 'Preview started', description: 'Running a preview scrape...' })
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between"><Skeleton className="h-8 w-48" /><Skeleton className="h-9 w-36" /></div>
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}><CardContent className="p-4"><Skeleton className="h-32 w-full" /></CardContent></Card>
        ))}
      </div>
    )
  }

  if (selectedSitemap) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setSelectedSitemap(null)}>
            <ArrowRight className="h-4 w-4 rotate-180" /> Back
          </Button>
          <Separator className="h-6 w-px bg-border" />
          <Globe className="h-5 w-5 text-emerald-500" />
          <h1 className="text-2xl font-bold tracking-tight">{selectedSitemap.name}</h1>
          <Badge variant={selectedSitemap.isActive ? 'default' : 'secondary'}>
            {selectedSitemap.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card><CardContent className="pt-4"><div className="text-sm text-muted-foreground">Start URL</div><div className="text-sm font-mono truncate">{selectedSitemap.startUrl}</div></CardContent></Card>
          <Card><CardContent className="pt-4"><div className="text-sm text-muted-foreground">Pagination</div><div className="text-lg font-bold capitalize">{selectedSitemap.paginationType}</div></CardContent></Card>
          <Card><CardContent className="pt-4"><div className="text-sm text-muted-foreground">Max Pages</div><div className="text-lg font-bold">{selectedSitemap.maxPages}</div></CardContent></Card>
          <Card><CardContent className="pt-4"><div className="text-sm text-muted-foreground">Target Table</div><div className="text-lg font-bold font-mono">{selectedSitemap.targetTableName ?? '—'}</div></CardContent></Card>
        </div>

        {/* Selector Tree */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Selector Tree</CardTitle>
            <CardDescription>CSS selectors for data extraction</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md bg-muted/50 p-4">
              <pre className="text-sm font-mono whitespace-pre-wrap">{JSON.stringify(selectedSitemap.selectorTree, null, 2)}</pre>
            </div>
            <Button variant="outline" size="sm" className="mt-3">
              <Code className="mr-1 h-3.5 w-3.5" /> Edit Selector Tree
            </Button>
          </CardContent>
        </Card>

        {/* Config Details */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader><CardTitle className="text-base">Rate Limiting</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Delay between requests</span><span className="font-mono">{selectedSitemap.rateLimitMs}ms</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Concurrency</span><span>{selectedSitemap.concurrency}</span></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Output</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Format</span><Badge variant="outline">{selectedSitemap.outputFormat}</Badge></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Target</span><span className="font-mono">{selectedSitemap.targetTableName ?? '—'}</span></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Actions</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Button size="sm" className="w-full" onClick={() => handleRun(selectedSitemap.id)}><Play className="mr-1 h-3.5 w-3.5" />Run Scrape</Button>
              <Button variant="outline" size="sm" className="w-full" onClick={() => handlePreview(selectedSitemap.id)}><Eye className="mr-1 h-3.5 w-3.5" />Preview</Button>
            </CardContent>
          </Card>
        </div>

        {/* Run History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Scrape Run History</CardTitle>
            <CardDescription>Previous scrape executions</CardDescription>
          </CardHeader>
          <CardContent>
            {selectedSitemap.runs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <FileText className="h-10 w-10 mb-2 opacity-40" />
                <p className="text-sm">No runs yet</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
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
                  {selectedSitemap.runs.map((run) => {
                    const RunIcon = statusIcons[run.status]
                    return (
                      <TableRow key={run.id}>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <RunIcon className={`h-3.5 w-3.5 ${statusColors[run.status]}`} />
                            <span className={`text-sm capitalize font-medium ${statusColors[run.status]}`}>{run.status}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{new Date(run.startedAt).toLocaleString()}</TableCell>
                        <TableCell className="text-sm font-mono">{run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : '—'}</TableCell>
                        <TableCell className="text-sm">{run.pagesScraped}</TableCell>
                        <TableCell className="text-sm">{run.rowsExtracted.toLocaleString()}</TableCell>
                        <TableCell className="text-sm">{run.rowsWritten.toLocaleString()}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{run.isPreview ? 'Preview' : 'Full'}</Badge></TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Web Scraper</h1>
          <p className="text-muted-foreground">Manage sitemaps and web scraping configurations</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" />New Sitemap</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Sitemap</DialogTitle><DialogDescription>Configure a new web scraper</DialogDescription></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2"><Label>Name</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="My Scraper" /></div>
              <div className="space-y-2"><Label>Start URL</Label><Input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://example.com/page" /></div>
              <div className="space-y-2"><Label>Pagination</Label>
                <Select value={newPagination} onValueChange={(v) => setNewPagination(v as typeof newPagination)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="click">Click-based</SelectItem>
                    <SelectItem value="scroll">Infinite Scroll</SelectItem>
                    <SelectItem value="url_pattern">URL Pattern</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
              <Button onClick={handleCreate}>Create Sitemap</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="pt-4"><div className="text-sm text-muted-foreground">Total Sitemaps</div><div className="text-2xl font-bold">{sitemaps.length}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-sm text-muted-foreground">Active</div><div className="text-2xl font-bold text-emerald-600">{sitemaps.filter(s => s.isActive).length}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-sm text-muted-foreground">Total Runs</div><div className="text-2xl font-bold">{sitemaps.reduce((s, sm) => s + sm.runs.length, 0)}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-sm text-muted-foreground">Total Rows Extracted</div><div className="text-2xl font-bold">{sitemaps.reduce((s, sm) => s + sm.runs.reduce((rs, r) => rs + r.rowsExtracted, 0), 0).toLocaleString()}</div></CardContent></Card>
      </div>

      {/* Sitemap Cards */}
      <div className="space-y-4">
        {sitemaps.map((sitemap) => {
          const lastRun = sitemap.runs[0]
          return (
            <Card key={sitemap.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedSitemap(sitemap)}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="rounded-md bg-emerald-500/10 p-2"><Layers className="h-5 w-5 text-emerald-600" /></div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{sitemap.name}</h3>
                        <Badge variant={sitemap.isActive ? 'default' : 'secondary'} className="text-xs">
                          {sitemap.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                        <Badge variant="outline" className="text-xs capitalize">{sitemap.paginationType}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">{sitemap.description}</p>
                      <p className="text-xs font-mono text-muted-foreground mt-1">{sitemap.startUrl}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handlePreview(sitemap.id) }}><Eye className="h-3.5 w-3.5 mr-1" />Preview</Button>
                    <Button size="sm" onClick={(e) => { e.stopPropagation(); handleRun(sitemap.id) }}><Play className="h-3.5 w-3.5 mr-1" />Run</Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => e.stopPropagation()}><Pencil className="mr-2 h-3.5 w-3.5" />Edit</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={(e) => e.stopPropagation()}><Trash2 className="mr-2 h-3.5 w-3.5" />Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                {lastRun && (
                  <div className="mt-3 flex items-center gap-4 text-sm border-t pt-3">
                    <div className="flex items-center gap-1">
                      {(() => { const Icon = statusIcons[lastRun.status]; return <Icon className={`h-3.5 w-3.5 ${statusColors[lastRun.status]}`} /> })()}
                      <span className={`capitalize font-medium ${statusColors[lastRun.status]}`}>{lastRun.status}</span>
                    </div>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">{lastRun.pagesScraped} pages</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">{lastRun.rowsExtracted.toLocaleString()} extracted</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">{lastRun.durationMs ? `${(lastRun.durationMs / 1000).toFixed(1)}s` : 'Running...'}</span>
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

function Separator({ className }: { className?: string }) {
  return <div className={`bg-border ${className ?? 'h-px w-full'}`} />
}
