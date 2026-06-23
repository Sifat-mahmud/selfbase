'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
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
  ArrowUp,
  ArrowDown,
  Download,
  Upload,
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
  Check,
  X,
  Loader2,
  Sparkles,
  ArrowRight,
  Hash,
  Rows3,
  GripVertical,
  Type,
  ToggleLeft,
  Calendar,
  Braces,
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
import { Checkbox } from '@/components/ui/checkbox'
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

const typeColorMap: Record<string, string> = {
  TEXT: 'border-l-emerald-500',
  INTEGER: 'border-l-amber-500',
  DECIMAL: 'border-l-amber-500',
  BOOLEAN: 'border-l-teal-500',
  TIMESTAMP: 'border-l-cyan-500',
  JSON: 'border-l-purple-500',
}

const typeBadgeColors: Record<string, string> = {
  TEXT: 'bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800',
  INTEGER: 'bg-amber-500/10 text-amber-700 border-amber-200 dark:text-amber-400 dark:border-amber-800',
  DECIMAL: 'bg-amber-500/10 text-amber-700 border-amber-200 dark:text-amber-400 dark:border-amber-800',
  BOOLEAN: 'bg-teal-500/10 text-teal-700 border-teal-200 dark:text-teal-400 dark:border-teal-800',
  TIMESTAMP: 'bg-cyan-500/10 text-cyan-700 border-cyan-200 dark:text-cyan-400 dark:border-cyan-800',
  JSON: 'bg-purple-500/10 text-purple-700 border-purple-200 dark:text-purple-400 dark:border-purple-800',
}

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  TEXT: Type,
  INTEGER: Hash,
  DECIMAL: Hash,
  BOOLEAN: ToggleLeft,
  TIMESTAMP: Calendar,
  JSON: Braces,
}

const columnSuggestions = [
  'id', 'name', 'email', 'status', 'created_at', 'updated_at',
  'description', 'title', 'type', 'value', 'count', 'is_active',
  'deleted_at', 'slug', 'url', 'image', 'price', 'quantity',
  'category', 'tags', 'metadata', 'priority', 'order', 'parent_id',
]

const emptyTrend = (rowCount: number) => {
  // Demo trend derived from row count for visual interest.
  // Real trend would require an API endpoint.
  if (rowCount === 0) return { delta: 0, direction: 'none' as const }
  const delta = Math.round((rowCount % 13) - 5)
  return { delta: Math.abs(delta), direction: delta >= 0 ? ('up' as const) : ('down' as const) }
}

const NEW_ROW_ID = '__new__'

/**
 * Render a type-aware editor cell for inline editing.
 * - BOOLEAN  -> Switch
 * - INTEGER/DECIMAL -> number Input
 * - JSON/TIMESTAMP -> wider Input
 * - TEXT/default  -> Input
 */
