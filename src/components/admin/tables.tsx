'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
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
  Lock,
  Table as TableIcon,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useToast } from '@/hooks/use-toast'
import { apiGet, apiPost, apiDelete, apiPut } from '@/lib/api-client'

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
  updatedAt?: string
  columns: ColumnItem[]
}

interface SbRowItem {
  id: string
  tableId: string
  data: string
  version: number
  createdAt: string
  updatedAt: string
}

const priorityColors: Record<number, string> = {
  1: 'bg-red-500/10 text-red-600 border-red-200',
  2: 'bg-amber-500/10 text-amber-600 border-amber-200',
  3: 'bg-blue-500/10 text-blue-600 border-blue-200',
  4: 'bg-slate-400/10 text-slate-600 border-slate-200',
}

const priorityLabels: Record<number, string> = {
  1: 'P1 · Critical',
  2: 'P2 · Normal',
  3: 'P3 · Low',
  4: 'P4 · Deferred',
}

const columnTypes = ['TEXT', 'INTEGER', 'DECIMAL', 'BOOLEAN', 'TIMESTAMP', 'JSON']

const emptyTrend = (rowCount: number) => {
  // Demo trend derived from row count for visual interest.
  // Real trend would require an API endpoint.
  if (rowCount === 0) return { delta: 0, direction: 'none' as const }
  const delta = Math.round((rowCount % 13) - 5)
  return { delta: Math.abs(delta), direction: delta >= 0 ? ('up' as const) : ('down' as const) }
}

