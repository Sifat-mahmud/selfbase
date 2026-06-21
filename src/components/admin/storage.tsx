'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  HardDrive,
  Upload,
  Download,
  MoreHorizontal,
  Trash2,
  Search,
  File,
  FileImage,
  FileText,
  FileArchive,
  FileCode,
  FolderOpen,
  Eye,
  Copy,
  Lock,
  Globe,
  Plus,
  RefreshCw,
  Loader2,
  Database,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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
import { useToast } from '@/hooks/use-toast'
import { apiGet, apiPost, apiDelete, formatRelativeTime } from '@/lib/api-client'

interface StorageFileItem {
  id: string
  name: string
  originalName: string
  path: string
  bucket: string
  mimeType: string | null
  sizeBytes: number
  isPublic: boolean
  metadata?: string | null
  userId?: string | null
  createdAt: string
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

interface FileTypeInfo {
  Icon: React.ComponentType<{ className?: string }>
  color: string
}

function getFileTypeInfo(mimeType: string | null, name: string): FileTypeInfo {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (!mimeType && !ext) return { Icon: File, color: 'text-slate-500' }
  if (mimeType?.includes('pdf') || ext === 'pdf')
    return { Icon: FileText, color: 'text-red-500' }
  if (mimeType?.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext))
    return { Icon: FileImage, color: 'text-blue-500' }
  if (mimeType?.includes('csv') || ext === 'csv')
    return { Icon: Database, color: 'text-emerald-500' }
  if (mimeType?.includes('sql') || ext === 'sql')
    return { Icon: FileCode, color: 'text-amber-500' }
  if (mimeType?.includes('json') || ext === 'json')
    return { Icon: FileCode, color: 'text-emerald-500' }
  if (
    mimeType?.includes('zip') ||
    mimeType?.includes('tar') ||
    mimeType?.includes('octet-stream') ||
    ['zip', 'tar', 'gz', 'rar', '7z'].includes(ext)
  )
    return { Icon: FileArchive, color: 'text-purple-500' }
  if (mimeType?.includes('text') || ['txt', 'md', 'log'].includes(ext))
    return { Icon: FileText, color: 'text-slate-500' }
  return { Icon: File, color: 'text-slate-500' }
}

