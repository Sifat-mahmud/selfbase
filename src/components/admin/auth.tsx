'use client'

import { useState, useEffect } from 'react'
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
  Clock,
  Search,
  Fingerprint,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
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

interface UserItem {
  id: string
  email: string
  name: string | null
  role: string
  isActive: boolean
  mfaEnabled: boolean
  lastLoginAt: string | null
  createdAt: string
}

interface ApiKeyItem {
  id: string
  name: string
  prefix: string
  permissions: string
  lastUsedAt: string | null
  expiresAt: string | null
  isActive: boolean
  createdAt: string
}

interface OAuthItem {
  id: string
  provider: string
  providerId: string
  createdAt: string
}

interface SessionItem {
  id: string
  userAgent: string | null
  ipAddress: string | null
  expiresAt: string
  createdAt: string
}

const mockUsers: UserItem[] = [
  { id: '1', email: 'admin@selfbase.io', name: 'Admin User', role: 'admin', isActive: true, mfaEnabled: true, lastLoginAt: '2025-06-21T10:00:00Z', createdAt: '2025-01-01' },
  { id: '2', email: 'dev@selfbase.io', name: 'Developer', role: 'user', isActive: true, mfaEnabled: false, lastLoginAt: '2025-06-21T09:30:00Z', createdAt: '2025-02-15' },
  { id: '3', email: 'bot@selfbase.io', name: 'Service Bot', role: 'admin', isActive: true, mfaEnabled: false, lastLoginAt: '2025-06-21T08:00:00Z', createdAt: '2025-03-01' },
  { id: '4', email: 'viewer@selfbase.io', name: 'Read Only', role: 'user', isActive: false, mfaEnabled: false, lastLoginAt: '2025-06-15T14:00:00Z', createdAt: '2025-04-10' },
]

const mockApiKeys: ApiKeyItem[] = [
  { id: '1', name: 'Production Deploy Key', prefix: 'sb_prod_', permissions: 'read,write', lastUsedAt: '2025-06-21T10:05:00Z', expiresAt: null, isActive: true, createdAt: '2025-02-01' },
  { id: '2', name: 'CI/CD Pipeline', prefix: 'sb_cicd_', permissions: 'read', lastUsedAt: '2025-06-21T06:00:00Z', expiresAt: '2025-12-31', isActive: true, createdAt: '2025-03-15' },
  { id: '3', name: 'Development Key', prefix: 'sb_dev_', permissions: 'read,write,admin', lastUsedAt: '2025-06-20T18:00:00Z', expiresAt: null, isActive: true, createdAt: '2025-01-20' },
  { id: '4', name: 'Old Service Key', prefix: 'sb_old_', permissions: 'read', lastUsedAt: '2025-05-01T12:00:00Z', expiresAt: '2025-06-01', isActive: false, createdAt: '2025-01-01' },
]

const mockSessions: SessionItem[] = [
  { id: '1', userAgent: 'Chrome/125 macOS', ipAddress: '192.168.1.100', expiresAt: '2025-06-22T10:00:00Z', createdAt: '2025-06-21T10:00:00Z' },
  { id: '2', userAgent: 'Firefox/126 Linux', ipAddress: '192.168.1.101', expiresAt: '2025-06-22T09:30:00Z', createdAt: '2025-06-21T09:30:00Z' },
  { id: '3', userAgent: 'curl/8.0', ipAddress: '10.0.0.5', expiresAt: '2025-06-21T18:00:00Z', createdAt: '2025-06-21T08:00:00Z' },
]

