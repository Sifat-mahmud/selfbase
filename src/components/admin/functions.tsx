'use client'

import { useState, useEffect } from 'react'
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
  Webhook,
  ArrowRight,
  Terminal,
  Copy,
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
import { useToast } from '@/hooks/use-toast'

interface SbFunctionItem {
  id: string
  name: string
  description: string | null
  code: string
  runtime: string
  triggerType: 'http' | 'schedule' | 'event'
  triggerConfig: string | null
  timeoutMs: number
  memoryMb: number
  isActive: boolean
  createdAt: string
  runs: FunctionRunItem[]
}

interface FunctionRunItem {
  id: string
  status: 'pending' | 'running' | 'success' | 'failed' | 'timeout'
  triggeredBy: string | null
  durationMs: number | null
  memoryUsedMb: number | null
  startedAt: string
  completedAt: string | null
}

const mockFunctions: SbFunctionItem[] = [
  {
    id: '1', name: 'emailWorker', description: 'Process email notifications from queue',
    code: `export default async function handler(req, res) {
  const { to, subject, body } = req.body;
  // Send email via SMTP
  await sendEmail({ to, subject, body });
  return res.json({ success: true });
}`,
    runtime: 'javascript', triggerType: 'http', triggerConfig: null,
    timeoutMs: 30000, memoryMb: 128, isActive: true, createdAt: '2025-03-15',
    runs: [
      { id: 'fr1', status: 'success', triggeredBy: 'http', durationMs: 250, memoryUsedMb: 45, startedAt: '2025-06-21T10:00:00Z', completedAt: '2025-06-21T10:00:00Z' },
      { id: 'fr2', status: 'timeout', triggeredBy: 'http', durationMs: 30000, memoryUsedMb: 128, startedAt: '2025-06-21T09:45:00Z', completedAt: '2025-06-21T09:45:30Z' },
    ],
  },
  {
    id: '2', name: 'dailyReport', description: 'Generate and send daily analytics report',
    code: `export default async function handler(event) {
  const report = await generateReport('daily');
  await sendToSlack(report);
  return { status: 'ok' };
}`,
    runtime: 'javascript', triggerType: 'schedule', triggerConfig: '{"cron":"0 9 * * *"}',
    timeoutMs: 60000, memoryMb: 256, isActive: true, createdAt: '2025-04-01',
    runs: [
      { id: 'fr3', status: 'success', triggeredBy: 'schedule', durationMs: 4500, memoryUsedMb: 180, startedAt: '2025-06-21T09:00:00Z', completedAt: '2025-06-21T09:00:05Z' },
    ],
  },
  {
    id: '3', name: 'webhookHandler', description: 'Handle incoming webhook events',
    code: `export default async function handler(req, res) {
  const event = req.body;
  await processEvent(event);
  return res.json({ received: true });
}`,
    runtime: 'javascript', triggerType: 'event', triggerConfig: '{"pattern":"webhook.*"}',
    timeoutMs: 15000, memoryMb: 128, isActive: true, createdAt: '2025-05-10',
    runs: [],
  },
  {
    id: '4', name: 'dataTransform', description: 'ETL transformation pipeline',
    code: `export default async function handler(req, res) {
  const data = await fetchSourceData();
  const transformed = transform(data);
  await writeToTable(transformed);
  return res.json({ rows: transformed.length });
}`,
    runtime: 'typescript', triggerType: 'http', triggerConfig: null,
    timeoutMs: 45000, memoryMb: 256, isActive: false, createdAt: '2025-06-01',
    runs: [],
  },
]