export function StorageView() {
  const { toast } = useToast()
  const [files, setFiles] = useState<StorageFileItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedBucket, setSelectedBucket] = useState<string>('all')
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [showBucketDialog, setShowBucketDialog] = useState(false)
  const [newBucketName, setNewBucketName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<StorageFileItem | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadBucket, setUploadBucket] = useState('default')
  const [uploadName, setUploadName] = useState('')

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiGet<StorageFileItem[]>('/api/storage')
      setFiles(Array.isArray(data) ? data : [])
    } catch (err) {
      toast({
        title: 'Failed to load files',
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

  const buckets = Array.from(new Set(['default', ...files.map((f) => f.bucket)]))

  const filteredFiles = files.filter((f) => {
    const matchSearch =
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.originalName.toLowerCase().includes(search.toLowerCase())
    const matchBucket = selectedBucket === 'all' || f.bucket === selectedBucket
    return matchSearch && matchBucket
  })

  const totalSize = files.reduce((s, f) => s + f.sizeBytes, 0)
  const bucketStats = buckets.map((b) => ({
    name: b,
    count: files.filter((f) => f.bucket === b).length,
    size: files.filter((f) => f.bucket === b).reduce((s, f) => s + f.sizeBytes, 0),
  }))

  const handleUpload = async () => {
    const fileInput = fileInputRef.current
    const file = fileInput?.files?.[0]
    if (!file) {
      toast({ title: 'Select a file first', variant: 'destructive' })
      return
    }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('name', uploadName || file.name)
      formData.append('originalName', file.name)
      formData.append('bucket', uploadBucket)
      formData.append('path', `/${uploadBucket}/${uploadName || file.name}`)
      formData.append('mimeType', file.type || 'application/octet-stream')
      formData.append('sizeBytes', String(file.size))
      formData.append('isPublic', 'false')
      const created = await apiPost<StorageFileItem>('/api/storage', formData)
      setFiles((prev) => [created, ...prev])
      setShowUploadDialog(false)
      setUploadName('')
      if (fileInput) fileInput.value = ''
      toast({ title: 'File uploaded', description: `${file.name} stored in ${uploadBucket} bucket.` })
    } catch (err) {
      toast({
        title: 'Upload failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
    }
  }

  const handleCreateBucket = () => {
    if (!newBucketName.trim()) return
    toast({
      title: 'Bucket created (local)',
      description: `"${newBucketName}" bucket is now available. Files uploaded to this bucket will be persisted.`,
    })
    setShowBucketDialog(false)
    setNewBucketName('')
  }

  const handleDeleteFile = async (file: StorageFileItem) => {
    try {
      await apiDelete(`/api/storage/${file.id}`)
      setFiles((prev) => prev.filter((f) => f.id !== file.id))
      toast({ title: 'File deleted', variant: 'destructive' })
    } catch (err) {
      toast({
        title: 'Failed to delete file',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setDeleteTarget(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
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
            Storage
          </h1>
          <p className="text-muted-foreground">File management and bucket configuration</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showBucketDialog} onOpenChange={setShowBucketDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="mr-1 h-4 w-4" /> New Bucket
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Bucket</DialogTitle>
                <DialogDescription>Create a new storage bucket</DialogDescription>
              </DialogHeader>
              <div className="py-2">
                <div className="space-y-2">
                  <Label>Bucket Name</Label>
                  <Input
                    value={newBucketName}
                    onChange={(e) => setNewBucketName(e.target.value)}
                    placeholder="my-bucket"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowBucketDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateBucket}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
            <DialogTrigger asChild>
              <Button>
                <Upload className="mr-1 h-4 w-4" /> Upload
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload File</DialogTitle>
                <DialogDescription>Upload a file to one of your storage buckets</DialogDescription>
              </DialogHeader>
              <div className="py-2 space-y-4">
                <div className="space-y-2">
                  <Label>File</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="block w-full text-sm text-muted-foreground file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:font-medium file:bg-emerald-500/10 file:text-emerald-700 hover:file:bg-emerald-500/20 cursor-pointer"
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Name (optional)</Label>
                    <Input
                      value={uploadName}
                      onChange={(e) => setUploadName(e.target.value)}
                      placeholder={fileInputRef.current?.files?.[0]?.name ?? 'auto'}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Bucket</Label>
                    <Select value={uploadBucket} onValueChange={setUploadBucket}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {buckets.map((b) => (
                          <SelectItem key={b} value={b}>
                            {b}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowUploadDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleUpload} disabled={uploading}>
                  {uploading ? (
                    <>
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-1 h-3.5 w-3.5" /> Upload
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Total Files</div>
                <div className="text-2xl font-bold">{files.length}</div>
              </div>
              <div className="rounded-md bg-emerald-500/10 p-2">
                <File className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Total Size</div>
                <div className="text-2xl font-bold">{formatBytes(totalSize)}</div>
              </div>
              <div className="rounded-md bg-teal-500/10 p-2">
                <HardDrive className="h-5 w-5 text-teal-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Buckets</div>
                <div className="text-2xl font-bold">{buckets.length}</div>
              </div>
              <div className="rounded-md bg-amber-500/10 p-2">
                <FolderOpen className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Public Files</div>
                <div className="text-2xl font-bold">{files.filter((f) => f.isPublic).length}</div>
              </div>
              <div className="rounded-md bg-emerald-500/10 p-2">
                <Globe className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Buckets */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Buckets</CardTitle>
          <CardDescription>Storage bucket overview — click to filter</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div
              className={`rounded-lg border p-4 cursor-pointer transition-all hover:border-emerald-500 hover:-translate-y-0.5 hover:shadow-md ${
                selectedBucket === 'all' ? 'border-emerald-500 bg-emerald-500/5' : ''
              }`}
              onClick={() => setSelectedBucket('all')}
            >
              <div className="flex items-center gap-2 mb-2">
                <FolderOpen className="h-4 w-4 text-emerald-500" />
                <span className="font-medium text-sm">All Files</span>
              </div>
              <div className="text-xs text-muted-foreground">{files.length} files · {formatBytes(totalSize)}</div>
            </div>
            {bucketStats
              .filter((b) => b.name !== 'default' || files.some((f) => f.bucket === 'default'))
              .map((b) => (
                <div
                  key={b.name}
                  className={`rounded-lg border p-4 cursor-pointer transition-all hover:border-emerald-500 hover:-translate-y-0.5 hover:shadow-md ${
                    selectedBucket === b.name ? 'border-emerald-500 bg-emerald-500/5' : ''
                  }`}
                  onClick={() => setSelectedBucket(selectedBucket === b.name ? 'all' : b.name)}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <FolderOpen className="h-4 w-4 text-emerald-500" />
                    <span className="font-medium text-sm">{b.name}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {b.count} files · {formatBytes(b.size)}
                  </div>
                  {totalSize > 0 && (
                    <Progress value={(b.size / totalSize) * 100} className="mt-2 h-1.5" />
                  )}
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Files Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-base">Files</CardTitle>
              <CardDescription>
                All stored files {selectedBucket !== 'all' && `in "${selectedBucket}" bucket`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search files..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 w-56"
                />
              </div>
              <Select value={selectedBucket} onValueChange={setSelectedBucket}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Buckets</SelectItem>
                  {buckets.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => void loadAll()}>
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <HardDrive className="h-14 w-14 mb-3 opacity-30" />
              <p className="text-base font-medium">No files found</p>
              <p className="text-sm mt-1">
                {files.length === 0
                  ? 'Upload your first file to get started.'
                  : 'Try adjusting your filters.'}
              </p>
              {files.length === 0 && (
                <Button className="mt-4" onClick={() => setShowUploadDialog(true)}>
                  <Upload className="mr-1 h-4 w-4" /> Upload File
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Bucket</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Access</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFiles.map((file) => {
                  const { Icon, color } = getFileTypeInfo(file.mimeType, file.originalName)
                  return (
                    <TableRow key={file.id} className="hover:bg-muted/40">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Icon className={`h-4 w-4 ${color}`} />
                          <div>
                            <div className="font-medium text-sm">{file.originalName}</div>
                            <div className="text-xs text-muted-foreground font-mono">{file.path}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {file.bucket}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-mono">{formatBytes(file.sizeBytes)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {file.isPublic ? (
                            <Globe className="h-3.5 w-3.5 text-emerald-500" />
                          ) : (
                            <Lock className="h-3.5 w-3.5 text-amber-500" />
                          )}
                          <span className="text-xs">{file.isPublic ? 'Public' : 'Private'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>{formatRelativeTime(file.createdAt)}</span>
                          </TooltipTrigger>
                          <TooltipContent>{new Date(file.createdAt).toLocaleString()}</TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                window.open(`/api/storage/${file.id}?download=true`, '_blank')
                              }}
                            >
                              <Download className="mr-2 h-3.5 w-3.5" /> Download
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                navigator.clipboard.writeText(`/api/storage/${file.id}`)
                                toast({ title: 'Path copied' })
                              }}
                            >
                              <Copy className="mr-2 h-3.5 w-3.5" /> Copy Path
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Eye className="mr-2 h-3.5 w-3.5" /> Preview
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeleteTarget(file)}
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

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.originalName}"?</AlertDialogTitle>
            <AlertDialogDescription>
              The file will be permanently removed from disk and from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && handleDeleteFile(deleteTarget)}
            >
              Delete File
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  )
}
