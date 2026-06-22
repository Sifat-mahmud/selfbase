'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Users,
  Key,
  Shield,
  Smartphone,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Search,
  Fingerprint,
  RefreshCw,
  Clock,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
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
import { apiGet, apiPost, apiDelete, formatRelativeTime } from '@/lib/api-client'

interface UserItem {
  id: string
  email: string
  name: string | null
  role: string
  isActive: boolean
  mfaEnabled: boolean
  mfaSecret?: string | null
  lastLoginAt: string | null
  createdAt: string
}

interface ApiKeyItem {
  id: string
  userId: string
  name: string
  keyHash: string
  prefix: string
  permissions: string
  lastUsedAt: string | null
  expiresAt: string | null
  isActive: boolean
  createdAt: string
}

interface SessionItem {
  id: string
  userId: string
  token: string
  userAgent: string | null
  ipAddress: string | null
  expiresAt: string
  createdAt: string
  user?: { id: string; email: string; name: string | null }
}

interface SessionsResponse {
  data?: SessionItem[]
  meta?: { page: number; limit: number; total: number }
}

const roleBadgeColors: Record<string, string> = {
  admin: 'bg-rose-500/10 text-rose-700 border-rose-200',
  editor: 'bg-amber-500/10 text-amber-700 border-amber-200',
  viewer: 'bg-emerald-500/10 text-emerald-700 border-emerald-200',
  service: 'bg-slate-500/10 text-slate-700 border-slate-200',
  user: 'bg-slate-400/10 text-slate-700 border-slate-200',
}

function getInitials(name: string | null, email: string): string {
  if (name && name.trim().length > 0) {
    const parts = name.trim().split(/\s+/)
    return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
  }
  return email[0]?.toUpperCase() ?? '?'
}

function avatarColor(email: string): string {
  const colors = [
    'bg-emerald-500/10 text-emerald-700',
    'bg-teal-500/10 text-teal-700',
    'bg-amber-500/10 text-amber-700',
    'bg-purple-500/10 text-purple-700',
    'bg-rose-500/10 text-rose-700',
    'bg-cyan-500/10 text-cyan-700',
  ]
  let hash = 0
  for (let i = 0; i < email.length; i++) hash = (hash * 31 + email.charCodeAt(i)) >>> 0
  return colors[hash % colors.length]
}