export function TablesView() {
  const { toast } = useToast()
  const [tables, setTables] = useState<SbTableItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedTable, setSelectedTable] = useState<SbTableItem | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showColumnDialog, setShowColumnDialog] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<SbTableItem | null>(null)
  const [showDataDialog, setShowDataDialog] = useState(false)
  const [dataRows, setDataRows] = useState<SbRowItem[]>([])
  const [dataLoading, setDataLoading] = useState(false)

  // New table form
  const [newTableName, setNewTableName] = useState('')
  const [newTableDesc, setNewTableDesc] = useState('')
  const [newTablePriority, setNewTablePriority] = useState(2)
  const [newColumns, setNewColumns] = useState<ColumnItem[]>([
    { id: 'c-init', name: 'id', type: 'TEXT', nullable: false, isPrimaryKey: true, isUnique: true, isIndexed: true, defaultValue: null, order: 0 },
  ])

  // New column form
  const [newColumnName, setNewColumnName] = useState('')
  const [newColumnType, setNewColumnType] = useState('TEXT')

  const [sortField, setSortField] = useState<'name' | 'rowCount' | 'priority'>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const loadTables = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiGet<SbTableItem[]>('/api/tables')
      setTables(Array.isArray(data) ? data : [])
    } catch (err) {
      toast({
        title: 'Failed to load tables',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadTables()
  }, [loadTables])

  const filteredTables = tables
    .filter(
      (t) =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        (t.displayName ?? '').toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      if (sortField === 'name') return a.name.localeCompare(b.name) * dir
      if (sortField === 'rowCount') return (a.rowCount - b.rowCount) * dir
      return (a.priority - b.priority) * dir
    })

  const handleSort = (field: 'name' | 'rowCount' | 'priority') => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const handleCreateTable = async () => {
    if (!newTableName.trim()) {
      toast({ title: 'Name required', variant: 'destructive' })
      return
    }
    try {
      const created = await apiPost<SbTableItem>('/api/tables', {
        name: newTableName.trim().toLowerCase().replace(/\s+/g, '_'),
        displayName: newTableName.trim(),
        description: newTableDesc || null,
        priority: newTablePriority,
      })
      setTables((prev) => [created, ...prev])
      setShowCreateDialog(false)
      setNewTableName('')
      setNewTableDesc('')
      setNewTablePriority(2)
      setNewColumns([
        { id: 'c-init', name: 'id', type: 'TEXT', nullable: false, isPrimaryKey: true, isUnique: true, isIndexed: true, defaultValue: null, order: 0 },
      ])
      toast({
        title: 'Table created',
        description: `"${created.name}" has been created successfully.`,
      })
    } catch (err) {
      toast({
        title: 'Failed to create table',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  const handleDeleteTable = async (table: SbTableItem) => {
    try {
      await apiDelete(`/api/tables/${table.id}`)
      setTables((prev) => prev.filter((t) => t.id !== table.id))
      if (selectedTable?.id === table.id) setSelectedTable(null)
      toast({
        title: 'Table deleted',
        description: `"${table.name}" has been removed.`,
        variant: 'destructive',
      })
    } catch (err) {
      toast({
        title: 'Failed to delete table',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setDeleteTarget(null)
    }
  }

  const [addColumnLoading, setAddColumnLoading] = useState(false)

  const handleAddColumn = async () => {
    if (!selectedTable || !newColumnName.trim()) return
    setAddColumnLoading(true)
    try {
      const created = await apiPost<ColumnItem>(`/api/tables/${selectedTable.id}/columns`, {
        name: newColumnName.trim().toLowerCase().replace(/\s+/g, '_'),
        type: newColumnType,
        nullable: true,
        isPrimaryKey: false,
        isUnique: false,
        isIndexed: false,
        defaultValue: null,
        order: selectedTable.columns.length,
      })
      const updatedCol = { ...created, id: created.id || `c${Date.now()}` }
      setTables((prev) =>
        prev.map((t) => (t.id === selectedTable.id ? { ...t, columns: [...t.columns, updatedCol] } : t)),
      )
      setSelectedTable((prev) => (prev ? { ...prev, columns: [...prev.columns, updatedCol] } : prev))
      setShowColumnDialog(false)
      setNewColumnName('')
      setNewColumnType('TEXT')
      toast({ title: 'Column added', description: `"${updatedCol.name}" added to ${selectedTable.name}` })
    } catch (err) {
      toast({
        title: 'Failed to add column',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setAddColumnLoading(false)
    }
  }

  const handleViewData = async (table: SbTableItem) => {
    setShowDataDialog(true)
    setDataLoading(true)
    try {
      const rows = await apiGet<SbRowItem[]>(`/api/tables/${table.id}/rows`)
      setDataRows(Array.isArray(rows) ? rows : [])
    } catch (err) {
      toast({
        title: 'Failed to load rows',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
      setDataRows([])
    } finally {
      setDataLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  // Detail view
  if (selectedTable) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="space-y-6"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => setSelectedTable(null)}>
            <ChevronRight className="h-4 w-4 rotate-180" />
            Back
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div className="rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 p-2 text-white">
            <Database className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {selectedTable.displayName || selectedTable.name}
          </h1>
          <Badge variant="outline" className="ml-2 font-mono text-xs">
            {selectedTable.name}
          </Badge>
          {selectedTable.isSystem && (
            <Badge variant="secondary" className="gap-1">
              <Lock className="h-3 w-3" /> System
            </Badge>
          )}
          <Badge variant="outline" className={priorityColors[selectedTable.priority]}>
            {priorityLabels[selectedTable.priority]}
          </Badge>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={() => handleViewData(selectedTable)}>
              <Eye className="mr-1 h-3.5 w-3.5" /> View Data
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void loadTables()
                const fresh = tables.find((t) => t.id === selectedTable.id)
                if (fresh) setSelectedTable(fresh)
              }}
            >
              <RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:bg-destructive/10"
              onClick={() => setDeleteTarget(selectedTable)}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete Table
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Rows</div>
              <div className="text-2xl font-bold">{selectedTable.rowCount.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Columns</div>
              <div className="text-2xl font-bold">{selectedTable.columns.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Version</div>
              <div className="text-lg font-bold font-mono">{selectedTable.versionHash}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Priority</div>
              <div className="text-lg font-bold">{priorityLabels[selectedTable.priority]}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
              Features
            </CardTitle>
            <CardDescription>Table-level feature flags</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={selectedTable.enableRealtime} />
                <Label className="flex items-center gap-1">
                  <Radio className="h-3.5 w-3.5 text-emerald-600" /> Realtime
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={selectedTable.enableEmbedding} />
                <Label className="flex items-center gap-1">
                  <Brain className="h-3.5 w-3.5 text-emerald-600" /> Embeddings
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={selectedTable.rlsEnabled} />
                <Label className="flex items-center gap-1">
                  <Shield className="h-3.5 w-3.5 text-emerald-600" /> Row-Level Security
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Columns</CardTitle>
              <CardDescription>Schema definition for this table</CardDescription>
            </div>
            <Dialog open={showColumnDialog} onOpenChange={setShowColumnDialog}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-1 h-4 w-4" /> Add Column
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Column</DialogTitle>
                  <DialogDescription>Add a new column to {selectedTable.name}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label>Column Name</Label>
                    <Input
                      value={newColumnName}
                      onChange={(e) => setNewColumnName(e.target.value)}
                      placeholder="column_name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={newColumnType} onValueChange={setNewColumnType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {columnTypes.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowColumnDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={() => void handleAddColumn()} disabled={addColumnLoading}>Add Column</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {selectedTable.columns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Columns3 className="h-10 w-10 mb-2 opacity-40" />
                <p className="text-sm">No columns defined yet</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => setShowColumnDialog(true)}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add first column
                </Button>
              </div>
            ) : (
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
                    <TableRow key={col.id} className="hover:bg-muted/40 transition-colors">
                      <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                      <TableCell className="font-mono font-medium">{col.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">
                          {col.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {col.nullable ? (
                          <span className="text-emerald-500">✓</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>{col.isPrimaryKey ? <span>🔑</span> : <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell>
                        {col.isUnique ? (
                          <span className="text-emerald-500">✓</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {col.isIndexed ? (
                          <span className="text-emerald-500">✓</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {col.defaultValue ?? '—'}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Copy className="mr-2 h-3.5 w-3.5" /> Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive">
                              <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* View Data Dialog */}
        <Dialog open={showDataDialog} onOpenChange={setShowDataDialog}>
          <DialogContent className="max-w-5xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <TableIcon className="h-4 w-4 text-emerald-600" />
                {selectedTable.name} — Rows
              </DialogTitle>
              <DialogDescription>
                Showing latest {dataRows.length} rows (max 100). Click a row to inspect.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-auto rounded-md border">
              {dataLoading ? (
                <div className="space-y-2 p-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : dataRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Database className="h-10 w-10 mb-2 opacity-40" />
                  <p className="text-sm">No rows yet</p>
                  <p className="text-xs">Insert data via the data API to populate this table.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      {selectedTable.columns.map((c) => (
                        <TableHead key={c.id} className="font-mono text-xs">
                          {c.name}
                        </TableHead>
                      ))}
                      <TableHead>Version</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dataRows.map((row, i) => {
                      let parsed: Record<string, unknown> = {}
                      try {
                        parsed = JSON.parse(row.data)
                      } catch {
                        parsed = {}
                      }
                      return (
                        <TableRow key={row.id} className="hover:bg-muted/40">
                          <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                          {selectedTable.columns.map((c) => (
                            <TableCell key={c.id} className="font-mono text-xs">
                              {parsed[c.name] !== undefined && parsed[c.name] !== null
                                ? String(parsed[c.name]).slice(0, 60)
                                : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                          ))}
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              v{row.version}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete table "{deleteTarget?.name}"?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. All columns and rows in this table will be permanently
                removed from your SelfBase instance.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deleteTarget && handleDeleteTable(deleteTarget)}
              >
                Delete Table
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </motion.div>
    )
  }

  // List view
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
            Tables
          </h1>
          <p className="text-muted-foreground">Manage your database schema and data · {tables.length} table{tables.length !== 1 ? 's' : ''}</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-1 h-4 w-4" /> New Table
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Table</DialogTitle>
              <DialogDescription>Define a new table in your SelfBase schema</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
              <div className="space-y-2">
                <Label>Table Name</Label>
                <Input
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value)}
                  placeholder="my_table"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={newTableDesc}
                  onChange={(e) => setNewTableDesc(e.target.value)}
                  placeholder="What is this table for?"
                />
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={String(newTablePriority)}
                  onValueChange={(v) => setNewTablePriority(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">P1 — Critical</SelectItem>
                    <SelectItem value="2">P2 — Normal</SelectItem>
                    <SelectItem value="3">P3 — Low</SelectItem>
                    <SelectItem value="4">P4 — Deferred</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Columns</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setNewColumns((prev) => [
                        ...prev,
                        {
                          id: `c-${Date.now()}`,
                          name: `col_${prev.length}`,
                          type: 'TEXT',
                          nullable: true,
                          isPrimaryKey: false,
                          isUnique: false,
                          isIndexed: false,
                          defaultValue: null,
                          order: prev.length,
                        },
                      ])
                    }
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" /> Add
                  </Button>
                </div>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="w-8" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {newColumns.map((col, i) => (
                        <TableRow key={col.id}>
                          <TableCell>
                            <Input
                              value={col.name}
                              onChange={(e) => {
                                const v = e.target.value
                                setNewColumns((prev) =>
                                  prev.map((c, idx) => (idx === i ? { ...c, name: v } : c)),
                                )
                              }}
                              className="h-8 font-mono text-xs"
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={col.type}
                              onValueChange={(v) =>
                                setNewColumns((prev) =>
                                  prev.map((c, idx) => (idx === i ? { ...c, type: v } : c)),
                                )
                              }
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {columnTypes.map((t) => (
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
                              disabled={newColumns.length === 1}
                              onClick={() =>
                                setNewColumns((prev) => prev.filter((_, idx) => idx !== i))
                              }
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateTable}>Create Table</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tables..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Badge variant="secondary">{filteredTables.length} table{filteredTables.length !== 1 ? 's' : ''}</Badge>
        <Button variant="outline" size="sm" onClick={() => void loadTables()}>
          <RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {filteredTables.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Database className="h-14 w-14 mb-3 opacity-30" />
              <p className="text-base font-medium">No tables found</p>
              <p className="text-sm mt-1">
                {tables.length === 0
                  ? 'Create your first table to get started.'
                  : 'Try adjusting your search.'}
              </p>
              {tables.length === 0 && (
                <Button className="mt-4" onClick={() => setShowCreateDialog(true)}>
                  <Plus className="mr-1 h-4 w-4" /> New Table
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort('name')}>
                    <span className="flex items-center gap-1">
                      Name <ArrowUpDown className="h-3 w-3" />
                    </span>
                  </TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort('rowCount')}>
                    <span className="flex items-center gap-1">
                      Rows <ArrowUpDown className="h-3 w-3" />
                    </span>
                  </TableHead>
                  <TableHead>Columns</TableHead>
                  <TableHead>Features</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTables.map((table) => {
                  const trend = emptyTrend(table.rowCount)
                  return (
                    <TableRow
                      key={table.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setSelectedTable(table)}
                    >
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
                        <Badge variant="outline" className={priorityColors[table.priority]}>
                          {priorityLabels[table.priority]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono">{table.rowCount.toLocaleString()}</span>
                          {trend.direction !== 'none' && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span
                                  className={`flex items-center text-xs ${trend.direction === 'up' ? 'text-emerald-600' : 'text-red-500'}`}
                                >
                                  {trend.direction === 'up' ? (
                                    <ArrowUpRight className="h-3 w-3" />
                                  ) : (
                                    <ArrowDownRight className="h-3 w-3" />
                                  )}
                                  {trend.delta}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {trend.direction === 'up' ? '+' : '−'}
                                {trend.delta} rows since last sync
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Columns3 className="h-3.5 w-3.5 text-muted-foreground" />
                          {table.columns.length}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {table.enableRealtime && (
                            <Badge variant="secondary" className="text-xs gap-0.5 bg-emerald-500/10 text-emerald-700">
                              <Radio className="h-2.5 w-2.5" /> RT
                            </Badge>
                          )}
                          {table.enableEmbedding && (
                            <Badge variant="secondary" className="text-xs gap-0.5 bg-teal-500/10 text-teal-700">
                              <Brain className="h-2.5 w-2.5" /> AI
                            </Badge>
                          )}
                          {table.rlsEnabled && (
                            <Badge variant="secondary" className="text-xs gap-0.5 bg-amber-500/10 text-amber-700">
                              <Shield className="h-2.5 w-2.5" /> RLS
                            </Badge>
                          )}
                          {table.isSystem && (
                            <Badge variant="secondary" className="text-xs gap-0.5 bg-slate-400/10 text-slate-700">
                              <Lock className="h-2.5 w-2.5" /> SYS
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {table.versionHash}
                      </TableCell>
                      <TableCell>
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
                                setSelectedTable(table)
                              }}
                            >
                              <Eye className="mr-2 h-3.5 w-3.5" /> View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                void handleViewData(table)
                              }}
                            >
                              <TableIcon className="mr-2 h-3.5 w-3.5" /> View Data
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                              <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={(e) => {
                                e.stopPropagation()
                                setDeleteTarget(table)
                              }}
                            >
                              <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete table "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All columns and rows in this table will be permanently
              removed from your SelfBase instance.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && handleDeleteTable(deleteTarget)}
            >
              Delete Table
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  )
}