export function AuthView() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<UserItem[]>([])
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([])
  const [sessions, setSessions] = useState<SessionItem[]>([])
  const [search, setSearch] = useState('')
  const [showCreateUserDialog, setShowCreateUserDialog] = useState(false)
  const [showCreateKeyDialog, setShowCreateKeyDialog] = useState(false)
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserName, setNewUserName] = useState('')
  const [newUserRole, setNewUserRole] = useState('user')
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyPerms, setNewKeyPerms] = useState('read')
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set())

  useEffect(() => {
    const timer = setTimeout(() => {
      setUsers(mockUsers); setApiKeys(mockApiKeys); setSessions(mockSessions); setLoading(false)
    }, 600)
    return () => clearTimeout(timer)
  }, [])

  const handleCreateUser = () => {
    if (!newUserEmail.trim()) return
    const user: UserItem = {
      id: String(Date.now()), email: newUserEmail, name: newUserName || null,
      role: newUserRole, isActive: true, mfaEnabled: false, lastLoginAt: null, createdAt: new Date().toISOString(),
    }
    setUsers((prev) => [...prev, user])
    setShowCreateUserDialog(false); setNewUserEmail(''); setNewUserName(''); setNewUserRole('user')
    toast({ title: 'User created', description: `${newUserEmail} has been added.` })
  }

  const handleCreateKey = () => {
    if (!newKeyName.trim()) return
    const key: ApiKeyItem = {
      id: String(Date.now()), name: newKeyName, prefix: 'sb_new_',
      permissions: newKeyPerms, lastUsedAt: null, expiresAt: null, isActive: true, createdAt: new Date().toISOString(),
    }
    setApiKeys((prev) => [...prev, key])
    setShowCreateKeyDialog(false); setNewKeyName(''); setNewKeyPerms('read')
    toast({ title: 'API key created', description: 'Make sure to copy the key — it won\'t be shown again.' })
  }

  const toggleKeyReveal = (id: string) => {
    setRevealedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Authentication</h1>
        <p className="text-muted-foreground">Manage users, API keys, and security settings</p>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users" className="gap-1.5"><Users className="h-3.5 w-3.5" />Users</TabsTrigger>
          <TabsTrigger value="api-keys" className="gap-1.5"><Key className="h-3.5 w-3.5" />API Keys</TabsTrigger>
          <TabsTrigger value="oauth" className="gap-1.5"><Shield className="h-3.5 w-3.5" />OAuth</TabsTrigger>
          <TabsTrigger value="sessions" className="gap-1.5"><Smartphone className="h-3.5 w-3.5" />Sessions</TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="relative max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Dialog open={showCreateUserDialog} onOpenChange={setShowCreateUserDialog}>
              <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" />Add User</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add User</DialogTitle><DialogDescription>Create a new user account</DialogDescription></DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2"><Label>Email</Label><Input value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} placeholder="user@example.com" /></div>
                  <div className="space-y-2"><Label>Name</Label><Input value={newUserName} onChange={(e) => setNewUserName(e.target.value)} placeholder="John Doe" /></div>
                  <div className="space-y-2"><Label>Role</Label>
                    <Select value={newUserRole} onValueChange={setNewUserRole}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCreateUserDialog(false)}>Cancel</Button>
                  <Button onClick={handleCreateUser}>Create User</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <Card>
            <CardContent className="p-0">
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
                  {users.filter((u) => u.email.includes(search) || (u.name ?? '').includes(search)).map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 font-semibold text-sm">
                            {(user.name ?? user.email)[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-sm">{user.name ?? 'No name'}</div>
                            <div className="text-xs text-muted-foreground">{user.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant={user.role === 'admin' ? 'default' : 'secondary'} className="capitalize">{user.role}</Badge></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {user.isActive ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <XCircle className="h-3.5 w-3.5 text-red-500" />}
                          <span className="text-sm">{user.isActive ? 'Active' : 'Inactive'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.mfaEnabled ? 'default' : 'outline'} className="text-xs">
                          {user.mfaEnabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem><Pencil className="mr-2 h-3.5 w-3.5" />Edit</DropdownMenuItem>
                            <DropdownMenuItem><Fingerprint className="mr-2 h-3.5 w-3.5" />Reset MFA</DropdownMenuItem>
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
        </TabsContent>

        {/* API Keys Tab */}
        <TabsContent value="api-keys" className="space-y-4">
          <div className="flex items-center justify-between">
            <Badge variant="secondary">{apiKeys.length} keys</Badge>
            <Dialog open={showCreateKeyDialog} onOpenChange={setShowCreateKeyDialog}>
              <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" />New API Key</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create API Key</DialogTitle><DialogDescription>Generate a new API key for programmatic access</DialogDescription></DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2"><Label>Key Name</Label><Input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="My API Key" /></div>
                  <div className="space-y-2"><Label>Permissions</Label>
                    <Select value={newKeyPerms} onValueChange={setNewKeyPerms}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="read">Read Only</SelectItem>
                        <SelectItem value="read,write">Read & Write</SelectItem>
                        <SelectItem value="read,write,admin">Full Access</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCreateKeyDialog(false)}>Cancel</Button>
                  <Button onClick={handleCreateKey}>Create Key</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <Card>
            <CardContent className="p-0">
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
                    <TableRow key={key.id}>
                      <TableCell className="font-medium">{key.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                            {revealedKeys.has(key.id) ? `${key.prefix}••••••••••••` : `${key.prefix}••••••••`}
                          </code>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleKeyReveal(key.id)}>
                            {revealedKeys.has(key.id) ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toast({ title: 'Copied to clipboard' })}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {key.permissions.split(',').map((p) => (
                            <Badge key={p} variant="outline" className="text-xs capitalize">{p.trim()}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {key.isActive ? <Badge className="bg-emerald-500/10 text-emerald-600 border-0">Active</Badge> : <Badge variant="secondary">Revoked</Badge>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : 'Never'}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem><Pencil className="mr-2 h-3.5 w-3.5" />Edit</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive"><Trash2 className="mr-2 h-3.5 w-3.5" />Revoke</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
                  <div key={provider} className="flex items-center justify-between rounded-lg border p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold">{provider[0]}</div>
                      <div>
                        <div className="font-medium">{provider}</div>
                        <div className="text-xs text-muted-foreground">OAuth 2.0 integration</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="text-xs">{provider === 'GitHub' ? 'Configured' : 'Not configured'}</Badge>
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
              <CardDescription>Currently active user sessions</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User Agent</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell className="font-mono text-sm">{session.userAgent}</TableCell>
                      <TableCell className="font-mono text-sm">{session.ipAddress}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{new Date(session.expiresAt).toLocaleString()}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{new Date(session.createdAt).toLocaleString()}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="text-destructive h-7 text-xs" onClick={() => {
                          setSessions((prev) => prev.filter((s) => s.id !== session.id))
                          toast({ title: 'Session revoked' })
                        }}>Revoke</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
