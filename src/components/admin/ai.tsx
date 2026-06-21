'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  Brain,
  Plus,
  Send,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  MessageSquare,
  Database,
  Cpu,
  Sparkles,
  CheckCircle2,
  XCircle,
  Clock,
  Globe,
  RefreshCw,
  Zap,
  Loader2,
  Wand2,
  DollarSign,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useToast } from '@/hooks/use-toast'
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api-client'

interface LlmConfigItem {
  id: string
  provider: string
  name: string
  baseUrl: string | null
  apiKey?: string | null
  modelName: string
  isActive: boolean
  maxTokens: number
  temperature: number
  costPer1kInput: number | null
  costPer1kOutput: number | null
  createdAt: string
}

interface LlmCallItem {
  id: string
  configId: string
  model: string
  promptTokens: number | null
  completionTokens: number | null
  totalTokens: number | null
  latencyMs: number | null
  cost: number | null
  status: string
  errorPayload: string | null
  createdAt: string
  config?: { id: string; name: string; provider: string; modelName: string }
}

interface SbTableItem {
  id: string
  name: string
  displayName: string | null
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  status?: 'pending' | 'completed' | 'failed'
  meta?: { durationMs?: number; sources?: number }
}

interface SearchResult {
  rowId: string
  tableId: string
  score: number
  textContent: string | null
  rowData: Record<string, unknown> | null
  model: string
}

interface RagResponse {
  status?: string
  query?: string
  results?: unknown[]
  response?: string
  error?: string
}

const providerIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  openai: Brain,
  anthropic: Cpu,
  ollama: Database,
  custom: Globe,
}

const providerColors: Record<string, string> = {
  openai: '#10b981',
  anthropic: '#14b8a6',
  ollama: '#f59e0b',
  custom: '#8b5cf6',
}

const PIE_COLORS = ['#10b981', '#14b8a6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4']