const triggerIcons = {
  http: Zap,
  schedule: Calendar,
  event: Webhook,
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

export function FunctionsView() {
  const { toast } = useToast()
  const [functions, setFunctions] = useState<SbFunctionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [selectedFunction, setSelectedFunction] = useState<SbFunctionItem | null>(null)
  const [newName, setNewName] = useState('')
  const [newRuntime, setNewRuntime] = useState('javascript')
  const [newTrigger, setNewTrigger] = useState<'http' | 'schedule' | 'event'>('http')
  const [codeText, setCodeText] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => { setFunctions(mockFunctions); setLoading(false) }, 600)
    return () => clearTimeout(timer)
  }, [])

  const handleCreate = () => {
    if (!newName.trim()) return
    const fn: SbFunctionItem = {
      id: String(Date.now()), name: newName, description: null,
      code: `export default async function handler(req, res) {\n  // Your code here\n  return res.json({ ok: true });\n}`,
      runtime: newRuntime, triggerType: newTrigger, triggerConfig: null,
      timeoutMs: 30000, memoryMb: 128, isActive: false, createdAt: new Date().toISOString(), runs: [],
    }
    setFunctions((prev) => [...prev, fn])
    setShowCreateDialog(false); setNewName('')
    toast({ title: 'Function created', description: `"${newName}" has been created.` })
  }

  const handleRun = (id: string) => {
    toast({ title: 'Function invoked', description: 'The function is now running.' })
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-40 w-full" /></CardContent></Card>)}</div>
      </div>
    )
  }

  if (selectedFunction) {
    const TriggerIcon = triggerIcons[selectedFunction.triggerType]
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setSelectedFunction(null)}>
            <ArrowRight className="h-4 w-4 rotate-180" /> Back
          </Button>
          <div className="h-6 w-px bg-border" />
          <Code2 className="h-5 w-5 text-emerald-500" />
          <h1 className="text-2xl font-bold tracking-tight">{selectedFunction.name}</h1>
          <Badge variant="outline" className="capitalize">{selectedFunction.runtime}</Badge>
          <Badge variant={selectedFunction.isActive ? 'default' : 'secondary'}>
            {selectedFunction.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card><CardContent className="pt-4"><div className="text-sm text-muted-foreground">Trigger</div><div className="flex items-center gap-1 text-lg font-bold capitalize"><TriggerIcon className="h-4 w-4" />{selectedFunction.triggerType}</div></CardContent></Card>
          <Card><CardContent className="pt-4"><div className="text-sm text-muted-foreground">Timeout</div><div className="text-lg font-bold">{(selectedFunction.timeoutMs / 1000)}s</div></CardContent></Card>
          <Card><CardContent className="pt-4"><div className="text-sm text-muted-foreground">Memory</div><div className="text-lg font-bold">{selectedFunction.memoryMb} MB</div></CardContent></Card>
          <Card><CardContent className="pt-4"><div className="text-sm text-muted-foreground">Total Runs</div><div className="text-lg font-bold">{selectedFunction.runs.length}</div></CardContent></Card>
        </div>

        {/* Code Editor */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Source Code</CardTitle>
              <CardDescription>Function implementation</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(selectedFunction.code); toast({ title: 'Code copied' }) }}><Copy className="h-3.5 w-3.5 mr-1" />Copy</Button>
              <Button size="sm" onClick={() => handleRun(selectedFunction.id)}><Play className="h-3.5 w-3.5 mr-1" />Run</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md bg-slate-950 text-emerald-400 p-4 overflow-auto max-h-[400px]">
              <pre className="text-sm font-mono whitespace-pre-wrap">{selectedFunction.code}</pre>
            </div>
          </CardContent>
        </Card>

        {/* Trigger Config */}
        {selectedFunction.triggerConfig && (
          <Card>
            <CardHeader><CardTitle className="text-base">Trigger Configuration</CardTitle></CardHeader>
            <CardContent>
              <div className="rounded-md bg-muted/50 p-3">
                <pre className="text-sm font-mono">{JSON.stringify(JSON.parse(selectedFunction.triggerConfig), null, 2)}</pre>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Run History */}
        <Card>
          <CardHeader><CardTitle className="text-base">Run History</CardTitle><CardDescription>Recent function executions</CardDescription></CardHeader>
          <CardContent>
            {selectedFunction.runs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Terminal className="h-10 w-10 mb-2 opacity-40" />
                <p className="text-sm">No runs yet</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Trigger</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Memory</TableHead>
                    <TableHead>Started</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedFunction.runs.map((run) => {
                    const RunIcon = statusIcons[run.status]
                    return (
                      <TableRow key={run.id}>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <RunIcon className={`h-3.5 w-3.5 ${statusColors[run.status]}`} />
                            <span className={`text-sm capitalize font-medium ${statusColors[run.status]}`}>{run.status}</span>
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="outline" className="text-xs capitalize">{run.triggeredBy ?? '—'}</Badge></TableCell>
                        <TableCell className="font-mono text-sm">{run.durationMs ? `${run.durationMs}ms` : '—'}</TableCell>
                        <TableCell className="text-sm">{run.memoryUsedMb ? `${run.memoryUsedMb} MB` : '—'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{new Date(run.startedAt).toLocaleString()}</TableCell>
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
          <h1 className="text-2xl font-bold tracking-tight">Functions</h1>
          <p className="text-muted-foreground">Manage serverless functions and triggers</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" />New Function</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Function</DialogTitle><DialogDescription>Deploy a new serverless function</DialogDescription></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2"><Label>Function Name</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="myFunction" /></div>
              <div className="space-y-2"><Label>Runtime</Label>
                <Select value={newRuntime} onValueChange={setNewRuntime}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="javascript">JavaScript</SelectItem>
                    <SelectItem value="typescript">TypeScript</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Trigger Type</Label>
                <Select value={newTrigger} onValueChange={(v) => setNewTrigger(v as typeof newTrigger)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="http">HTTP Endpoint</SelectItem>
                    <SelectItem value="schedule">Scheduled (Cron)</SelectItem>
                    <SelectItem value="event">Event-driven</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button><Button onClick={handleCreate}>Create Function</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="pt-4"><div className="text-sm text-muted-foreground">Total Functions</div><div className="text-2xl font-bold">{functions.length}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-sm text-muted-foreground">Active</div><div className="text-2xl font-bold text-emerald-600">{functions.filter(f => f.isActive).length}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-sm text-muted-foreground">HTTP Triggers</div><div className="text-2xl font-bold">{functions.filter(f => f.triggerType === 'http').length}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-sm text-muted-foreground">Total Runs</div><div className="text-2xl font-bold">{functions.reduce((s, f) => s + f.runs.length, 0)}</div></CardContent></Card>
      </div>

      {/* Function Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {functions.map((fn) => {
          const TriggerIcon = triggerIcons[fn.triggerType]
          const lastRun = fn.runs[0]
          return (
            <Card key={fn.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedFunction(fn)}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="rounded-md bg-emerald-500/10 p-1.5"><Code2 className="h-4 w-4 text-emerald-600" /></div>
                    <CardTitle className="text-base">{fn.name}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={fn.isActive ? 'default' : 'secondary'} className="text-xs">{fn.isActive ? 'Active' : 'Inactive'}</Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleRun(fn.id) }}><Play className="mr-2 h-3.5 w-3.5" />Run Now</DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => e.stopPropagation()}><Pencil className="mr-2 h-3.5 w-3.5" />Edit</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={(e) => e.stopPropagation()}><Trash2 className="mr-2 h-3.5 w-3.5" />Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <CardDescription className="line-clamp-1">{fn.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <TriggerIcon className="h-3 w-3" />
                    <span className="capitalize">{fn.triggerType}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">{fn.runtime}</span>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">{fn.timeoutMs / 1000}s timeout</span>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">{fn.memoryMb} MB</span>
                </div>
                <div className="rounded-md bg-slate-950 text-emerald-400 p-2 overflow-hidden">
                  <pre className="text-xs font-mono line-clamp-3 whitespace-pre-wrap">{fn.code.slice(0, 150)}...</pre>
                </div>
                {lastRun && (
                  <div className="mt-3 flex items-center gap-2 text-xs border-t pt-2">
                    {(() => { const Icon = statusIcons[lastRun.status]; return <Icon className={`h-3 w-3 ${statusColors[lastRun.status]}`} /> })()}
                    <span className={`capitalize ${statusColors[lastRun.status]}`}>{lastRun.status}</span>
                    <span className="text-muted-foreground">· {lastRun.durationMs ? `${lastRun.durationMs}ms` : '—'}</span>
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
