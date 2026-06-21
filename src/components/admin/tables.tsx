'use client'

import { useState, useEffect } from 'react'
import {
  Database,
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  Columns3,
  ArrowUpDown,
  ChevronRight,
  Shield,
  Radio,
  Brain,
  Copy,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'

interface SbTableItem {
  id: string
  name: string
  displayName: string | null
  description: string | null
  priority: number
  rowCount: number
  isSystem: boolean
  enableRealtime: boolean
  enableEmbedding: boolean
  rlsEnabled: boolean
  versionHash: string
  createdAt: string
  columns: ColumnItem[]
}

interface ColumnItem {
  id: string
  name: string
  type: string
  nullable: boolean
  isPrimaryKey: boolean
  isUnique: boolean
  isIndexed: boolean
  defaultValue: string | null
  order: number
}

const mockTables: SbTableItem[] = [
  {
    id: '1', name: 'users', displayName: 'Users', description: 'Application users table',
    priority: 1, rowCount: 1250, isSystem: false, enableRealtime: true, enableEmbedding: false,
    rlsEnabled: true, versionHash: 'a1b2c3', createdAt: '2025-01-15',
    columns: [
      { id: 'c1', name: 'id', type: 'TEXT', nullable: false, isPrimaryKey: true, isUnique: true, isIndexed: true, defaultValue: null, order: 0 },
      { id: 'c2', name: 'email', type: 'TEXT', nullable: false, isPrimaryKey: false, isUnique: true, isIndexed: true, defaultValue: null, order: 1 },
      { id: 'c3', name: 'name', type: 'TEXT', nullable: true, isPrimaryKey: false, isUnique: false, isIndexed: false, defaultValue: null, order: 2 },
      { id: 'c4', name: 'role', type: 'TEXT', nullable: true, isPrimaryKey: false, isUnique: false, isIndexed: true, defaultValue: "'user'", order: 3 },
      { id: 'c5', name: 'created_at', type: 'TIMESTAMP', nullable: true, isPrimaryKey: false, isUnique: false, isIndexed: false, defaultValue: 'now()', order: 4 },
    ],
  },
  {
    id: '2', name: 'products', displayName: 'Products', description: 'Product catalog',
    priority: 2, rowCount: 3420, isSystem: false, enableRealtime: true, enableEmbedding: true,
    rlsEnabled: false, versionHash: 'd4e5f6', createdAt: '2025-02-01',
    columns: [
      { id: 'c6', name: 'id', type: 'TEXT', nullable: false, isPrimaryKey: true, isUnique: true, isIndexed: true, defaultValue: null, order: 0 },
      { id: 'c7', name: 'title', type: 'TEXT', nullable: false, isPrimaryKey: false, isUnique: false, isIndexed: true, defaultValue: null, order: 1 },
      { id: 'c8', name: 'price', type: 'DECIMAL', nullable: true, isPrimaryKey: false, isUnique: false, isIndexed: false, defaultValue: '0', order: 2 },
      { id: 'c9', name: 'category', type: 'TEXT', nullable: true, isPrimaryKey: false, isUnique: false, isIndexed: true, defaultValue: null, order: 3 },
    ],
  },
  {
    id: '3', name: 'orders', displayName: 'Orders', description: 'Customer orders',
    priority: 1, rowCount: 8900, isSystem: false, enableRealtime: false, enableEmbedding: false,
    rlsEnabled: true, versionHash: 'g7h8i9', createdAt: '2025-02-10',
    columns: [
      { id: 'c10', name: 'id', type: 'TEXT', nullable: false, isPrimaryKey: true, isUnique: true, isIndexed: true, defaultValue: null, order: 0 },
      { id: 'c11', name: 'user_id', type: 'TEXT', nullable: false, isPrimaryKey: false, isUnique: false, isIndexed: true, defaultValue: null, order: 1 },
      { id: 'c12', name: 'total', type: 'DECIMAL', nullable: false, isPrimaryKey: false, isUnique: false, isIndexed: false, defaultValue: '0', order: 2 },
      { id: 'c13', name: 'status', type: 'TEXT', nullable: true, isPrimaryKey: false, isUnique: false, isIndexed: true, defaultValue: "'pending'", order: 3 },
    ],
  },
  {
    id: '4', name: 'sessions', displayName: 'Sessions', description: 'User sessions',
    priority: 3, rowCount: 5600, isSystem: true, enableRealtime: false, enableEmbedding: false,
    rlsEnabled: false, versionHash: 'j0k1l2', createdAt: '2025-01-15',
    columns: [
      { id: 'c14', name: 'id', type: 'TEXT', nullable: false, isPrimaryKey: true, isUnique: true, isIndexed: true, defaultValue: null, order: 0 },
      { id: 'c15', name: 'token', type: 'TEXT', nullable: false, isPrimaryKey: false, isUnique: true, isIndexed: true, defaultValue: null, order: 1 },
    ],
  },
  {
    id: '5', name: 'articles', displayName: 'Articles', description: 'Scraped articles for RAG',
    priority: 2, rowCount: 12400, isSystem: false, enableRealtime: false, enableEmbedding: true,
    rlsEnabled: false, versionHash: 'm3n4o5', createdAt: '2025-03-01',
    columns: [
      { id: 'c16', name: 'id', type: 'TEXT', nullable: false, isPrimaryKey: true, isUnique: true, isIndexed: true, defaultValue: null, order: 0 },
      { id: 'c17', name: 'title', type: 'TEXT', nullable: false, isPrimaryKey: false, isUnique: false, isIndexed: true, defaultValue: null, order: 1 },
      { id: 'c18', name: 'content', type: 'TEXT', nullable: true, isPrimaryKey: false, isUnique: false, isIndexed: false, defaultValue: null, order: 2 },
      { id: 'c19', name: 'url', type: 'TEXT', nullable: true, isPrimaryKey: false, isUnique: true, isIndexed: true, defaultValue: null, order: 3 },
    ],
  },
]

const priorityColors: Record<number, string> = {
  1: 'bg-red-500/10 text-red-600 border-red-200',
  2: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  3: 'bg-amber-500/10 text-amber-600 border-amber-200',
  4: 'bg-slate-500/10 text-slate-600 border-slate-200',
}

const priorityLabels: Record<number, string> = {
  1: 'Critical',
  2: 'Normal',
  3: 'Low',
  4: 'Deferred',
}

const columnTypes = ['TEXT', 'INTEGER', 'DECIMAL', 'BOOLEAN', 'TIMESTAMP', 'JSON']

export function TablesView() {
  const { toast } = useToast()
  const [tables, setTables] = useState<SbTableItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedTable, setSelectedTable] = useState<SbTableItem | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showColumnDialog, setShowColumnDialog] = useState(false)
  const [newTableName, setNewTableName] = useState('')
  const [newTableDesc, setNewTableDesc] = useState('')
  const [newColumnName, setNewColumnName] = useState('')
  const [newColumnType, setNewColumnType] = useState('TEXT')
  const [sortField, setSortField] = useState<'name' | 'rowCount' | 'priority'>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  useEffect(() => {
    const timer = setTimeout(() => {
      setTables(mockTables)
      setLoading(false)
    }, 600)
    return () => clearTimeout(timer)
  }, [])

  const filteredTables = tables
    .filter((t) => t.name.toLowerCase().includes(search.toLowerCase()) || (t.displayName ?? '').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      if (sortField === 'name') return a.name.localeCompare(b.name) * dir
      if (sortField === 'rowCount') return (a.rowCount - b.rowCount) * dir
      return (a.priority - b.priority) * dir
    })

  const handleSort = (field: 'name' | 'rowCount' | 'priority') => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortField(field); setSortDir('asc') }
  }

  const handleCreateTable = () => {
    if (!newTableName.trim()) return
    const newTable: SbTableItem = {
      id: String(Date.now()),
      name: newTableName.trim().toLowerCase().replace(/\s+/g, '_'),
      displayName: newTableName.trim(),
      description: newTableDesc || null,
      priority: 2,
      rowCount: 0,
      isSystem: false,
      enableRealtime: false,
      enableEmbedding: false,
      rlsEnabled: false,
      versionHash: 'new',
      createdAt: new Date().toISOString(),
      columns: [{ id: `c${Date.now()}`, name: 'id', type: 'TEXT', nullable: false, isPrimaryKey: true, isUnique: true, isIndexed: true, defaultValue: null, order: 0 }],
    }
    setTables((prev) => [...prev, newTable])
    setShowCreateDialog(false)
    setNewTableName('')
    setNewTableDesc('')
    toast({ title: 'Table created', description: `"${newTable.name}" has been created successfully.` })
  }

  const handleDeleteTable = (id: string) => {
    setTables((prev) => prev.filter((t) => t.id !== id))
    if (selectedTable?.id === id) setSelectedTable(null)
    toast({ title: 'Table deleted', description: 'The table has been removed.', variant: 'destructive' })
  }

  const handleAddColumn = () => {
    if (!selectedTable || !newColumnName.trim()) return
    const newCol: ColumnItem = {
      id: `c${Date.now()}`,
      name: newColumnName.trim().toLowerCase().replace(/\s+/g, '_'),
      type: newColumnType,
      nullable: true,
      isPrimaryKey: false,
      isUnique: false,
      isIndexed: false,
      defaultValue: null,
      order: selectedTable.columns.length,
    }
    setTables((prev) =>
      prev.map((t) => t.id === selectedTable.id ? { ...t, columns: [...t.columns, newCol] } : t)
    )
    setSelectedTable((prev) => prev ? { ...prev, columns: [...prev.columns, newCol] } : prev)
    setShowColumnDialog(false)
    setNewColumnName('')
    setNewColumnType('TEXT')
    toast({ title: 'Column added', description: `"${newCol.name}" added to ${selectedTable.name}` })
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between"><Skeleton className="h-8 w-40" /><Skeleton className="h-9 w-32" /></div>
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-20 w-full" /></CardContent></Card>
          ))}
        </div>
      </div>
    )
  }

  // Detail view
  if (selectedTable) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setSelectedTable(null)}>
            <ChevronRight className="h-4 w-4 rotate-180" />
            Back
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <h1 className="text-2xl font-bold tracking-tight">{selectedTable.displayName || selectedTable.name}</h1>
          <Badge variant="outline" className="ml-2 font-mono text-xs">{selectedTable.name}</Badge>
          {selectedTable.isSystem && <Badge variant="secondary">System</Badge>}
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card><CardContent className="pt-4"><div className="text-sm text-muted-foreground">Rows</div><div className="text-2xl font-bold">{selectedTable.rowCount.toLocaleString()}</div></CardContent></Card>
          <Card><CardContent className="pt-4"><div className="text-sm text-muted-foreground">Columns</div><div className="text-2xl font-bold">{selectedTable.columns.length}</div></CardContent></Card>
          <Card><CardContent className="pt-4"><div className="text-sm text-muted-foreground">Version</div><div className="text-2xl font-bold font-mono text-sm">{selectedTable.versionHash}</div></CardContent></Card>
          <Card><CardContent className="pt-4"><div className="text-sm text-muted-foreground">Priority</div><div className="text-2xl font-bold">{priorityLabels[selectedTable.priority]}</div></CardContent></Card>
        </div>

        {/* Feature flags */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Features</CardTitle>
            <CardDescription>Toggle table-level features</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={selectedTable.enableRealtime} />
                <Label className="flex items-center gap-1"><Radio className="h-3.5 w-3.5" /> Realtime</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={selectedTable.enableEmbedding} />
                <Label className="flex items-center gap-1"><Brain className="h-3.5 w-3.5" /> Embeddings</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={selectedTable.rlsEnabled} />
                <Label className="flex items-center gap-1"><Shield className="h-3.5 w-3.5" /> Row-Level Security</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Columns */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Columns</CardTitle>
              <CardDescription>Schema definition for this table</CardDescription>
            </div>
            <Dialog open={showColumnDialog} onOpenChange={setShowColumnDialog}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-1 h-4 w-4" /> Add Column</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Column</DialogTitle>
                  <DialogDescription>Add a new column to {selectedTable.name}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label>Column Name</Label>
                    <Input value={newColumnName} onChange={(e) => setNewColumnName(e.target.value)} placeholder="column_name" />
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={newColumnType} onValueChange={setNewColumnType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {columnTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowColumnDialog(false)}>Cancel</Button>
                  <Button onClick={handleAddColumn}>Add Column</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Nullable</TableHead>
                  <TableHead>Primary Key</TableHead>
                  <TableHead>Unique</TableHead>
                  <TableHead>Indexed</TableHead>
                  <TableHead>Default</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedTable.columns.map((col, i) => (
                  <TableRow key={col.id}>
                    <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                    <TableCell className="font-mono font-medium">{col.name}</TableCell>
                    <TableCell><Badge variant="outline" className="font-mono text-xs">{col.type}</Badge></TableCell>
                    <TableCell>{col.nullable ? <span className="text-emerald-500">✓</span> : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>{col.isPrimaryKey ? <span className="text-amber-500">🔑</span> : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>{col.isUnique ? <span className="text-emerald-500">✓</span> : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>{col.isIndexed ? <span className="text-emerald-500">✓</span> : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{col.defaultValue ?? '—'}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem><Pencil className="mr-2 h-3.5 w-3.5" />Edit</DropdownMenuItem>
                          <DropdownMenuItem><Copy className="mr-2 h-3.5 w-3.5" />Duplicate</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive"><Trash2 className="mr-2 h-3.5 w-3.5" />Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    )
  }

  // List view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tables</h1>
          <p className="text-muted-foreground">Manage your database schema and data</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-1 h-4 w-4" /> New Table</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Table</DialogTitle>
              <DialogDescription>Define a new table in your SelfBase schema</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Table Name</Label>
                <Input value={newTableName} onChange={(e) => setNewTableName(e.target.value)} placeholder="my_table" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={newTableDesc} onChange={(e) => setNewTableDesc(e.target.value)} placeholder="What is this table for?" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
              <Button onClick={handleCreateTable}>Create Table</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search tables..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Badge variant="secondary">{filteredTables.length} tables</Badge>
      </div>

      {/* Table List */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort('name')}>
                  <span className="flex items-center gap-1">Name <ArrowUpDown className="h-3 w-3" /></span>
                </TableHead>
                <TableHead>Priority</TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort('rowCount')}>
                  <span className="flex items-center gap-1">Rows <ArrowUpDown className="h-3 w-3" /></span>
                </TableHead>
                <TableHead>Columns</TableHead>
                <TableHead>Features</TableHead>
                <TableHead>Version</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTables.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No tables found. Create one to get started.
                  </TableCell>
                </TableRow>
              ) : (
                filteredTables.map((table) => (
                  <TableRow key={table.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedTable(table)}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4 text-emerald-500" />
                        <div>
                          <div className="font-medium">{table.displayName || table.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">{table.name}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={priorityColors[table.priority]}>{priorityLabels[table.priority]}</Badge>
                    </TableCell>
                    <TableCell className="font-mono">{table.rowCount.toLocaleString()}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1"><Columns3 className="h-3.5 w-3.5 text-muted-foreground" />{table.columns.length}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {table.enableRealtime && <Badge variant="secondary" className="text-xs gap-0.5"><Radio className="h-2.5 w-2.5" />RT</Badge>}
                        {table.enableEmbedding && <Badge variant="secondary" className="text-xs gap-0.5"><Brain className="h-2.5 w-2.5" />AI</Badge>}
                        {table.rlsEnabled && <Badge variant="secondary" className="text-xs gap-0.5"><Shield className="h-2.5 w-2.5" />RLS</Badge>}
                        {table.isSystem && <Badge variant="secondary" className="text-xs">SYS</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{table.versionHash}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedTable(table) }}><Eye className="mr-2 h-3.5 w-3.5" />View Details</DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => e.stopPropagation()}><Pencil className="mr-2 h-3.5 w-3.5" />Edit</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteTable(table.id) }}><Trash2 className="mr-2 h-3.5 w-3.5" />Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