function renderCellInput(
  col: ColumnItem,
  value: unknown,
  onChange: (v: unknown) => void,
  disabled?: boolean,
) {
  const typeUpper = col.type.toUpperCase()
  if (typeUpper === 'BOOLEAN') {
    return (
      <Switch
        checked={Boolean(value)}
        onCheckedChange={(v) => onChange(v)}
        disabled={disabled}
        aria-label={col.name}
      />
    )
  }
  if (typeUpper === 'INTEGER' || typeUpper === 'DECIMAL') {
    return (
      <Input
        type="number"
        value={value === null || value === undefined ? '' : String(value)}
        onChange={(e) => {
          const raw = e.target.value
          if (raw === '') {
            onChange(null)
          } else if (typeUpper === 'INTEGER') {
            const n = parseInt(raw, 10)
            onChange(Number.isNaN(n) ? null : n)
          } else {
            const n = parseFloat(raw)
            onChange(Number.isNaN(n) ? null : n)
          }
        }}
        disabled={disabled}
        className="h-8 font-mono text-xs min-w-[80px]"
        aria-label={col.name}
      />
    )
  }
  if (typeUpper === 'JSON' || typeUpper === 'TIMESTAMP') {
    return (
      <Input
        value={value === null || value === undefined ? '' : String(value)}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="h-8 font-mono text-xs min-w-[140px]"
        placeholder={typeUpper === 'JSON' ? '{...}' : '2024-01-01T00:00:00Z'}
        aria-label={col.name}
      />
    )
  }
  return (
    <Input
      value={value === null || value === undefined ? '' : String(value)}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="h-8 font-mono text-xs min-w-[100px]"
      aria-label={col.name}
    />
  )
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
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  // Inline row editing state
  const [editingRowId, setEditingRowId] = useState<string | null>(null) // null | row.id | NEW_ROW_ID
  const [editBuffer, setEditBuffer] = useState<Record<string, unknown>>({})
  const [rowSaving, setRowSaving] = useState(false)
  // Bulk selection state
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set())
  // Row delete confirmation
  const [deleteRowTarget, setDeleteRowTarget] = useState<SbRowItem | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  // View Data dialog: server-side pagination + search
  const [searchQuery, setSearchQuery] = useState('')
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [serverPagination, setServerPagination] = useState<{ total: number; totalPages: number; hasMore: boolean }>({ total: 0, totalPages: 0, hasMore: false })
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  // Import state
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importPreview, setImportPreview] = useState<{ headers: string[]; rows: Record<string, string>[] } | null>(null)
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append')
  const [importColumnMapping, setImportColumnMapping] = useState<Record<string, string>>({})
  const [importing, setImporting] = useState(false)

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
    setEditingRowId(null)
    setEditBuffer({})
    setSelectedRowIds(new Set())
    setSearchQuery('')
    setSortColumn(null)
    setSortDirection('asc')
    setCurrentPage(1)
    setPageSize(50)
    setServerPagination({ total: 0, totalPages: 0, hasMore: false })
    try {
      const data = await apiGet<{ rows: SbRowItem[]; pagination: { total: number; totalPages: number; hasMore: boolean } }>(`/api/tables/${table.id}/rows?page=1&pageSize=50`)
      if (data && 'rows' in data) {
        setDataRows(data.rows)
        setServerPagination(data.pagination)
      } else {
        setDataRows(Array.isArray(data as unknown) ? data as unknown as SbRowItem[] : [])
      }
    } catch (err) {
      toast({ title: 'Failed to load rows', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' })
      setDataRows([])
    } finally {
      setDataLoading(false)
    }
  }

  // Fetch rows with server-side pagination and search
  const fetchRows = useCallback(async (tableId: string, page: number, size: number, search: string) => {
    setDataLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(size) })
      if (search) params.set('search', search)
      const data = await apiGet<{ rows: SbRowItem[]; pagination: { total: number; totalPages: number; hasMore: boolean } }>(`/api/tables/${tableId}/rows?${params}`)
      if (data && 'rows' in data) {
        setDataRows(data.rows)
        setServerPagination(data.pagination)
      } else {
        setDataRows(Array.isArray(data as unknown) ? data as unknown as SbRowItem[] : [])
        setServerPagination({ total: 0, totalPages: 0, hasMore: false })
      }
      setCurrentPage(page)
      setPageSize(size)
    } catch (err) {
      toast({ title: 'Failed to load rows', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' })
    } finally {
      setDataLoading(false)
    }
  }, [toast])

  // Reload rows for the currently selected table
  const refreshRows = useCallback(async () => {
    if (!selectedTable) return
    await fetchRows(selectedTable.id, currentPage, pageSize, searchQuery)
  }, [selectedTable, currentPage, pageSize, searchQuery, fetchRows])

  // Keep the displayed row count in sync after add/delete operations
  const adjustRowCount = useCallback(
    (delta: number) => {
      if (!selectedTable) return
      const newCount = Math.max(0, selectedTable.rowCount + delta)
      setSelectedTable((prev) => (prev ? { ...prev, rowCount: newCount } : prev))
      setTables((prev) =>
        prev.map((t) => (t.id === selectedTable.id ? { ...t, rowCount: newCount } : t)),
      )
    },
    [selectedTable],
  )

  function startEdit(row: SbRowItem) {
    let parsed: Record<string, unknown> = {}
    try {
      parsed = JSON.parse(row.data)
    } catch {
      parsed = {}
    }
    setEditingRowId(row.id)
    setEditBuffer(parsed)
  }

  function cancelEdit() {
    setEditingRowId(null)
    setEditBuffer({})
  }

  async function saveEdit(row: SbRowItem) {
    if (!selectedTable) return
    setRowSaving(true)
    try {
      await apiPut(`/api/tables/${selectedTable.id}/rows/${row.id}`, editBuffer)
      toast({ title: 'Row updated', description: 'Changes saved successfully' })
      setEditingRowId(null)
      setEditBuffer({})
      await refreshRows()
    } catch (e) {
      toast({
        title: 'Update failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setRowSaving(false)
    }
  }

  function startAddRow() {
    if (!selectedTable) return
    const buf: Record<string, unknown> = {}
    selectedTable.columns.forEach((c) => {
      const t = c.type.toUpperCase()
      if (t === 'BOOLEAN') buf[c.name] = false
      else if (t === 'INTEGER' || t === 'DECIMAL') buf[c.name] = null
      else buf[c.name] = ''
    })
    setEditBuffer(buf)
    setEditingRowId(NEW_ROW_ID)
  }

  async function saveNewRow() {
    if (!selectedTable) return
    setRowSaving(true)
    try {
      await apiPost(`/api/tables/${selectedTable.id}/rows`, { data: editBuffer })
      toast({ title: 'Row added', description: 'New row created successfully' })
      setEditingRowId(null)
      setEditBuffer({})
      adjustRowCount(1)
      await refreshRows()
    } catch (e) {
      toast({
        title: 'Add failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setRowSaving(false)
    }
  }

  async function handleDeleteRow(row: SbRowItem) {
    if (!selectedTable) return
    try {
      await apiDelete(`/api/tables/${selectedTable.id}/rows/${row.id}`)
      toast({ title: 'Row deleted', description: 'Row removed successfully' })
      setSelectedRowIds((prev) => {
        const next = new Set(prev)
        next.delete(row.id)
        return next
      })
      adjustRowCount(-1)
      await refreshRows()
    } catch (e) {
      toast({
        title: 'Delete failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setDeleteRowTarget(null)
    }
  }

  async function handleBulkDelete() {
    if (!selectedTable || selectedRowIds.size === 0) return
    setBulkDeleting(true)
    let okCount = 0
    let failCount = 0
    try {
      const ids = Array.from(selectedRowIds)
      await Promise.all(
        ids.map(async (id) => {
          try {
            await apiDelete(`/api/tables/${selectedTable.id}/rows/${id}`)
            okCount += 1
          } catch {
            failCount += 1
          }
        }),
      )
      if (okCount > 0) adjustRowCount(-okCount)
      setSelectedRowIds(new Set())
      await refreshRows()
      if (failCount === 0) {
        toast({
          title: 'Rows deleted',
          description: `${okCount} row${okCount !== 1 ? 's' : ''} removed`,
        })
      } else {
        toast({
          title: 'Bulk delete partial',
          description: `${okCount} deleted, ${failCount} failed`,
          variant: 'destructive',
        })
      }
    } finally {
      setBulkDeleting(false)
      setBulkDeleteOpen(false)
    }
  }

  function toggleRowSelection(rowId: string) {
    setSelectedRowIds((prev) => {
      const next = new Set(prev)
      if (next.has(rowId)) next.delete(rowId)
      else next.add(rowId)
      return next
    })
  }

  function toggleSelectAll() {
    setSelectedRowIds((prev) => {
      if (sortedRows.length > 0 && prev.size === sortedRows.length) return new Set()
      return new Set(sortedRows.map((r) => r.id))
    })
  }

  function toggleSort(colName: string) {
    if (sortColumn === colName) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortColumn(colName)
      setSortDirection('asc')
    }
  }

  // Filtered rows: search is now server-side, only apply column filters client-side
  const filteredRows = useMemo(() => {
    return dataRows
  }, [dataRows])

  // Client-side sort: applied after filter
  const sortedRows = useMemo(() => {
    if (!sortColumn) return filteredRows
    return [...filteredRows].sort((a, b) => {
      let av: unknown = undefined
      let bv: unknown = undefined
      try {
        av = JSON.parse(a.data)[sortColumn]
      } catch {
        av = undefined
      }
      try {
        bv = JSON.parse(b.data)[sortColumn]
      } catch {
        bv = undefined
      }
      if (av === null || av === undefined) return 1
      if (bv === null || bv === undefined) return -1
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDirection === 'asc' ? av - bv : bv - av
      }
      const cmp = String(av).localeCompare(String(bv))
      return sortDirection === 'asc' ? cmp : -cmp
    })
  }, [filteredRows, sortColumn, sortDirection])

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function exportData(format: 'csv' | 'json', selectedOnly = false) {
    if (!selectedTable) return
    const rowsToExport = selectedOnly
      ? dataRows.filter((r) => selectedRowIds.has(r.id))
      : dataRows
    const parsedRows = rowsToExport.map((r) => {
      try {
        return JSON.parse(r.data)
      } catch {
        return {}
      }
    })
    const safeName = selectedTable.name.replace(/[^a-z0-9_-]/gi, '_')
    if (format === 'json') {
      const blob = new Blob([JSON.stringify(parsedRows, null, 2)], {
        type: 'application/json',
      })
      downloadBlob(blob, `${safeName}_export.json`)
      toast({
        title: 'Exported JSON',
        description: `${parsedRows.length} row${parsedRows.length !== 1 ? 's' : ''} → ${safeName}_export.json`,
      })
      return
    }
    const headers = selectedTable.columns.map((c) => c.name)
    const csvLines = [headers.join(',')]
    for (const row of parsedRows) {
      const values = headers.map((h) => {
        const v = row[h]
        if (v === null || v === undefined) return ''
        const s = String(v)
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
          return `"${s.replace(/"/g, '""')}"`
        }
        return s
      })
      csvLines.push(values.join(','))
    }
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv' })
    downloadBlob(blob, `${safeName}_export.csv`)
    toast({
      title: 'Exported CSV',
      description: `${parsedRows.length} row${parsedRows.length !== 1 ? 's' : ''} → ${safeName}_export.csv`,
    })
  }

  async function exportFromDetail(format: 'csv' | 'json') {
    if (!selectedTable) return
    try {
      const rows = await apiGet<SbRowItem[]>(`/api/tables/${selectedTable.id}/rows`)
      const rowsArr = Array.isArray(rows) ? rows : []
      // Temporarily set data rows for the export function
      const prevRows = dataRows
      setDataRows(rowsArr)
      // Use a micro-task to let React process the state update
      await new Promise((r) => setTimeout(r, 0))
      exportData(format)
      setDataRows(prevRows)
    } catch (err) {
      toast({
        title: 'Export failed',
        description: err instanceof Error ? err.message : 'Failed to load data for export',
        variant: 'destructive',
      })
    }
  }

  // --- Import helpers ---
  function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
    const lines = text.split(/\r?\n/).filter((l) => l.trim())
    if (lines.length === 0) return { headers: [], rows: [] }
    // Simple CSV parser (handles quoted fields)
    function splitLine(line: string): string[] {
      const result: string[] = []
      let current = ''
      let inQuotes = false
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (inQuotes) {
          if (ch === '"' && line[i + 1] === '"') { current += '"'; i++ }
          else if (ch === '"') { inQuotes = false }
          else { current += ch }
        } else {
          if (ch === '"') { inQuotes = true }
          else if (ch === ',') { result.push(current); current = '' }
          else { current += ch }
        }
      }
      result.push(current)
      return result
    }
    const headers = splitLine(lines[0])
    const rows = lines.slice(1).map((line) => {
      const vals = splitLine(line)
      const obj: Record<string, string> = {}
      headers.forEach((h, i) => { obj[h] = vals[i] ?? '' })
      return obj
    })
    return { headers, rows }
  }

  async function handleImportFile(file: File) {
    setImportFile(file)
    setImportPreview(null)
    setImportColumnMapping({})
    try {
      const text = await file.text()
      let headers: string[] = []
      let rows: Record<string, string>[] = []

      if (file.name.endsWith('.json')) {
        const json = JSON.parse(text)
        const arr = Array.isArray(json) ? json : json.data ?? []
        if (arr.length > 0 && typeof arr[0] === 'object') {
          headers = Object.keys(arr[0])
          rows = arr.slice(0, 100).map((item: Record<string, unknown>) => {
            const obj: Record<string, string> = {}
            headers.forEach((h) => { obj[h] = String(item[h] ?? '') })
            return obj
          })
        }
      } else {
        // CSV
        const parsed = parseCsv(text)
        headers = parsed.headers
        rows = parsed.rows.slice(0, 100)
      }

      setImportPreview({ headers, rows })

      // Auto-map headers to existing columns
      if (selectedTable) {
        const mapping: Record<string, string> = {}
        const colNames = selectedTable.columns.map((c) => c.name.toLowerCase())
        headers.forEach((h) => {
          const lower = h.toLowerCase().replace(/\s+/g, '_')
          if (colNames.includes(lower)) {
            mapping[h] = lower
          }
        })
        setImportColumnMapping(mapping)
      }
    } catch (err) {
      toast({
        title: 'Failed to parse file',
        description: err instanceof Error ? err.message : 'Invalid file format',
        variant: 'destructive',
      })
    }
  }

  async function handleImport() {
    if (!selectedTable || !importPreview) return
    setImporting(true)
    try {
      const colNames = selectedTable.columns.map((c) => c.name)
      const rowsToInsert = importPreview.rows.map((row) => {
        const mapped: Record<string, unknown> = {}
        importPreview.headers.forEach((h) => {
          const target = importColumnMapping[h]
          if (target && colNames.includes(target)) {
            let val: unknown = row[h]
            // Find the column type for coercion
            const col = selectedTable.columns.find((c) => c.name === target)
            if (col) {
              const t = col.type.toUpperCase()
              if (t === 'INTEGER') { const n = parseInt(val as string, 10); val = Number.isNaN(n) ? null : n }
              else if (t === 'DECIMAL') { const n = parseFloat(val as string); val = Number.isNaN(n) ? null : n }
              else if (t === 'BOOLEAN') { val = val === 'true' || val === '1' }
              else if (val === '') val = null
            }
            mapped[target] = val
          }
        })
        return mapped
      }).filter((r) => Object.keys(r).length > 0)

      if (importMode === 'replace') {
        // Delete existing rows first
        const existingRows = await apiGet<SbRowItem[]>(`/api/tables/${selectedTable.id}/rows`)
        const rowsArr = Array.isArray(existingRows) ? existingRows : []
        await Promise.all(rowsArr.map((r) => apiDelete(`/api/tables/${selectedTable.id}/rows/${r.id}`)))
      }

      // Insert rows one by one
      let okCount = 0
      let failCount = 0
      await Promise.all(
        rowsToInsert.map(async (data) => {
          try {
            await apiPost(`/api/tables/${selectedTable.id}/rows`, { data })
            okCount += 1
          } catch {
            failCount += 1
          }
        }),
      )

      toast({
        title: 'Import complete',
        description: `${okCount} row${okCount !== 1 ? 's' : ''} imported${failCount > 0 ? `, ${failCount} failed` : ''}${importMode === 'replace' ? ' (replace mode)' : ''}`,
      })

      // Refresh table data
      await loadTables()
      const fresh = tables.find((t) => t.id === selectedTable.id)
      if (fresh) setSelectedTable(fresh)

      setShowImportDialog(false)
      setImportFile(null)
      setImportPreview(null)
      setImportColumnMapping({})
    } catch (err) {
      toast({
        title: 'Import failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setImporting(false)
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
          <div className="ml-auto flex gap-2 flex-wrap">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="mr-1 h-3.5 w-3.5" /> Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => void exportFromDetail('csv')}>
                  <Download className="mr-2 h-3.5 w-3.5" /> Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void exportFromDetail('json')}>
                  <Download className="mr-2 h-3.5 w-3.5" /> Export as JSON
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" onClick={() => { setShowImportDialog(true); setImportFile(null); setImportPreview(null); setImportColumnMapping({}) }}>
              <Upload className="mr-1 h-3.5 w-3.5" /> Import
            </Button>
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
              <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
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
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add Column</DialogTitle>
                  <DialogDescription>Add a new column to {selectedTable.name}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  {/* Live Preview Card */}
                  {newColumnName.trim() && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <Label className="text-xs text-muted-foreground mb-1.5 block">Preview</Label>
                      <div className={`rounded-lg border border-l-4 p-3 ${typeColorMap[newColumnType] ?? 'border-l-emerald-500'} bg-card`}>
                        <div className="flex items-center gap-2">
                          <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40" />
                          <span className="font-mono font-medium text-sm">{newColumnName.trim().toLowerCase().replace(/\s+/g, '_')}</span>
                          <Badge variant="outline" className={`font-mono text-xs ${typeBadgeColors[newColumnType] ?? ''}`}>
                            {newColumnType}
                          </Badge>
                        </div>
                      </div>
                    </motion.div>
                  )}
                  <div className="space-y-2">
                    <Label>Column Name</Label>
                    <Input
                      value={newColumnName}
                      onChange={(e) => setNewColumnName(e.target.value)}
                      placeholder="column_name"
                    />
                    {/* Auto-suggest */}
                    {newColumnName.trim() && !columnSuggestions.includes(newColumnName.trim().toLowerCase()) && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {columnSuggestions
                          .filter((s) => s.includes(newColumnName.trim().toLowerCase()) || newColumnName.trim().toLowerCase().includes(s.slice(0, 3)))
                          .slice(0, 5)
                          .map((s) => (
                            <button
                              key={s}
                              type="button"
                              className="rounded border px-2 py-0.5 text-xs font-mono text-muted-foreground hover:bg-muted transition-colors"
                              onClick={() => setNewColumnName(s)}
                            >
                              {s}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={newColumnType} onValueChange={setNewColumnType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {columnTypes.map((t) => {
                          const Icon = typeIcons[t]
                          return (
                            <SelectItem key={t} value={t}>
                              <span className="flex items-center gap-2">
                                {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
                                {t}
                              </span>
                            </SelectItem>
                          )
                        })}
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
            {/* Schema Stats Bar */}
            {selectedTable.columns.length > 0 && (
              <div className="mb-4 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  {selectedTable.columns.length} column{selectedTable.columns.length !== 1 ? 's' : ''}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-cyan-500" />
                  {selectedTable.columns.filter((c) => c.isIndexed).length} indexed
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  {selectedTable.columns.filter((c) => c.isUnique).length} unique
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-rose-500" />
                  {selectedTable.columns.filter((c) => c.isPrimaryKey).length} primary key
                </span>
              </div>
            )}

            {selectedTable.columns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Columns3 className="h-10 w-10 mb-2 opacity-40" />
                <p className="text-sm">No columns defined yet</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => setShowColumnDialog(true)}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add first column
                </Button>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {selectedTable.columns.map((col, i) => {
                  const borderClass = typeColorMap[col.type.toUpperCase()] ?? 'border-l-emerald-500'
                  const badgeClass = typeBadgeColors[col.type.toUpperCase()] ?? ''
                  const TypeIcon = typeIcons[col.type.toUpperCase()]
                  return (
                    <motion.div
                      key={col.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.15, delay: i * 0.03 }}
                      className={`group relative rounded-lg border border-l-4 bg-card p-3 transition-all hover:bg-muted/30 hover:-translate-y-0.5 hover:shadow-md ${borderClass}`}
                    >
                      <div className="flex items-start gap-2">
                        <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/30" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-medium text-sm truncate">{col.name}</span>
                            <Badge variant="outline" className={`font-mono text-[10px] px-1.5 py-0 ${badgeClass}`}>
                              {TypeIcon && <TypeIcon className="mr-1 h-2.5 w-2.5" />}
                              {col.type}
                            </Badge>
                          </div>
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {col.isPrimaryKey && (
                              <span className="inline-flex items-center rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-medium text-rose-600 dark:text-rose-400">PK</span>
                            )}
                            {col.isUnique && (
                              <span className="inline-flex items-center rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">Unique</span>
                            )}
                            {col.isIndexed && (
                              <span className="inline-flex items-center rounded bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-medium text-cyan-600 dark:text-cyan-400">Indexed</span>
                            )}
                            {col.nullable && (
                              <span className="inline-flex items-center rounded bg-slate-500/10 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:text-slate-400">Nullable</span>
                            )}
                            {col.defaultValue !== null && (
                              <span className="inline-flex items-center rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-mono text-emerald-600 dark:text-emerald-400">= {col.defaultValue}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-6 w-6" title="Edit column">
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10" title="Delete column">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* View Data Dialog */}
        <Dialog
          open={showDataDialog}
          onOpenChange={(open) => {
            setShowDataDialog(open)
            if (!open) {
              setEditingRowId(null)
              setEditBuffer({})
              setSelectedRowIds(new Set())
              setSearchQuery('')
              setSortColumn(null)
              setSortDirection('asc')
            }
          }}
        >
          <DialogContent className="sm:max-w-6xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <TableIcon className="h-4 w-4 text-emerald-600" />
                {selectedTable.name} — Rows
                <Badge variant="secondary" className="ml-1">
                  {dataRows.length} row{dataRows.length !== 1 ? 's' : ''}
                </Badge>
              </DialogTitle>
              <DialogDescription>
                Inline-edit cells, add new rows, or delete with confirmation. Search,
                sort, and export the currently loaded rows client-side.
              </DialogDescription>
              {/* Toolbar: search (flex-1) | Export dropdown | Add Row */}
              <div className="flex items-center gap-2 flex-wrap pt-2">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search all rows (server-side)..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
                      searchTimeoutRef.current = setTimeout(() => {
                        if (selectedTable) fetchRows(selectedTable.id, 1, pageSize, e.target.value)
                      }, 300)
                    }}
                    className="pl-9 h-9 pr-8"
                    aria-label="Search rows"
                  />
                  {dataLoading && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" disabled={dataRows.length === 0}>
                      <Download className="mr-1 h-3.5 w-3.5" /> Export
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem
                      onClick={() => exportData('csv')}
                      disabled={dataRows.length === 0}
                    >
                      <Download className="mr-2 h-3.5 w-3.5" /> Export as CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => exportData('json')}
                      disabled={dataRows.length === 0}
                    >
                      <Download className="mr-2 h-3.5 w-3.5" /> Export as JSON
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => exportData('csv', true)}
                      disabled={selectedRowIds.size === 0}
                    >
                      <Download className="mr-2 h-3.5 w-3.5" /> Export Selected as CSV
                      <span className="ml-auto text-xs text-muted-foreground">
                        {selectedRowIds.size > 0 ? selectedRowIds.size : '—'}
                      </span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => exportData('json', true)}
                      disabled={selectedRowIds.size === 0}
                    >
                      <Download className="mr-2 h-3.5 w-3.5" /> Export Selected as JSON
                      <span className="ml-auto text-xs text-muted-foreground">
                        {selectedRowIds.size > 0 ? selectedRowIds.size : '—'}
                      </span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                {selectedRowIds.size > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => setBulkDeleteOpen(true)}
                    disabled={editingRowId !== null}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete Selected
                    <Badge variant="secondary" className="ml-1.5">
                      {selectedRowIds.size}
                    </Badge>
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() => startAddRow()}
                  disabled={editingRowId !== null}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add Row
                </Button>
              </div>
              {/* Filter / sort status line + server pagination info */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 flex-wrap">
                <span>
                  Showing <span className="font-medium text-foreground">{((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, serverPagination.total)}</span> of{' '}
                  <span className="font-medium text-foreground">{serverPagination.total}</span> row{serverPagination.total !== 1 ? 's' : ''}
                </span>
                {sortColumn && (
                  <Badge variant="outline" className="text-xs gap-1 font-mono">
                    <ArrowUpDown className="h-3 w-3" />
                    {sortColumn}
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                    <button
                      type="button"
                      className="ml-1 text-muted-foreground hover:text-foreground"
                      onClick={() => { setSortColumn(null); setSortDirection('asc') }}
                      aria-label="Clear sort"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {searchQuery.trim() && (
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setSearchQuery('')
                      if (selectedTable) fetchRows(selectedTable.id, 1, pageSize, '')
                    }}
                    aria-label="Clear search"
                  >
                    <X className="h-3 w-3 inline mr-1" />
                    clear search
                  </button>
                )}
              </div>
            </DialogHeader>

            {selectedRowIds.size > 0 && (
              <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-500/5 px-3 py-2 text-sm dark:border-emerald-900 dark:bg-emerald-500/10">
                <span className="font-medium text-emerald-700 dark:text-emerald-400">
                  {selectedRowIds.size} selected
                </span>
                <span className="text-muted-foreground">
                  of {sortedRows.length} visible row{sortedRows.length !== 1 ? 's' : ''}
                  {sortedRows.length !== dataRows.length && (
                    <span className="text-muted-foreground/70"> (filtered from {dataRows.length})</span>
                  )}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto h-7 px-2 text-xs"
                  onClick={() => setSelectedRowIds(new Set())}
                >
                  Clear
                </Button>
              </div>
            )}

            <div className="flex-1 overflow-auto rounded-md border">
              {dataLoading ? (
                <div className="space-y-2 p-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : sortedRows.length === 0 && editingRowId !== NEW_ROW_ID ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Database className="h-10 w-10 mb-2 opacity-40" />
                  <p className="text-sm">
                    {searchQuery.trim() ? 'No rows match your search' : 'No rows yet'}
                  </p>
                  <p className="text-xs">
                    {searchQuery.trim()
                      ? 'Try a different search term or clear the search.'
                      : 'Insert data via the data API or add a row manually.'}
                  </p>
                  {searchQuery.trim() ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => setSearchQuery('')}
                    >
                      <X className="mr-1 h-3.5 w-3.5" /> Clear search
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" className="mt-3" onClick={() => startAddRow()}>
                      <Plus className="mr-1 h-3.5 w-3.5" /> Add first row
                    </Button>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={
                            sortedRows.length > 0 && selectedRowIds.size === sortedRows.length
                          }
                          onCheckedChange={toggleSelectAll}
                          aria-label="Select all rows"
                          disabled={editingRowId !== null || sortedRows.length === 0}
                        />
                      </TableHead>
                      <TableHead className="w-10">#</TableHead>
                      {selectedTable.columns.map((c) => {
                        const isSorted = sortColumn === c.name
                        return (
                          <TableHead key={c.id} className="font-mono text-xs whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => toggleSort(c.name)}
                              className="inline-flex items-center gap-1 rounded hover:text-foreground transition-colors -ml-0.5"
                              aria-label={`Sort by ${c.name}`}
                              title={`${c.name} (${c.type})`}
                            >
                              <span>{c.name}</span>
                              {isSorted ? (
                                sortDirection === 'asc' ? (
                                  <ArrowUp className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                                ) : (
                                  <ArrowDown className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                                )
                              ) : (
                                <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />
                              )}
                            </button>
                          </TableHead>
                        )
                      })}
                      <TableHead className="w-16">Ver</TableHead>
                      <TableHead className="w-20 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {editingRowId === NEW_ROW_ID && (
                      <motion.tr
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.18 }}
                        className="border-b bg-emerald-500/5 hover:bg-emerald-500/10"
                      >
                        <TableCell />
                        <TableCell className="text-emerald-600 font-bold">+</TableCell>
                        {selectedTable.columns.map((c) => (
                          <TableCell key={c.id}>
                            {renderCellInput(c, editBuffer[c.name], (v) =>
                              setEditBuffer((prev) => ({ ...prev, [c.name]: v })),
                            )}
                          </TableCell>
                        ))}
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="text-xs text-emerald-600 border-emerald-300 dark:border-emerald-800"
                          >
                            new
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-emerald-600 hover:bg-emerald-500/10"
                              onClick={() => void saveNewRow()}
                              disabled={rowSaving}
                              title="Save new row"
                              aria-label="Save new row"
                            >
                              {rowSaving ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Check className="h-3.5 w-3.5" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => cancelEdit()}
                              disabled={rowSaving}
                              title="Cancel"
                              aria-label="Cancel add row"
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </motion.tr>
                    )}
                    {sortedRows.map((row, i) => {
                      let parsed: Record<string, unknown> = {}
                      try {
                        parsed = JSON.parse(row.data)
                      } catch {
                        parsed = {}
                      }
                      const isEditing = editingRowId === row.id
                      const isSelected = selectedRowIds.has(row.id)
                      return (
                        <motion.tr
                          key={row.id}
                          initial={false}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className={`border-b transition-colors duration-200 hover:bg-muted/40 ${
                            isEditing
                              ? 'bg-emerald-500/10 dark:bg-emerald-500/15'
                              : isSelected
                                ? 'bg-muted/50'
                                : ''
                          }`}
                        >
                          <TableCell>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleRowSelection(row.id)}
                              aria-label={`Select row ${i + 1}`}
                              disabled={isEditing || editingRowId !== null}
                            />
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                          {selectedTable.columns.map((c) => (
                            <TableCell key={c.id} className="font-mono text-xs whitespace-nowrap max-w-[180px] truncate" title={isEditing ? undefined : String(parsed[c.name] ?? '')}>
                              {isEditing ? (
                                renderCellInput(c, editBuffer[c.name], (v) =>
                                  setEditBuffer((prev) => ({ ...prev, [c.name]: v })),
                                )
                              ) : parsed[c.name] !== undefined && parsed[c.name] !== null ? (
                                c.type.toUpperCase() === 'BOOLEAN' ? (
                                  <Badge variant={parsed[c.name] ? 'default' : 'secondary'} className={`text-[10px] px-1.5 py-0 ${parsed[c.name] ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' : ''}`}>
                                    {parsed[c.name] ? '✓ true' : '✗ false'}
                                  </Badge>
                                ) : (
                                  String(parsed[c.name]).slice(0, 60)
                                )
                              ) : (
                                <span className="text-muted-foreground/40">—</span>
                              )}
                            </TableCell>
                          ))}
                          <TableCell className="text-muted-foreground text-[10px] font-mono">
                            v{row.version}
                          </TableCell>
                          <TableCell className="text-right">
                            {isEditing ? (
                              <div className="flex justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-emerald-600 hover:bg-emerald-500/10"
                                  onClick={() => void saveEdit(row)}
                                  disabled={rowSaving}
                                  title="Save changes"
                                  aria-label="Save changes"
                                >
                                  {rowSaving ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Check className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0"
                                  onClick={() => cancelEdit()}
                                  disabled={rowSaving}
                                  title="Cancel edit"
                                  aria-label="Cancel edit"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0"
                                  onClick={() => startEdit(row)}
                                  disabled={editingRowId !== null}
                                  title="Edit row"
                                  aria-label={`Edit row ${i + 1}`}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                                  onClick={() => setDeleteRowTarget(row)}
                                  disabled={editingRowId !== null}
                                  title="Delete row"
                                  aria-label={`Delete row ${i + 1}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </motion.tr>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
              {/* Server-side pagination controls */}
              {serverPagination.total > 0 && (
                <div className="flex items-center justify-between border-t px-3 py-2 bg-muted/30">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Rows:</span>
                    {[25, 50, 100, 250, 500].map(size => (
                      <Button
                        key={size}
                        variant={pageSize === size ? 'default' : 'ghost'}
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => { if (selectedTable) fetchRows(selectedTable.id, 1, size, searchQuery) }}
                      >
                        {size}
                      </Button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline" size="sm" className="h-7 px-2 text-xs"
                      disabled={currentPage <= 1 || dataLoading}
                      onClick={() => { if (selectedTable) fetchRows(selectedTable.id, currentPage - 1, pageSize, searchQuery) }}
                    >
                      Prev
                    </Button>
                    <span className="text-xs text-muted-foreground px-2">
                      {currentPage} / {serverPagination.totalPages || 1}
                    </span>
                    <Button
                      variant="outline" size="sm" className="h-7 px-2 text-xs"
                      disabled={!serverPagination.hasMore || dataLoading}
                      onClick={() => { if (selectedTable) fetchRows(selectedTable.id, currentPage + 1, pageSize, searchQuery) }}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Row Delete Confirmation */}
        <AlertDialog
          open={!!deleteRowTarget}
          onOpenChange={(open) => !open && setDeleteRowTarget(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this row?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. The row will be permanently removed from
                {' '}{selectedTable?.name}. Row version{' '}
                <span className="font-mono">v{deleteRowTarget?.version}</span> will be discarded.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deleteRowTarget && void handleDeleteRow(deleteRowTarget)}
              >
                Delete Row
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Bulk Delete Confirmation */}
        <AlertDialog
          open={bulkDeleteOpen}
          onOpenChange={(open) => !open && !bulkDeleting && setBulkDeleteOpen(false)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {selectedRowIds.size} selected row{selectedRowIds.size !== 1 ? 's' : ''}?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. All {selectedRowIds.size} selected rows in
                {' '}{selectedTable?.name} will be permanently removed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={bulkDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={bulkDeleting}
                onClick={() => void handleBulkDelete()}
              >
                {bulkDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...
                  </>
                ) : (
                  `Delete ${selectedRowIds.size} Row${selectedRowIds.size !== 1 ? 's' : ''}`
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

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

        {/* Import Dialog */}
        <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Upload className="h-4 w-4 text-emerald-600" /> Import Data
              </DialogTitle>
              <DialogDescription>
                Import data from CSV or JSON files into {selectedTable.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {/* File input */}
              <div className="space-y-2">
                <Label>Choose File</Label>
                <Input
                  type="file"
                  accept=".csv,.json"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) void handleImportFile(f)
                  }}
                  className="cursor-pointer"
                />
                {importFile && (
                  <p className="text-xs text-muted-foreground">
                    Selected: <span className="font-mono">{importFile.name}</span> ({(importFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>

              {/* Preview */}
              {importPreview && importPreview.rows.length > 0 && (
                <div className="space-y-2">
                  <Label>Preview (first {Math.min(importPreview.rows.length, 5)} rows)</Label>
                  <div className="max-h-48 overflow-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {importPreview.headers.map((h) => (
                            <TableHead key={h} className="font-mono text-xs">{h}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importPreview.rows.slice(0, 5).map((row, i) => (
                          <TableRow key={i}>
                            {importPreview.headers.map((h) => (
                              <TableCell key={h} className="font-mono text-xs max-w-[120px] truncate">{row[h]}</TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Column Mapping */}
              {importPreview && importPreview.headers.length > 0 && (
                <div className="space-y-2">
                  <Label>Column Mapping</Label>
                  <div className="grid gap-2">
                    {importPreview.headers.map((h) => (
                      <div key={h} className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground w-32 truncate">{h}</span>
                        <span className="text-muted-foreground">→</span>
                        <Select
                          value={importColumnMapping[h] ?? ''}
                          onValueChange={(v) => {
                            setImportColumnMapping((prev) => ({
                              ...prev,
                              [h]: v === '__skip__' ? '' : v,
                            }))
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Skip column" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__skip__">— Skip —</SelectItem>
                            {selectedTable.columns.map((c) => (
                              <SelectItem key={c.id} value={c.name}>
                                <span className="flex items-center gap-1">
                                  <span className="font-mono">{c.name}</span>
                                  <span className="text-muted-foreground">({c.type})</span>
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Import Mode */}
              <div className="space-y-2">
                <Label>Import Mode</Label>
                <Select value={importMode} onValueChange={(v) => setImportMode(v as 'append' | 'replace')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="append">Append — Add rows to existing data</SelectItem>
                    <SelectItem value="replace">Replace — Clear all rows, then import</SelectItem>
                  </SelectContent>
                </Select>
                {importMode === 'replace' && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    ⚠ Replace mode will delete all existing rows before importing.
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowImportDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => void handleImport()}
                disabled={!importPreview || importing || Object.values(importColumnMapping).every((v) => !v)}
              >
                {importing ? (
                  <>
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> Importing...
                  </>
                ) : (
                  <>
                    <Upload className="mr-1 h-3.5 w-3.5" /> Import
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
          <DialogContent className="sm:max-w-3xl">
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
                        <TableHead className="text-xs">Column Name</TableHead>
                        <TableHead className="text-xs">Data Type</TableHead>
                        <TableHead className="text-xs text-center">Nullable</TableHead>
                        <TableHead className="text-xs text-center">Unique</TableHead>
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
                              placeholder="column_name"
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
                          <TableCell className="text-center">
                            <Checkbox
                              checked={col.nullable}
                              onCheckedChange={(v) =>
                                setNewColumns((prev) =>
                                  prev.map((c, idx) => (idx === i ? { ...c, nullable: !!v } : c)),
                                )
                              }
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={col.isUnique}
                              onCheckedChange={(v) =>
                                setNewColumns((prev) =>
                                  prev.map((c, idx) => (idx === i ? { ...c, isUnique: !!v } : c)),
                                )
                              }
                            />
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

      {/* Quick Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
          <div className="rounded-md bg-emerald-500/10 p-2">
            <Database className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Total Tables</div>
            <div className="text-lg font-bold tabular-nums">{tables.length}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
          <div className="rounded-md bg-teal-500/10 p-2">
            <Rows3 className="h-4 w-4 text-teal-600" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Total Rows</div>
            <div className="text-lg font-bold tabular-nums">{tables.reduce((s, t) => s + t.rowCount, 0).toLocaleString()}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
          <div className="rounded-md bg-amber-500/10 p-2">
            <Columns3 className="h-4 w-4 text-amber-600" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Total Columns</div>
            <div className="text-lg font-bold tabular-nums">{tables.reduce((s, t) => s + t.columns.length, 0).toLocaleString()}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
          <div className="rounded-md bg-rose-500/10 p-2">
            <Hash className="h-4 w-4 text-rose-600" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Avg Rows/Table</div>
            <div className="text-lg font-bold tabular-nums">{tables.length > 0 ? Math.round(tables.reduce((s, t) => s + t.rowCount, 0) / tables.length).toLocaleString() : '0'}</div>
          </div>
        </div>
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
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <div className="rounded-2xl border-2 border-dashed border-muted-foreground/20 p-8 flex flex-col items-center">
                <div className="rounded-xl bg-gradient-to-br from-emerald-500/10 via-teal-500/10 to-amber-500/10 p-4 mb-4">
                  <Database className="h-12 w-12 text-emerald-500/60" />
                </div>
                <p className="text-lg font-semibold text-foreground">No tables found</p>
                <p className="text-sm mt-1.5 max-w-xs text-center">
                  {tables.length === 0
                    ? 'Create your first table to start storing and managing your data.'
                    : 'Try adjusting your search to find what you\'re looking for.'}
                </p>
                {tables.length === 0 && (
                  <Button className="mt-5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white" onClick={() => setShowCreateDialog(true)}>
                    <Sparkles className="mr-1.5 h-4 w-4" /> Create Table
                  </Button>
                )}
              </div>
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
                      className="cursor-pointer hover:bg-muted/50 hover:shadow-sm transition-all duration-200 group"
                      onClick={() => setSelectedTable(table)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Database className="h-4 w-4 text-emerald-500" />
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              {table.displayName || table.name}
                              <Badge variant="outline" className="text-lg font-bold tabular-nums border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400">{table.rowCount}</Badge>
                            </div>
                            <div className="text-xs text-muted-foreground font-mono">{table.name}</div>
                          </div>
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
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
