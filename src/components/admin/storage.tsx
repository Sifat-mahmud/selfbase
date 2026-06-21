'use client'

import { useState, useEffect } from 'react'
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
  FolderOpen,
  Eye,
  Copy,
  Lock,
  Globe,
  Plus,
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
import { useToast } from '@/hooks/use-toast'

interface StorageFileItem {
  id: string
  name: string
  originalName: string
  path: string
  bucket: string
  mimeType: string | null
  sizeBytes: number
  isPublic: boolean
  createdAt: string
}

const buckets = ['default', 'uploads', 'assets', 'backups']

const mockFiles: StorageFileItem[] = [
  { id: '1', name: 'logo.svg', originalName: 'logo.svg', path: '/default/logo.svg', bucket: 'default', mimeType: 'image/svg+xml', sizeBytes: 4200, isPublic: true, createdAt: '2025-01-15' },
  { id: '2', name: 'report-2025.pdf', originalName: 'report-2025.pdf', path: '/uploads/report-2025.pdf', bucket: 'uploads', mimeType: 'application/pdf', sizeBytes: 2450000, isPublic: false, createdAt: '2025-03-20' },
  { id: '3', name: 'data-export.csv', originalName: 'data-export.csv', path: '/backups/data-export.csv', bucket: 'backups', mimeType: 'text/csv', sizeBytes: 1280000, isPublic: false, createdAt: '2025-06-01' },
  { id: '4', name: 'hero-banner.png', originalName: 'hero-banner.png', path: '/assets/hero-banner.png', bucket: 'assets', mimeType: 'image/png', sizeBytes: 3200000, isPublic: true, createdAt: '2025-04-10' },
  { id: '5', name: 'backup-june.db', originalName: 'backup-june.db', path: '/backups/backup-june.db', bucket: 'backups', mimeType: 'application/octet-stream', sizeBytes: 8500000, isPublic: false, createdAt: '2025-06-15' },
  { id: '6', name: 'favicon.ico', originalName: 'favicon.ico', path: '/default/favicon.ico', bucket: 'default', mimeType: 'image/x-icon', sizeBytes: 15000, isPublic: true, createdAt: '2025-01-15' },
]

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function getFileIcon(mimeType: string | null) {
  if (!mimeType) return File
  if (mimeType.startsWith('image/')) return FileImage
  if (mimeType.includes('pdf') || mimeType.includes('text') || mimeType.includes('csv')) return FileText
  if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('octet-stream')) return FileArchive
  return File
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

  useEffect(() => {
    const timer = setTimeout(() => { setFiles(mockFiles); setLoading(false) }, 600)
    return () => clearTimeout(timer)
  }, [])

  const filteredFiles = files.filter((f) => {
    const matchSearch = f.name.toLowerCase().includes(search.toLowerCase()) || f.originalName.toLowerCase().includes(search.toLowerCase())
    const matchBucket = selectedBucket === 'all' || f.bucket === selectedBucket
    return matchSearch && matchBucket
  })

  const totalSize = files.reduce((s, f) => s + f.sizeBytes, 0)
  const bucketStats = buckets.map((b) => ({
    name: b,
    count: files.filter((f) => f.bucket === b).length,
    size: files.filter((f) => f.bucket === b).reduce((s, f) => s + f.sizeBytes, 0),
  }))

  const handleUpload = () => {
    toast({ title: 'Upload started', description: 'Files are being uploaded...' })
    setShowUploadDialog(false)
  }

  const handleCreateBucket = () => {
    if (!newBucketName.trim()) return
    toast({ title: 'Bucket created', description: `"${newBucketName}" bucket has been created.` })
    setShowBucketDialog(false); setNewBucketName('')
  }

  const handleDeleteFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
    toast({ title: 'File deleted', variant: 'destructive' })
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <div className="grid gap-4 md:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>)}</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Storage</h1>
          <p className="text-muted-foreground">File management and bucket configuration</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showBucketDialog} onOpenChange={setShowBucketDialog}>
            <DialogTrigger asChild><Button variant="outline"><Plus className="mr-1 h-4 w-4" />New Bucket</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Bucket</DialogTitle><DialogDescription>Create a new storage bucket</DialogDescription></DialogHeader>
              <div className="py-2"><div className="space-y-2"><Label>Bucket Name</Label><Input value={newBucketName} onChange={(e) => setNewBucketName(e.target.value)} placeholder="my-bucket" /></div></div>
              <DialogFooter><Button variant="outline" onClick={() => setShowBucketDialog(false)}>Cancel</Button><Button onClick={handleCreateBucket}>Create</Button></DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
            <DialogTrigger asChild><Button><Upload className="mr-1 h-4 w-4" />Upload</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Upload Files</DialogTitle><DialogDescription>Upload files to your storage buckets</DialogDescription></DialogHeader>
              <div className="py-4">
                <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-emerald-500 transition-colors cursor-pointer">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Drag and drop files here, or click to browse</p>
                </div>
              </div>
              <DialogFooter><Button variant="outline" onClick={() => setShowUploadDialog(false)}>Cancel</Button><Button onClick={handleUpload}>Upload</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="pt-4"><div className="text-sm text-muted-foreground">Total Files</div><div className="text-2xl font-bold">{files.length}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-sm text-muted-foreground">Total Size</div><div className="text-2xl font-bold">{formatBytes(totalSize)}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-sm text-muted-foreground">Buckets</div><div className="text-2xl font-bold">{buckets.length}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-sm text-muted-foreground">Public Files</div><div className="text-2xl font-bold">{files.filter(f => f.isPublic).length}</div></CardContent></Card>
      </div>

      {/* Buckets */}
      <Card>
        <CardHeader><CardTitle className="text-base">Buckets</CardTitle><CardDescription>Storage bucket overview</CardDescription></CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {bucketStats.map((b) => (
              <div key={b.name} className={`rounded-lg border p-4 cursor-pointer transition-colors hover:border-emerald-500 ${selectedBucket === b.name ? 'border-emerald-500 bg-emerald-500/5' : ''}`} onClick={() => setSelectedBucket(selectedBucket === b.name ? 'all' : b.name)}>
                <div className="flex items-center gap-2 mb-2">
                  <FolderOpen className="h-4 w-4 text-emerald-500" />
                  <span className="font-medium text-sm">{b.name}</span>
                </div>
                <div className="text-xs text-muted-foreground">{b.count} files · {formatBytes(b.size)}</div>
                <Progress value={(b.size / totalSize) * 100} className="mt-2 h-1.5" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Files Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Files</CardTitle>
              <CardDescription>All stored files {selectedBucket !== 'all' && `in "${selectedBucket}" bucket`}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search files..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-56" />
              </div>
              <Select value={selectedBucket} onValueChange={setSelectedBucket}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Buckets</SelectItem>
                  {buckets.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
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
              {filteredFiles.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No files found</TableCell></TableRow>
              ) : (
                filteredFiles.map((file) => {
                  const FileIcon = getFileIcon(file.mimeType)
                  return (
                    <TableRow key={file.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileIcon className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium text-sm">{file.originalName}</div>
                            <div className="text-xs text-muted-foreground font-mono">{file.path}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{file.bucket}</Badge></TableCell>
                      <TableCell className="text-sm font-mono">{formatBytes(file.sizeBytes)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {file.isPublic ? <Globe className="h-3.5 w-3.5 text-emerald-500" /> : <Lock className="h-3.5 w-3.5 text-amber-500" />}
                          <span className="text-xs">{file.isPublic ? 'Public' : 'Private'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{new Date(file.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem><Download className="mr-2 h-3.5 w-3.5" />Download</DropdownMenuItem>
                            <DropdownMenuItem><Copy className="mr-2 h-3.5 w-3.5" />Copy URL</DropdownMenuItem>
                            <DropdownMenuItem><Eye className="mr-2 h-3.5 w-3.5" />Preview</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteFile(file.id)}><Trash2 className="mr-2 h-3.5 w-3.5" />Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