function generateApiKey(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let s = ''
  for (let i = 0; i < 32; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return `sb_${s}`
}

function maskApiKey(key: string): string {
  if (key.length <= 12) return key
  return `${key.slice(0, 8)}...${key.slice(-4)}`
}

function formatSessionDuration(createdAt: string): string {
  const start = new Date(createdAt).getTime()
  const now = Date.now()
  const diffMs = now - start
  const hours = Math.floor(diffMs / 3600000)
  const minutes = Math.floor((diffMs % 3600000) / 60000)
  if (hours > 24) {
    const days = Math.floor(hours / 24)
    return `${days}d ${hours % 24}h`
  }
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export function AuthView() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<UserItem[]>([])
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([])
  const [sessions, setSessions] = useState<SessionItem[]>([])
  const [search, setSearch] = useState('')
  const [showCreateUserDialog, setShowCreateUserDialog] = useState(false)
  const [showCreateKeyDialog, setShowCreateKeyDialog] = useState(false)
  const [revealedKeyId, setRevealedKeyId] = useState<string | null>(null)
  const [newKeyDialog, setNewKeyDialog] = useState<{ key: string; name: string } | null>(null)
  const [revokeSessionId, setRevokeSessionId] = useState<string | null>(null)

  // Create user form
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserName, setNewUserName] = useState('')
  const [newUserPassword, setNewUserPassword] = useState('')
  const [newUserRole, setNewUserRole] = useState('user')

  // Create API key form
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyPerms, setNewKeyPerms] = useState('read')
  const [newKeyUserId, setNewKeyUserId] = useState('')

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [u, k, s] = await Promise.all([
        apiGet<UserItem[]>('/api/auth/users'),
        apiGet<ApiKeyItem[]>('/api/auth/api-keys'),
        apiGet<SessionsResponse>('/api/auth/sessions?limit=50').catch(() => ({})),
      ])
      setUsers(Array.isArray(u) ? u : [])
      setApiKeys(Array.isArray(k) ? k : [])
      setSessions(Array.isArray(s?.data) ? s.data : [])
      // Default the new key's user to first admin user
      const firstAdmin = (u as UserItem[]).find((x) => x.role === 'admin') ?? (u as UserItem[])[0]
      if (firstAdmin) setNewKeyUserId(firstAdmin.id)
    } catch (err) {
      toast({
        title: 'Failed to load auth data',
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

  const handleCreateUser = async () => {
    if (!newUserEmail.trim()) {
      toast({ title: 'Email required', variant: 'destructive' })
      return
    }
    try {
      const created = await apiPost<UserItem>('/api/auth/users', {
        email: newUserEmail.trim(),
        name: newUserName || null,
        role: newUserRole,
        isActive: true,
        mfaEnabled: false,
        passwordHash: newUserPassword || null,
      })
      setUsers((prev) => [created, ...prev])
      setShowCreateUserDialog(false)
      setNewUserEmail('')
      setNewUserName('')
      setNewUserPassword('')
      setNewUserRole('user')
      toast({ title: 'User created', description: `${created.email} has been added.` })
    } catch (err) {
      toast({
        title: 'Failed to create user',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      toast({ title: 'Key name required', variant: 'destructive' })
      return
    }
    if (!newKeyUserId) {
      toast({ title: 'Select a user for this key', variant: 'destructive' })
      return
    }
    const fullKey = generateApiKey()
    const prefix = fullKey.substring(0, 8)
    try {
      const created = await apiPost<ApiKeyItem>('/api/auth/api-keys', {
        userId: newKeyUserId,
        name: newKeyName.trim(),
        keyHash: fullKey,
        prefix,
        permissions: newKeyPerms,
        isActive: true,
      })
      setApiKeys((prev) => [created, ...prev])
      setShowCreateKeyDialog(false)
      setNewKeyName('')
      setNewKeyPerms('read')
      // Show the key once
      setNewKeyDialog({ key: fullKey, name: created.name })
      toast({
        title: 'API key created',
        description: 'Copy the key now — it will not be shown again.',
      })
    } catch (err) {
      toast({
        title: 'Failed to create API key',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  const handleRevokeKey = async (key: ApiKeyItem) => {
    try {
      await apiDelete(`/api/auth/api-keys/${key.id}`)
      setApiKeys((prev) => prev.filter((k) => k.id !== key.id))
      toast({ title: 'API key revoked', variant: 'destructive' })
    } catch (err) {
      toast({
        title: 'Failed to revoke key',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  const handleRevokeSession = async (sessionId: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== sessionId))
    setRevokeSessionId(null)
    toast({ title: 'Session revoked', description: 'The session has been terminated.' })
  }

  const toggleKeyReveal = (id: string) => {
    setRevealedKeyId((prev) => (prev === id ? null : id))
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
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
            Authentication
          </h1>
          <p className="text-muted-foreground">Manage users, API keys, and security settings</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadAll()}>
          <RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users" className="gap-1.5">
            <Users className="h-3.5 w-3.5" /> Users
          </TabsTrigger>
          <TabsTrigger value="api-keys" className="gap-1.5">
            <Key className="h-3.5 w-3.5" /> API Keys
          </TabsTrigger>
          <TabsTrigger value="oauth" className="gap-1.5">
            <Shield className="h-3.5 w-3.5" /> OAuth
          </TabsTrigger>
          <TabsTrigger value="sessions" className="gap-1.5">
            <Smartphone className="h-3.5 w-3.5" /> Sessions
          </TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="relative max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Dialog open={showCreateUserDialog} onOpenChange={setShowCreateUserDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-1 h-4 w-4" /> Add User
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add User</DialogTitle>
                  <DialogDescription>Create a new user account</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      placeholder="user@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      placeholder="John Doe"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Password (optional)</Label>
                    <Input
                      type="password"
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={newUserRole} onValueChange={setNewUserRole}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCreateUserDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateUser}>Create User</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <Card>
            <CardContent className="p-0">
              {users.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Users className="h-12 w-12 mb-3 opacity-30" />
                  <p className="text-sm">No users yet</p>
                  <Button className="mt-3" onClick={() => setShowCreateUserDialog(true)}>
                    <Plus className="mr-1 h-4 w-4" /> Add User
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>MFA</TableHead>
                      <TableHead>Last Login</TableHead>
                      <TableHead className="w-8" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users
                      .filter(
                        (u) =>
                          u.email.toLowerCase().includes(search.toLowerCase()) ||
                          (u.name ?? '').toLowerCase().includes(search.toLowerCase()),
                      )
                      .map((user) => (
                        <TableRow key={user.id} className="hover:bg-muted/40">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className={avatarColor(user.email)}>
                                  {getInitials(user.name, user.email)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium text-sm">{user.name ?? 'No name'}</div>
                                <div className="text-xs text-muted-foreground">{user.email}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={roleBadgeColors[user.role] ?? roleBadgeColors.user}>
                              {user.role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {user.isActive ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5 text-red-500" />
                              )}
                              <span className="text-sm">{user.isActive ? 'Active' : 'Inactive'}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant={user.mfaEnabled ? 'default' : 'outline'} className="text-xs">
                                  <Fingerprint className="h-2.5 w-2.5 mr-1" />
                                  {user.mfaEnabled ? 'Enabled' : 'Off'}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                {user.mfaEnabled ? 'Multi-factor authentication is enabled' : 'MFA not configured'}
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>{formatRelativeTime(user.lastLoginAt)}</span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Never logged in'}
                              </TooltipContent>
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
                                <DropdownMenuItem>
                                  <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Fingerprint className="mr-2 h-3.5 w-3.5" /> Reset MFA
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
        </TabsContent>

        {/* API Keys Tab */}
        <TabsContent value="api-keys" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <Badge variant="secondary">{apiKeys.length} keys</Badge>
            <Dialog open={showCreateKeyDialog} onOpenChange={setShowCreateKeyDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-1 h-4 w-4" /> New API Key
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create API Key</DialogTitle>
                  <DialogDescription>
                    Generate a new API key. The full key will be shown once after creation.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label>Key Name</Label>
                    <Input
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder="My API Key"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Owner</Label>
                    <Select value={newKeyUserId} onValueChange={setNewKeyUserId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select user" />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name ?? u.email} ({u.role})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Permissions</Label>
                    <Select value={newKeyPerms} onValueChange={setNewKeyPerms}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="read">Read Only</SelectItem>
                        <SelectItem value="read,write">Read & Write</SelectItem>
                        <SelectItem value="read,write,admin">Full Access</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCreateKeyDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateKey}>Create Key</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <Card>
            <CardContent className="p-0">
              {apiKeys.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Key className="h-12 w-12 mb-3 opacity-30" />
                  <p className="text-sm">No API keys yet</p>
                  <Button className="mt-3" onClick={() => setShowCreateKeyDialog(true)}>
                    <Plus className="mr-1 h-4 w-4" /> New API Key
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Key</TableHead>
                      <TableHead>Permissions</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Used</TableHead>
                      <TableHead className="w-8" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apiKeys.map((key) => (
                      <TableRow key={key.id} className="hover:bg-muted/40">
                        <TableCell className="font-medium">{key.name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                              {revealedKeyId === key.id
                                ? key.keyHash
                                : maskApiKey(key.keyHash)}
                            </code>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => toggleKeyReveal(key.id)}
                                >
                                  {revealedKeyId === key.id ? (
                                    <EyeOff className="h-3 w-3" />
                                  ) : (
                                    <Eye className="h-3 w-3" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{revealedKeyId === key.id ? 'Hide' : 'Reveal'}</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => {
                                    navigator.clipboard.writeText(key.keyHash)
                                    toast({ title: 'Key copied to clipboard' })
                                  }}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Copy full key</TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {key.permissions.split(',').map((p) => (
                              <Badge key={p} variant="outline" className="text-xs capitalize">
                                {p.trim()}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          {key.isActive ? (
                            <Badge className="bg-emerald-500/10 text-emerald-600 border-0">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Revoked</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>{formatRelativeTime(key.lastUsedAt)}</span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : 'Never used'}
                            </TooltipContent>
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
                              <DropdownMenuItem>
                                <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => void handleRevokeKey(key)}
                              >
                                <Trash2 className="mr-2 h-3.5 w-3.5" /> Revoke
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
        </TabsContent>

        {/* OAuth Tab */}
        <TabsContent value="oauth" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">OAuth Providers</CardTitle>
              <CardDescription>Configure third-party authentication providers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {['Google', 'GitHub', 'GitLab', 'Microsoft'].map((provider) => (
                  <div
                    key={provider}
                    className="flex items-center justify-between rounded-lg border p-4 hover:border-emerald-200 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-500/10 to-teal-500/10 flex items-center justify-center text-sm font-bold text-emerald-700">
                        {provider[0]}
                      </div>
                      <div>
                        <div className="font-medium">{provider}</div>
                        <div className="text-xs text-muted-foreground">OAuth 2.0 integration</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="text-xs">
                        {provider === 'GitHub' ? 'Configured' : 'Not configured'}
                      </Badge>
                      <Switch checked={provider === 'GitHub'} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sessions Tab */}
        <TabsContent value="sessions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Active Sessions</CardTitle>
              <CardDescription>Currently active user sessions ({sessions.length})</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {sessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Smartphone className="h-12 w-12 mb-3 opacity-30" />
                  <p className="text-sm">No active sessions</p>
                  <p className="text-xs mt-1">Sessions will appear here when users log in.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="w-8" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.map((session) => (
                      <TableRow key={session.id} className="hover:bg-muted/40">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className={avatarColor(session.user?.email ?? '???')}>
                                {getInitials(session.user?.name ?? null, session.user?.email ?? '?')}
                              </AvatarFallback>
                            </Avatar>
                            <div className="text-sm">
                              <div className="font-medium">{session.user?.name ?? 'Unknown'}</div>
                              <div className="text-xs text-muted-foreground">{session.user?.email}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{session.ipAddress ?? '—'}</TableCell>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className="text-xs gap-1 font-mono">
                                <Clock className="h-3 w-3" />
                                {formatSessionDuration(session.createdAt)}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>Active since {new Date(session.createdAt).toLocaleString()}</TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="flex items-center gap-1">
                                {formatRelativeTime(session.expiresAt)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>{new Date(session.expiresAt).toLocaleString()}</TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(session.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive h-7 text-xs hover:bg-red-50 dark:hover:bg-red-950/20"
                            onClick={() => setRevokeSessionId(session.id)}
                          >
                            Revoke
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Revoke Session Confirmation Dialog */}
      <Dialog open={!!revokeSessionId} onOpenChange={(open) => !open && setRevokeSessionId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-red-500" />
              Revoke Session
            </DialogTitle>
            <DialogDescription>
              This will immediately terminate the session. The user will be logged out and will need to authenticate again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeSessionId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (revokeSessionId) void handleRevokeSession(revokeSessionId)
              }}
            >
              Revoke Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New API Key Display Dialog */}
      <Dialog open={!!newKeyDialog} onOpenChange={(open) => !open && setNewKeyDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-4 w-4 text-emerald-600" />
              API Key Created
            </DialogTitle>
            <DialogDescription>
              Copy your new API key now. For security reasons, it will not be shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-md border border-emerald-200 bg-emerald-500/5 p-3">
              <div className="text-xs text-emerald-700 mb-1">Key name: {newKeyDialog?.name}</div>
              <code className="block text-sm font-mono break-all bg-slate-950 text-emerald-400 p-2 rounded">
                {newKeyDialog?.key}
              </code>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Shield className="h-3.5 w-3.5" />
              Store this key securely. Treat it like a password.
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (newKeyDialog) {
                  navigator.clipboard.writeText(newKeyDialog.key)
                  toast({ title: 'Key copied to clipboard' })
                }
              }}
            >
              <Copy className="mr-1 h-3.5 w-3.5" /> Copy Key
            </Button>
            <Button onClick={() => setNewKeyDialog(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
