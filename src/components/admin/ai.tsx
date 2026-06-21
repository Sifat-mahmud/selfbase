'use client'

import { useState, useEffect } from 'react'
import {
  Brain,
  Plus,
  Send,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  MessageSquare,
  Database,
  Cpu,
  Sparkles,
  CheckCircle2,
  XCircle,
  Clock,
  Copy,
  Key,
  Globe,
  RefreshCw,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'

interface LlmConfigItem {
  id: string
  provider: string
  name: string
  baseUrl: string | null
  modelName: string
  isActive: boolean
  maxTokens: number
  temperature: number
  costPer1kInput: number | null
  costPer1kOutput: number | null
  createdAt: string
  totalCalls: number
  totalTokens: number
}

interface EmbeddingItem {
  id: string
  tableId: string
  tableName: string
  rowCount: number
  model: string
  createdAt: string
}

interface RagSessionItem {
  id: string
  tableId: string
  tableName: string
  query: string
  response: string | null
  status: 'pending' | 'completed' | 'failed'
  createdAt: string
  completedAt: string | null
}

const mockLlmConfigs: LlmConfigItem[] = [
  { id: '1', provider: 'openai', name: 'GPT-4o', baseUrl: null, modelName: 'gpt-4o', isActive: true, maxTokens: 4096, temperature: 0.7, costPer1kInput: 0.005, costPer1kOutput: 0.015, createdAt: '2025-01-15', totalCalls: 12450, totalTokens: 5600000 },
  { id: '2', provider: 'anthropic', name: 'Claude Sonnet', baseUrl: null, modelName: 'claude-3-sonnet', isActive: true, maxTokens: 4096, temperature: 0.5, costPer1kInput: 0.003, costPer1kOutput: 0.015, createdAt: '2025-03-01', totalCalls: 8200, totalTokens: 3200000 },
  { id: '3', provider: 'ollama', name: 'Llama 3 Local', baseUrl: 'http://localhost:11434', modelName: 'llama3', isActive: false, maxTokens: 2048, temperature: 0.8, costPer1kInput: null, costPer1kOutput: null, createdAt: '2025-05-10', totalCalls: 340, totalTokens: 180000 },
  { id: '4', provider: 'custom', name: 'Fine-tuned Model', baseUrl: 'https://api.custom-llm.com/v1', modelName: 'custom-v2', isActive: false, maxTokens: 8192, temperature: 0.3, costPer1kInput: 0.01, costPer1kOutput: 0.03, createdAt: '2025-06-01', totalCalls: 0, totalTokens: 0 },
]

const mockEmbeddings: EmbeddingItem[] = [
  { id: '1', tableId: '5', tableName: 'articles', rowCount: 12400, model: 'text-embedding-3-small', createdAt: '2025-03-01' },
  { id: '2', tableId: '2', tableName: 'products', rowCount: 3420, model: 'text-embedding-3-small', createdAt: '2025-04-15' },
]

const mockRagSessions: RagSessionItem[] = [
  { id: '1', tableId: '5', tableName: 'articles', query: 'What are the latest trends in AI?', response: 'Based on the articles in your database, the latest AI trends include...', status: 'completed', createdAt: '2025-06-21T10:00:00Z', completedAt: '2025-06-21T10:00:05Z' },
  { id: '2', tableId: '2', tableName: 'products', query: 'Find products similar to wireless headphones under $100', response: 'I found 5 products matching your criteria...', status: 'completed', createdAt: '2025-06-21T09:30:00Z', completedAt: '2025-06-21T09:30:04Z' },
  { id: '3', tableId: '5', tableName: 'articles', query: 'Summarize recent cybersecurity news', response: null, status: 'pending', createdAt: '2025-06-21T10:05:00Z', completedAt: null },
]

export function AiView() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [llmConfigs, setLlmConfigs] = useState<LlmConfigItem[]>([])
  const [embeddings, setEmbeddings] = useState<EmbeddingItem[]>([])
  const [ragSessions, setRagSessions] = useState<RagSessionItem[]>([])
  const [showConfigDialog, setShowConfigDialog] = useState(false)
  const [newProvider, setNewProvider] = useState('openai')
  const [newModelName, setNewModelName] = useState('')
  const [newConfigName, setNewConfigName] = useState('')
  const [newBaseUrl, setNewBaseUrl] = useState('')
  const [newApiKey, setNewApiKey] = useState('')
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [selectedRagTable, setSelectedRagTable] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => {
      setLlmConfigs(mockLlmConfigs); setEmbeddings(mockEmbeddings); setRagSessions(mockRagSessions); setLoading(false)
    }, 600)
    return () => clearTimeout(timer)
  }, [])

  const handleCreateConfig = () => {
    if (!newConfigName.trim() || !newModelName.trim()) return
    const config: LlmConfigItem = {
      id: String(Date.now()), provider: newProvider, name: newConfigName,
      baseUrl: newBaseUrl || null, modelName: newModelName,
      isActive: false, maxTokens: 4096, temperature: 0.7,
      costPer1kInput: null, costPer1kOutput: null, createdAt: new Date().toISOString(),
      totalCalls: 0, totalTokens: 0,
    }
    setLlmConfigs((prev) => [...prev, config])
    setShowConfigDialog(false); setNewConfigName(''); setNewModelName(''); setNewBaseUrl(''); setNewApiKey('')
    toast({ title: 'LLM config created' })
  }

  const handleChat = () => {
    if (!chatInput.trim()) return
    setChatMessages((prev) => [...prev, { role: 'user', content: chatInput }])
    const input = chatInput
    setChatInput('')
    setTimeout(() => {
      setChatMessages((prev) => [...prev, { role: 'assistant', content: `This is a simulated response to: "${input}". In production, this would call the configured LLM provider.` }])
    }, 1000)
  }

  const handleEmbed = () => {
    toast({ title: 'Embedding generation started', description: 'Processing rows for embeddings...' })
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <div className="grid gap-4 md:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-24 w-full" /></CardContent></Card>)}</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">AI</h1>
        <p className="text-muted-foreground">LLM providers, embeddings, semantic search, and RAG</p>
      </div>

      <Tabs defaultValue="providers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="providers" className="gap-1.5"><Brain className="h-3.5 w-3.5" />Providers</TabsTrigger>
          <TabsTrigger value="embeddings" className="gap-1.5"><Sparkles className="h-3.5 w-3.5" />Embeddings</TabsTrigger>
          <TabsTrigger value="search" className="gap-1.5"><Search className="h-3.5 w-3.5" />Search</TabsTrigger>
          <TabsTrigger value="rag" className="gap-1.5"><MessageSquare className="h-3.5 w-3.5" />RAG</TabsTrigger>
        </TabsList>

        {/* Providers Tab */}
        <TabsContent value="providers" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="grid gap-4 md:grid-cols-3 flex-1 mr-4">
              <Card><CardContent className="pt-4"><div className="text-sm text-muted-foreground">Active Providers</div><div className="text-2xl font-bold">{llmConfigs.filter(c => c.isActive).length}</div></CardContent></Card>
              <Card><CardContent className="pt-4"><div className="text-sm text-muted-foreground">Total LLM Calls</div><div className="text-2xl font-bold">{llmConfigs.reduce((s, c) => s + c.totalCalls, 0).toLocaleString()}</div></CardContent></Card>
              <Card><CardContent className="pt-4"><div className="text-sm text-muted-foreground">Total Tokens Used</div><div className="text-2xl font-bold">{(llmConfigs.reduce((s, c) => s + c.totalTokens, 0) / 1000000).toFixed(1)}M</div></CardContent></Card>
            </div>
            <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
              <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" />Add Provider</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Configure LLM Provider</DialogTitle><DialogDescription>Add a new LLM provider configuration</DialogDescription></DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2"><Label>Config Name</Label><Input value={newConfigName} onChange={(e) => setNewConfigName(e.target.value)} placeholder="My LLM Config" /></div>
                  <div className="space-y-2"><Label>Provider</Label>
                    <Select value={newProvider} onValueChange={setNewProvider}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="openai">OpenAI</SelectItem>
                        <SelectItem value="anthropic">Anthropic</SelectItem>
                        <SelectItem value="ollama">Ollama (Local)</SelectItem>
                        <SelectItem value="custom">Custom Endpoint</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Model Name</Label><Input value={newModelName} onChange={(e) => setNewModelName(e.target.value)} placeholder="gpt-4o" /></div>
                  {newProvider === 'ollama' || newProvider === 'custom' ? (
                    <div className="space-y-2"><Label>Base URL</Label><Input value={newBaseUrl} onChange={(e) => setNewBaseUrl(e.target.value)} placeholder="http://localhost:11434" /></div>
                  ) : null}
                  <div className="space-y-2"><Label>API Key</Label><Input type="password" value={newApiKey} onChange={(e) => setNewApiKey(e.target.value)} placeholder="sk-..." /></div>
                </div>
                <DialogFooter><Button variant="outline" onClick={() => setShowConfigDialog(false)}>Cancel</Button><Button onClick={handleCreateConfig}>Add Provider</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {llmConfigs.map((config) => (
              <Card key={config.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="rounded-md bg-emerald-500/10 p-2">
                        {config.provider === 'openai' ? <Brain className="h-4 w-4 text-emerald-600" /> :
                         config.provider === 'anthropic' ? <Cpu className="h-4 w-4 text-emerald-600" /> :
                         config.provider === 'ollama' ? <Database className="h-4 w-4 text-emerald-600" /> :
                         <Globe className="h-4 w-4 text-emerald-600" />}
                      </div>
                      <div>
                        <div className="font-semibold">{config.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{config.modelName}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={config.isActive ? 'default' : 'secondary'} className="text-xs">{config.isActive ? 'Active' : 'Inactive'}</Badge>
                      <Switch checked={config.isActive} className="scale-75" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center mb-3">
                    <div className="rounded-md bg-muted/50 p-2"><div className="text-xs text-muted-foreground">Calls</div><div className="text-sm font-bold">{config.totalCalls.toLocaleString()}</div></div>
                    <div className="rounded-md bg-muted/50 p-2"><div className="text-xs text-muted-foreground">Tokens</div><div className="text-sm font-bold">{(config.totalTokens / 1000).toFixed(0)}K</div></div>
                    <div className="rounded-md bg-muted/50 p-2"><div className="text-xs text-muted-foreground">Temp</div><div className="text-sm font-bold">{config.temperature}</div></div>
                  </div>
                  {config.baseUrl && (
                    <div className="text-xs text-muted-foreground font-mono truncate border-t pt-2">{config.baseUrl}</div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Embeddings Tab */}
        <TabsContent value="embeddings" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card><CardContent className="pt-4"><div className="text-sm text-muted-foreground">Embedded Tables</div><div className="text-2xl font-bold">{embeddings.length}</div></CardContent></Card>
            <Card><CardContent className="pt-4"><div className="text-sm text-muted-foreground">Total Embedded Rows</div><div className="text-2xl font-bold">{embeddings.reduce((s, e) => s + e.rowCount, 0).toLocaleString()}</div></CardContent></Card>
            <Card><CardContent className="pt-4">
              <Button className="w-full" onClick={handleEmbed}><Sparkles className="mr-1 h-4 w-4" />Generate Embeddings</Button>
            </CardContent></Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Embedding Status</CardTitle><CardDescription>Tables with generated embeddings</CardDescription></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Table</TableHead>
                    <TableHead>Embedded Rows</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {embeddings.map((emb) => (
                    <TableRow key={emb.id}>
                      <TableCell className="font-mono font-medium">{emb.tableName}</TableCell>
                      <TableCell>{emb.rowCount.toLocaleString()}</TableCell>
                      <TableCell><Badge variant="outline" className="font-mono text-xs">{emb.model}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{new Date(emb.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleEmbed}><RefreshCw className="h-3.5 w-3.5" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Semantic Search Tab */}
        <TabsContent value="search" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Semantic Search</CardTitle><CardDescription>Search across your embedded data using natural language</CardDescription></CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search across your data..." className="pl-9 h-10" />
                </div>
                <Select value={selectedRagTable} onValueChange={setSelectedRagTable}>
                  <SelectTrigger className="w-44"><SelectValue placeholder="All tables" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tables</SelectItem>
                    {embeddings.map((e) => <SelectItem key={e.id} value={e.tableName}>{e.tableName}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button onClick={() => toast({ title: 'Search completed', description: 'Found 12 relevant results.' })}><Search className="mr-1 h-4 w-4" />Search</Button>
              </div>
              <div className="mt-6 flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Search className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-sm">Enter a query to search your embedded data</p>
                <p className="text-xs mt-1">Results will appear here with similarity scores</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* RAG Tab */}
        <TabsContent value="rag" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Chat Interface */}
            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle className="text-base">RAG Chat</CardTitle>
                <CardDescription>Ask questions about your data</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <div className="flex-1 min-h-[300px] max-h-[400px] overflow-y-auto space-y-3 mb-4">
                  {chatMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <MessageSquare className="h-10 w-10 mb-2 opacity-30" />
                      <p className="text-sm">Start a conversation with your data</p>
                    </div>
                  ) : (
                    chatMessages.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`rounded-lg px-3 py-2 max-w-[80%] text-sm ${msg.role === 'user' ? 'bg-emerald-500 text-white' : 'bg-muted'}`}>
                          {msg.content}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex gap-2">
                  <Select value={selectedRagTable} onValueChange={setSelectedRagTable}>
                    <SelectTrigger className="w-36"><SelectValue placeholder="Table" /></SelectTrigger>
                    <SelectContent>
                      {embeddings.map((e) => <SelectItem key={e.id} value={e.tableName}>{e.tableName}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Ask about your data..." className="flex-1" onKeyDown={(e) => e.key === 'Enter' && handleChat()} />
                  <Button onClick={handleChat} size="icon"><Send className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>

            {/* RAG History */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">RAG Sessions</CardTitle>
                <CardDescription>Previous RAG queries</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {ragSessions.map((session) => (
                    <div key={session.id} className="rounded-lg border p-3 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant="outline" className="text-xs font-mono">{session.tableName}</Badge>
                        <div className="flex items-center gap-1">
                          {session.status === 'completed' ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : session.status === 'failed' ? <XCircle className="h-3 w-3 text-red-500" /> : <Clock className="h-3 w-3 text-amber-500" />}
                          <span className="text-xs capitalize">{session.status}</span>
                        </div>
                      </div>
                      <p className="text-sm font-medium">{session.query}</p>
                      {session.response && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{session.response}</p>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