export function AiView() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [llmConfigs, setLlmConfigs] = useState<LlmConfigItem[]>([])
  const [llmCalls, setLlmCalls] = useState<LlmCallItem[]>([])
  const [tables, setTables] = useState<SbTableItem[]>([])
  const [showConfigDialog, setShowConfigDialog] = useState(false)
  const [editTarget, setEditTarget] = useState<LlmConfigItem | null>(null)

  // Config form
  const [cfgName, setCfgName] = useState('')
  const [cfgProvider, setCfgProvider] = useState('openai')
  const [cfgModel, setCfgModel] = useState('')
  const [cfgBaseUrl, setCfgBaseUrl] = useState('')
  const [cfgApiKey, setCfgApiKey] = useState('')
  const [cfgMaxTokens, setCfgMaxTokens] = useState('4096')
  const [cfgTemperature, setCfgTemperature] = useState('0.7')
  const [cfgCostInput, setCfgCostInput] = useState('')
  const [cfgCostOutput, setCfgCostOutput] = useState('')

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatTable, setChatTable] = useState('')
  const [chatModel, setChatModel] = useState('')
  const [chatSending, setChatSending] = useState(false)
  const chatScrollRef = useRef<HTMLDivElement>(null)

  // Search
  const [searchQuery, setSearchQuery] = useState('')
  const [searchTable, setSearchTable] = useState('')
  const [searchLimit, setSearchLimit] = useState('10')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  // Embed
  const [embedText, setEmbedText] = useState('')
  const [embedTable, setEmbedTable] = useState('')
  const [embedRowId, setEmbedRowId] = useState('')
  const [embedding, setEmbedding] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [cfgs, callsResp, tbls] = await Promise.all([
        apiGet<LlmConfigItem[]>('/api/ai/llm-config'),
        apiGet<{ calls?: LlmCallItem[]; pagination?: unknown }>('/api/ai/calls?limit=100').catch(() => ({ calls: [] })),
        apiGet<SbTableItem[]>('/api/tables').catch(() => []),
      ])
      setLlmConfigs(Array.isArray(cfgs) ? cfgs : [])
      setLlmCalls(Array.isArray(callsResp?.calls) ? callsResp.calls : [])
      setTables(Array.isArray(tbls) ? tbls : [])
    } catch (err) {
      toast({
        title: 'Failed to load AI data',
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

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
    }
  }, [chatMessages])

  const openEditDialog = (config: LlmConfigItem | null) => {
    setEditTarget(config)
    if (config) {
      setCfgName(config.name)
      setCfgProvider(config.provider)
      setCfgModel(config.modelName)
      setCfgBaseUrl(config.baseUrl ?? '')
      setCfgApiKey('')
      setCfgMaxTokens(String(config.maxTokens))
      setCfgTemperature(String(config.temperature))
      setCfgCostInput(config.costPer1kInput?.toString() ?? '')
      setCfgCostOutput(config.costPer1kOutput?.toString() ?? '')
    } else {
      setCfgName('')
      setCfgProvider('openai')
      setCfgModel('')
      setCfgBaseUrl('')
      setCfgApiKey('')
      setCfgMaxTokens('4096')
      setCfgTemperature('0.7')
      setCfgCostInput('')
      setCfgCostOutput('')
    }
    setShowConfigDialog(true)
  }

  const handleSaveConfig = async () => {
    if (!cfgName.trim() || !cfgModel.trim()) {
      toast({ title: 'Name and model required', variant: 'destructive' })
      return
    }
    const payload: Record<string, unknown> = {
      provider: cfgProvider,
      name: cfgName.trim(),
      modelName: cfgModel.trim(),
      baseUrl: cfgBaseUrl || null,
      maxTokens: Number(cfgMaxTokens) || 4096,
      temperature: Number(cfgTemperature) || 0.7,
      costPer1kInput: cfgCostInput ? Number(cfgCostInput) : null,
      costPer1kOutput: cfgCostOutput ? Number(cfgCostOutput) : null,
    }
    if (cfgApiKey) payload.apiKey = cfgApiKey
    try {
      if (editTarget) {
        const updated = await apiPut<LlmConfigItem>(`/api/ai/llm-config/${editTarget.id}`, payload)
        setLlmConfigs((prev) => prev.map((c) => (c.id === editTarget.id ? { ...c, ...updated } : c)))
        toast({ title: 'Provider updated' })
      } else {
        const created = await apiPost<LlmConfigItem>('/api/ai/llm-config', { ...payload, isActive: true })
        setLlmConfigs((prev) => [created, ...prev])
        toast({ title: 'Provider added' })
      }
      setShowConfigDialog(false)
    } catch (err) {
      toast({
        title: 'Failed to save provider',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  const handleToggleActive = async (config: LlmConfigItem) => {
    try {
      const updated = await apiPut<LlmConfigItem>(`/api/ai/llm-config/${config.id}`, {
        isActive: !config.isActive,
      })
      setLlmConfigs((prev) => prev.map((c) => (c.id === config.id ? { ...c, ...updated } : c)))
      toast({ title: `Provider ${updated.isActive ? 'activated' : 'deactivated'}` })
    } catch (err) {
      toast({
        title: 'Failed to toggle provider',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  const handleDeleteConfig = async (config: LlmConfigItem) => {
    try {
      await apiDelete(`/api/ai/llm-config/${config.id}`)
      setLlmConfigs((prev) => prev.filter((c) => c.id !== config.id))
      toast({ title: 'Provider deleted', variant: 'destructive' })
    } catch (err) {
      toast({
        title: 'Failed to delete provider',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  const handleTestConnection = async (config: LlmConfigItem) => {
    toast({ title: `Testing connection to ${config.name}...` })
    try {
      const result = await apiPost<{ status?: string; response?: string; error?: string }>('/api/ai/chat', {
        configId: config.id,
        messages: [{ role: 'user', content: 'Reply with just "OK" if you receive this.' }],
      })
      if (result.error) {
        toast({ title: 'Connection failed', description: result.error, variant: 'destructive' })
      } else {
        toast({
          title: 'Connection successful',
          description: `Response: ${result.response?.slice(0, 100) ?? 'OK'}`,
        })
      }
    } catch (err) {
      toast({
        title: 'Connection test failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  const handleChat = async () => {
    if (!chatInput.trim() || !chatTable) {
      toast({ title: 'Select a table and enter a query', variant: 'destructive' })
      return
    }
    const userMsg: ChatMessage = { role: 'user', content: chatInput }
    const pendingMsg: ChatMessage = { role: 'assistant', content: '', status: 'pending' }
    setChatMessages((prev) => [...prev, userMsg, pendingMsg])
    setChatSending(true)
    const query = chatInput
    setChatInput('')
    try {
      const result = await apiPost<RagResponse>('/api/ai/rag', {
        table: chatTable,
        query,
        model: chatModel || undefined,
        prompt: 'You are a helpful assistant answering questions about the user\'s data.',
      })
      setChatMessages((prev) =>
        prev.map((m, i) =>
          i === prev.length - 1
            ? {
                role: 'assistant',
                content: result.response ?? result.error ?? 'No response received.',
                status: result.error ? 'failed' : 'completed',
                meta: { sources: Array.isArray(result.results) ? result.results.length : 0 },
              }
            : m,
        ),
      )
    } catch (err) {
      setChatMessages((prev) =>
        prev.map((m, i) =>
          i === prev.length - 1
            ? {
                role: 'assistant',
                content: `Failed to get response: ${err instanceof Error ? err.message : 'Unknown error'}`,
                status: 'failed',
              }
            : m,
        ),
      )
    } finally {
      setChatSending(false)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast({ title: 'Enter a search query', variant: 'destructive' })
      return
    }
    setSearchLoading(true)
    setSearchResults([])
    try {
      const result = await apiPost<{ query: string; totalCandidates: number; results: SearchResult[] }>(
        '/api/ai/search',
        {
          query: searchQuery,
          tableId: searchTable || undefined,
          topK: Number(searchLimit) || 10,
          threshold: 0.3,
        },
      )
      setSearchResults(result.results ?? [])
      toast({
        title: 'Search complete',
        description: `${result.results?.length ?? 0} results from ${result.totalCandidates ?? 0} candidates.`,
      })
    } catch (err) {
      toast({
        title: 'Search failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setSearchLoading(false)
    }
  }

  const handleEmbed = async () => {
    if (!embedText.trim() || !embedTable) {
      toast({ title: 'Table and text required', variant: 'destructive' })
      return
    }
    setEmbedding(true)
    try {
      await apiPost('/api/ai/embed', {
        text: embedText,
        table: embedTable,
        rowId: embedRowId || undefined,
      })
      toast({ title: 'Embedding queued', description: 'Embedding generation has been started.' })
      setEmbedText('')
      setEmbedRowId('')
    } catch (err) {
      toast({
        title: 'Embed failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setEmbedding(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  // Cost breakdown chart data
  const costByProvider = llmConfigs
    .map((c) => {
      const calls = llmCalls.filter((cl) => cl.configId === c.id)
      const totalCost = calls.reduce((s, cl) => s + (cl.cost ?? 0), 0)
      const totalTokens = calls.reduce((s, cl) => s + (cl.totalTokens ?? 0), 0)
      return {
        name: c.name,
        provider: c.provider,
        cost: Number(totalCost.toFixed(4)),
        tokens: totalTokens,
        calls: calls.length,
      }
    })
    .filter((d) => d.calls > 0)

  const totalCalls = llmCalls.length
  const totalTokens = llmCalls.reduce((s, c) => s + (c.totalTokens ?? 0), 0)
  const totalCost = llmCalls.reduce((s, c) => s + (c.cost ?? 0), 0)

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
            AI
          </h1>
          <p className="text-muted-foreground">LLM providers, embeddings, semantic search, and RAG</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadAll()}>
          <RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      <Tabs defaultValue="providers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="providers" className="gap-1.5">
            <Brain className="h-3.5 w-3.5" /> Providers
          </TabsTrigger>
          <TabsTrigger value="embeddings" className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Embeddings
          </TabsTrigger>
          <TabsTrigger value="search" className="gap-1.5">
            <Search className="h-3.5 w-3.5" /> Search
          </TabsTrigger>
          <TabsTrigger value="rag" className="gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" /> RAG
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <Clock className="h-3.5 w-3.5" /> History
          </TabsTrigger>
        </TabsList>

        {/* Providers Tab */}
        <TabsContent value="providers" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-muted-foreground">Active Providers</div>
                    <div className="text-2xl font-bold">
                      {llmConfigs.filter((c) => c.isActive).length}
                    </div>
                  </div>
                  <div className="rounded-md bg-emerald-500/10 p-2">
                    <Brain className="h-5 w-5 text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-muted-foreground">Total Calls</div>
                    <div className="text-2xl font-bold">{totalCalls.toLocaleString()}</div>
                  </div>
                  <div className="rounded-md bg-teal-500/10 p-2">
                    <Zap className="h-5 w-5 text-teal-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-muted-foreground">Total Tokens</div>
                    <div className="text-2xl font-bold">{(totalTokens / 1000).toFixed(1)}K</div>
                  </div>
                  <div className="rounded-md bg-amber-500/10 p-2">
                    <Cpu className="h-5 w-5 text-amber-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-muted-foreground">Total Cost</div>
                    <div className="text-2xl font-bold">${totalCost.toFixed(4)}</div>
                  </div>
                  <div className="rounded-md bg-emerald-500/10 p-2">
                    <DollarSign className="h-5 w-5 text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Configured LLM providers</p>
            <Button onClick={() => openEditDialog(null)}>
              <Plus className="mr-1 h-4 w-4" /> Add Provider
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {llmConfigs.length === 0 ? (
              <Card className="md:col-span-2">
                <CardContent className="py-16 flex flex-col items-center justify-center text-muted-foreground">
                  <Brain className="h-14 w-14 mb-3 opacity-30" />
                  <p className="text-base font-medium">No LLM providers configured</p>
                  <p className="text-sm mt-1">Add an OpenAI, Anthropic, Ollama, or custom provider to get started.</p>
                  <Button className="mt-4" onClick={() => openEditDialog(null)}>
                    <Plus className="mr-1 h-4 w-4" /> Add Provider
                  </Button>
                </CardContent>
              </Card>
            ) : (
              llmConfigs.map((config) => {
                const ProviderIcon = providerIcons[config.provider] ?? Globe
                const callCount = llmCalls.filter((c) => c.configId === config.id).length
                const tokenCount = llmCalls
                  .filter((c) => c.configId === config.id)
                  .reduce((s, c) => s + (c.totalTokens ?? 0), 0)
                return (
                  <Card
                    key={config.id}
                    className="hover:shadow-md hover:border-emerald-200 transition-all"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="rounded-md p-2"
                            style={{ backgroundColor: `${providerColors[config.provider] ?? '#10b981'}20` }}
                          >
                            <ProviderIcon
                              className="h-4 w-4"
                              style={{ color: providerColors[config.provider] ?? '#10b981' }}
                            />
                          </div>
                          <div>
                            <div className="font-semibold">{config.name}</div>
                            <div className="text-xs text-muted-foreground font-mono">{config.modelName}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={config.isActive}
                            onCheckedChange={() => void handleToggleActive(config)}
                          />
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => void handleTestConnection(config)}>
                                <Zap className="mr-2 h-3.5 w-3.5" /> Test Connection
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEditDialog(config)}>
                                <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => void handleDeleteConfig(config)}
                              >
                                <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center mb-3">
                        <div className="rounded-md bg-muted/50 p-2">
                          <div className="text-xs text-muted-foreground">Calls</div>
                          <div className="text-sm font-bold">{callCount.toLocaleString()}</div>
                        </div>
                        <div className="rounded-md bg-muted/50 p-2">
                          <div className="text-xs text-muted-foreground">Tokens</div>
                          <div className="text-sm font-bold">{(tokenCount / 1000).toFixed(1)}K</div>
                        </div>
                        <div className="rounded-md bg-muted/50 p-2">
                          <div className="text-xs text-muted-foreground">Temp</div>
                          <div className="text-sm font-bold">{config.temperature}</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <Badge variant={config.isActive ? 'default' : 'secondary'} className="text-xs">
                          {config.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                        {config.baseUrl && (
                          <span className="font-mono text-muted-foreground truncate ml-2 max-w-[200px]">
                            {config.baseUrl}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>

          {/* Cost Breakdown Chart */}
          {costByProvider.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cost Breakdown by Provider</CardTitle>
                <CardDescription>Distribution of LLM spending across providers</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 items-center">
                  <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={costByProvider}
                          dataKey="cost"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={90}
                          label={(entry) => `$${Number(entry.cost).toFixed(4)}`}
                        >
                          {costByProvider.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <RTooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--popover))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            fontSize: '12px',
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={costByProvider}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <RTooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--popover))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            fontSize: '12px',
                          }}
                        />
                        <Bar dataKey="tokens" fill="#14b8a6" radius={[4, 4, 0, 0]} name="Tokens" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Embeddings Tab */}
        <TabsContent value="embeddings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Generate Embeddings</CardTitle>
              <CardDescription>Embed text into a table for semantic search</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Target Table</Label>
                  <Select value={embedTable} onValueChange={setEmbedTable}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select table" />
                    </SelectTrigger>
                    <SelectContent>
                      {tables.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.displayName || t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Row ID (optional)</Label>
                  <Input
                    value={embedRowId}
                    onChange={(e) => setEmbedRowId(e.target.value)}
                    placeholder="cuid..."
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Text to embed</Label>
                <Textarea
                  value={embedText}
                  onChange={(e) => setEmbedText(e.target.value)}
                  rows={5}
                  placeholder="Paste or type the text you want to embed..."
                />
              </div>
              <Button onClick={() => void handleEmbed()} disabled={embedding}>
                {embedding ? (
                  <>
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Embedding...
                  </>
                ) : (
                  <>
                    <Wand2 className="mr-1 h-4 w-4" /> Generate Embedding
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Semantic Search Tab */}
        <TabsContent value="search" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Semantic Search</CardTitle>
              <CardDescription>Search across your embedded data using natural language</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search across your data..."
                    className="pl-9 h-10"
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                </div>
                <Select value={searchTable} onValueChange={setSearchTable}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="All tables" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Tables</SelectItem>
                    {tables.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.displayName || t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={searchLimit} onValueChange={setSearchLimit}>
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">Top 5</SelectItem>
                    <SelectItem value="10">Top 10</SelectItem>
                    <SelectItem value="20">Top 20</SelectItem>
                    <SelectItem value="50">Top 50</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={() => void handleSearch()} disabled={searchLoading}>
                  {searchLoading ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="mr-1 h-4 w-4" />
                  )}
                  Search
                </Button>
              </div>

              {searchResults.length === 0 && !searchLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Search className="h-12 w-12 mb-3 opacity-30" />
                  <p className="text-sm">Enter a query to search your embedded data</p>
                  <p className="text-xs mt-1">Results will appear here with similarity scores</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {searchResults.map((res) => (
                    <div
                      key={res.rowId}
                      className="rounded-lg border p-3 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant="outline" className="text-xs">
                          Score: {(res.score * 100).toFixed(1)}%
                        </Badge>
                        <span className="text-xs text-muted-foreground font-mono">
                          {res.model}
                        </span>
                      </div>
                      {res.textContent && (
                        <p className="text-sm line-clamp-2 mb-1">{res.textContent}</p>
                      )}
                      {res.rowData && (
                        <pre className="text-xs font-mono text-muted-foreground bg-muted/40 rounded p-2 max-h-32 overflow-auto">
                          {JSON.stringify(res.rowData, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* RAG Tab */}
        <TabsContent value="rag" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2 flex flex-col">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-emerald-600" />
                  RAG Chat
                </CardTitle>
                <CardDescription>Ask questions about your data</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <div
                  ref={chatScrollRef}
                  className="flex-1 min-h-[300px] max-h-[460px] overflow-y-auto space-y-3 mb-4 pr-2"
                >
                  {chatMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <MessageSquare className="h-10 w-10 mb-2 opacity-30" />
                      <p className="text-sm">Start a conversation with your data</p>
                      <p className="text-xs mt-1">Select a table and ask a question below</p>
                    </div>
                  ) : (
                    chatMessages.map((msg, i) => (
                      <div
                        key={i}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`rounded-lg px-3 py-2 max-w-[80%] text-sm whitespace-pre-wrap ${
                            msg.role === 'user'
                              ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white'
                              : msg.status === 'failed'
                                ? 'bg-red-500/10 text-red-700 border border-red-200'
                                : msg.status === 'pending'
                                  ? 'bg-muted text-muted-foreground'
                                  : 'bg-muted'
                          }`}
                        >
                          {msg.status === 'pending' ? (
                            <span className="flex items-center gap-2">
                              <Loader2 className="h-3 w-3 animate-spin" /> Thinking...
                            </span>
                          ) : (
                            msg.content
                          )}
                          {msg.meta?.sources !== undefined && msg.status === 'completed' && (
                            <div className="text-xs opacity-70 mt-1">
                              {msg.meta.sources} source(s) retrieved
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex gap-2 flex-wrap">
                    <Select value={chatTable} onValueChange={setChatTable}>
                      <SelectTrigger className="w-full sm:w-44">
                        <SelectValue placeholder="Select table" />
                      </SelectTrigger>
                      <SelectContent>
                        {tables.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.displayName || t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={chatModel} onValueChange={setChatModel}>
                      <SelectTrigger className="w-full sm:w-44">
                        <SelectValue placeholder="Default model" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Default</SelectItem>
                        {llmConfigs
                          .filter((c) => c.isActive)
                          .map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Ask about your data..."
                      className="flex-1"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !chatSending) void handleChat()
                      }}
                      disabled={chatSending}
                    />
                    <Button onClick={() => void handleChat()} disabled={chatSending || !chatTable}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">How RAG Works</CardTitle>
                <CardDescription>Retrieval-Augmented Generation pipeline</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex gap-3">
                  <div className="rounded-md bg-emerald-500/10 p-2 h-fit">
                    <Search className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <div className="font-medium">1. Retrieve</div>
                    <p className="text-xs text-muted-foreground">
                      Your query is embedded and matched against table embeddings using cosine similarity.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="rounded-md bg-teal-500/10 p-2 h-fit">
                    <Sparkles className="h-4 w-4 text-teal-600" />
                  </div>
                  <div>
                    <div className="font-medium">2. Augment</div>
                    <p className="text-xs text-muted-foreground">
                      Top matching rows are added to the LLM prompt as context.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="rounded-md bg-emerald-500/10 p-2 h-fit">
                    <Brain className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <div className="font-medium">3. Generate</div>
                    <p className="text-xs text-muted-foreground">
                      The configured LLM generates a grounded response using your data.
                    </p>
                  </div>
                </div>
                <div className="rounded-md border border-emerald-200 bg-emerald-500/5 p-3">
                  <p className="text-xs text-emerald-700">
                    <strong>Tip:</strong> Make sure your target table has embeddings generated first.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">LLM Call History</CardTitle>
              <CardDescription>Recent LLM API calls ({llmCalls.length} total)</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {llmCalls.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Clock className="h-10 w-10 mb-2 opacity-30" />
                  <p className="text-sm">No LLM calls recorded yet</p>
                  <p className="text-xs mt-1">Calls will appear here once you start using the RAG chat or generate embeddings.</p>
                </div>
              ) : (
                <div className="rounded-md border max-h-[600px] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background">
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Provider</TableHead>
                        <TableHead>Model</TableHead>
                        <TableHead>Tokens</TableHead>
                        <TableHead>Latency</TableHead>
                        <TableHead>Cost</TableHead>
                        <TableHead>When</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {llmCalls.slice(0, 100).map((call) => (
                        <TableRow key={call.id} className="hover:bg-muted/40">
                          <TableCell>
                            {call.status === 'success' ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500" />
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs capitalize">
                              {call.config?.provider ?? '—'}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{call.model}</TableCell>
                          <TableCell>{call.totalTokens?.toLocaleString() ?? '—'}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {call.latencyMs ? `${call.latencyMs}ms` : '—'}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {call.cost != null ? `$${call.cost.toFixed(6)}` : '—'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(call.createdAt).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Provider Edit Dialog */}
      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Edit Provider' : 'Configure LLM Provider'}</DialogTitle>
            <DialogDescription>
              {editTarget
                ? 'Update provider configuration'
                : 'Add a new LLM provider configuration'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Config Name</Label>
                <Input value={cfgName} onChange={(e) => setCfgName(e.target.value)} placeholder="My LLM Config" />
              </div>
              <div className="space-y-2">
                <Label>Provider</Label>
                <Select value={cfgProvider} onValueChange={setCfgProvider}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="anthropic">Anthropic</SelectItem>
                    <SelectItem value="ollama">Ollama (Local)</SelectItem>
                    <SelectItem value="custom">Custom Endpoint</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Model Name</Label>
                <Input value={cfgModel} onChange={(e) => setCfgModel(e.target.value)} placeholder="gpt-4o" />
              </div>
              <div className="space-y-2">
                <Label>Max Tokens</Label>
                <Input
                  type="number"
                  value={cfgMaxTokens}
                  onChange={(e) => setCfgMaxTokens(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Temperature</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={cfgTemperature}
                  onChange={(e) => setCfgTemperature(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Cost / 1K in ($)</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={cfgCostInput}
                  onChange={(e) => setCfgCostInput(e.target.value)}
                  placeholder="0.005"
                />
              </div>
              <div className="space-y-2">
                <Label>Cost / 1K out ($)</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={cfgCostOutput}
                  onChange={(e) => setCfgCostOutput(e.target.value)}
                  placeholder="0.015"
                />
              </div>
            </div>
            {(cfgProvider === 'ollama' || cfgProvider === 'custom') && (
              <div className="space-y-2">
                <Label>Base URL</Label>
                <Input value={cfgBaseUrl} onChange={(e) => setCfgBaseUrl(e.target.value)} placeholder="http://localhost:11434" />
              </div>
            )}
            <div className="space-y-2">
              <Label>API Key {editTarget && '(leave blank to keep current)'}</Label>
              <Input
                type="password"
                value={cfgApiKey}
                onChange={(e) => setCfgApiKey(e.target.value)}
                placeholder="sk-..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfigDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveConfig}>{editTarget ? 'Save Changes' : 'Add Provider'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
