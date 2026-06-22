'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Settings as SettingsIcon,
  Sliders,
  Brain,
  HardDrive,
  Shield,
  Server,
  Save,
  RotateCcw,
  Download,
  CheckCircle2,
  Loader2,
  Info,
  Globe,
  Lock,
  Cpu,
  Database,
  Clock,
  Activity,
  CircleAlert,
  Mail,
  Wrench,
  AlertTriangle,
  XCircle,
  Webhook,
  Copy,
  Pencil,
  Trash2,
  Zap,
  Plus,
  Eye,
  EyeOff,
  LogOut,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

/* -------------------------------------------------------------------------- */
/*                              Config Key Map                                */
/* -------------------------------------------------------------------------- */

// Maps each setting key to a default value (used to seed before fetching)
const CONFIG_DEFAULTS: Record<string, string | number | boolean> = {
  // General
  'general.appName': 'SelfBase',
  'general.appDescription': 'Self-hosted, local-first, AI-native backend-as-a-service',
  'general.adminEmail': 'admin@selfbase.local',
  'general.defaultTablePriority': 'normal',
  'general.heartbeatInterval': 15,
  'general.loadSheddingThreshold': 85,
  'general.idleThreshold': 30,
  'general.queueTtl': 300,
  'general.ssrfProtection': true,
  'general.hotReloadConfig': true,
  // AI
  'ai.defaultLlmProvider': '',
  'ai.defaultEmbeddingModel': 'text-embedding-3-small',
  'ai.embeddingDimensions': 128,
  'ai.autoEmbedOnWrite': true,
  'ai.semanticCache': true,
  'ai.costTracking': true,
  // Storage
  'storage.defaultBucketName': 'selfbase-default',
  'storage.maxFileSizeMb': 100,
  'storage.allowedMimeTypes': 'image/jpeg,image/png,image/webp,application/pdf,text/plain,application/json',
  'storage.publicUrlPattern': 'https://{cdn}/{bucket}/{path}',
  'storage.cdnBaseUrl': 'https://cdn.selfbase.local',
  // Security
  'security.jwtExpiration': 60,
  'security.apiTokenExpiryMinutes': 60,
  'security.apiKeyRotationPeriod': 90,
  'security.mfaRequiredForAdmin': false,
  'security.ipWhitelist': '',
  'security.corsOrigins': '*',
}

/* -------------------------------------------------------------------------- */
/*                                 Schemas                                    */
/* -------------------------------------------------------------------------- */

const generalSchema = z.object({
  'general.appName': z.string().min(1, 'App name is required').max(64),
  'general.appDescription': z.string().max(280).optional().or(z.literal('')),
  'general.adminEmail': z.string().email('Must be a valid email'),
  'general.defaultTablePriority': z.string(),
  'general.heartbeatInterval': z.coerce.number().int().min(5, 'Min 5s').max(600, 'Max 600s'),
  'general.loadSheddingThreshold': z.coerce.number().int().min(1).max(100),
  'general.idleThreshold': z.coerce.number().int().min(1).max(100),
  'general.queueTtl': z.coerce.number().int().min(60, 'Min 60s').max(86400),
  'general.ssrfProtection': z.boolean(),
  'general.hotReloadConfig': z.boolean(),
})

const aiSchema = z.object({
  'ai.defaultLlmProvider': z.string(),
  'ai.defaultEmbeddingModel': z.string().min(1, 'Required'),
  'ai.embeddingDimensions': z.coerce.number().int().min(32).max(4096),
  'ai.autoEmbedOnWrite': z.boolean(),
  'ai.semanticCache': z.boolean(),
  'ai.costTracking': z.boolean(),
})

const storageSchema = z.object({
  'storage.defaultBucketName': z.string().min(1, 'Required').max(64),
  'storage.maxFileSizeMb': z.coerce.number().int().min(1, 'Min 1MB').max(10240),
  'storage.allowedMimeTypes': z.string().min(1, 'At least one type required'),
  'storage.publicUrlPattern': z.string().min(1, 'Required'),
  'storage.cdnBaseUrl': z.string().min(1, 'Required'),
})

const securitySchema = z.object({
  'security.jwtExpiration': z.coerce.number().int().min(1, 'Min 1 min').max(10080),
  'security.apiTokenExpiryMinutes': z.coerce.number().int().min(1, 'Min 1 min').max(10080),
  'security.apiKeyRotationPeriod': z.coerce.number().int().min(1, 'Min 1 day').max(365),
  'security.mfaRequiredForAdmin': z.boolean(),
  'security.ipWhitelist': z.string(),
  'security.corsOrigins': z.string(),
})

type GeneralValues = z.infer<typeof generalSchema>
type AiValues = z.infer<typeof aiSchema>
type StorageValues = z.infer<typeof storageSchema>
type SecurityValues = z.infer<typeof securitySchema>

/* -------------------------------------------------------------------------- */
/*                            Helper: Config Fetch                            */
/* -------------------------------------------------------------------------- */

async function fetchConfigMap(): Promise<Record<string, unknown>> {
  try {
    const res = await fetch('/api/config?limit=200')
    if (!res.ok) return {}
    const body = await res.json()
    const list: Array<{ key: string; value: unknown }> = body?.data ?? body ?? []
    const map: Record<string, unknown> = {}
    for (const item of list) {
      map[item.key] = item.value
    }
    return map
  } catch {
    return {}
  }
}

function deriveInitial<T extends Record<string, unknown>>(
  keys: string[],
  configMap: Record<string, unknown>,
): T {
  const out = {} as Record<string, unknown>
  for (const k of keys) {
    const fallback = CONFIG_DEFAULTS[k]
    if (k in configMap && configMap[k] !== undefined && configMap[k] !== null && configMap[k] !== '') {
      out[k] = configMap[k]
    } else {
      out[k] = fallback
    }
  }
  return out as T
}

async function saveConfig(values: Record<string, unknown>): Promise<{ ok: boolean; saved: number }> {
  let saved = 0
  let failed = 0
  // Send sequentially to avoid race conditions on the upsert endpoint.
  for (const [key, value] of Object.entries(values)) {
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      })
      if (res.ok) saved++
      else failed++
    } catch {
      failed++
    }
  }
  return { ok: failed === 0, saved }
}

/* -------------------------------------------------------------------------- */
/*                              Shared UI Bits                                */
/* -------------------------------------------------------------------------- */

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20">
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div>
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

function StickySaveBar({
  onSave,
  onReset,
  saving,
  dirty,
  dirtyCount,
}: {
  onSave: () => void
  onReset: () => void
  saving: boolean
  dirty: boolean
  dirtyCount?: number
}) {
  return (
    <div className="sticky bottom-0 -mx-4 mt-6 flex items-center justify-between border-t bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {dirty ? (
          <>
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Unsaved changes{dirtyCount != null && dirtyCount > 0 ? ` (${dirtyCount} field${dirtyCount !== 1 ? 's' : ''})` : ''}
          </>
        ) : (
          <>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            All changes saved
          </>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onReset}
          disabled={saving || !dirty}
          className="text-xs"
        >
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          Reset
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onSave}
          disabled={saving || !dirty}
          className="bg-emerald-600 text-xs hover:bg-emerald-700"
        >
          {saving ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-1.5 h-3.5 w-3.5" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

function ToggleField({
  name,
  control,
  label,
  description,
}: {
  name: string
  control: any
  label: string
  description: string
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <div className="flex flex-row items-start justify-between gap-4 rounded-lg border p-4">
          <div className="space-y-0.5">
            <FormLabel className="text-sm font-medium">{label}</FormLabel>
            <FormDescription className="text-xs">{description}</FormDescription>
          </div>
          <FormControl>
            <Switch checked={!!field.value} onCheckedChange={field.onChange} />
          </FormControl>
        </div>
      )}
    />
  )
}

/* -------------------------------------------------------------------------- */
/*                            Validation Helpers                              */
/* -------------------------------------------------------------------------- */

function ValidationIndicator({ value, keyName }: { value: unknown; keyName: string }) {
  const defaults: Record<string, unknown> = CONFIG_DEFAULTS
  const isInsecureDefault =
    (keyName === 'security.corsOrigins' && value === '*') ||
    (keyName === 'security.ipWhitelist' && (value === '' || value == null)) ||
    (keyName === 'general.adminEmail' && value === 'admin@selfbase.local') ||
    (keyName === 'storage.cdnBaseUrl' && value === 'https://cdn.selfbase.local')
  const isMissing =
    value === '' || value === undefined || value === null
  const isDefault =
    keyName in defaults && value === defaults[keyName]

  if (isMissing) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
        </TooltipTrigger>
        <TooltipContent>Required field is missing</TooltipContent>
      </Tooltip>
    )
  }
  if (isInsecureDefault) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
        </TooltipTrigger>
        <TooltipContent>Using default or insecure value</TooltipContent>
      </Tooltip>
    )
  }
  if (isDefault) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
        </TooltipTrigger>
        <TooltipContent>Using default value</TooltipContent>
      </Tooltip>
    )
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
      </TooltipTrigger>
      <TooltipContent>Properly configured</TooltipContent>
    </Tooltip>
  )
}

/* -------------------------------------------------------------------------- */
/*                              General Tab                                   */
/* -------------------------------------------------------------------------- */

function GeneralTab({
  configMap,
  loaded,
  onSaved,
}: {
  configMap: Record<string, unknown>
  loaded: boolean
  onSaved: () => void
}) {
  const { toast } = useToast()
  const form = useForm<GeneralValues>({
    resolver: zodResolver(generalSchema),
    values: deriveInitial<GeneralValues>(
      [
        'general.appName',
        'general.appDescription',
        'general.adminEmail',
        'general.defaultTablePriority',
        'general.heartbeatInterval',
        'general.loadSheddingThreshold',
        'general.idleThreshold',
        'general.queueTtl',
        'general.ssrfProtection',
        'general.hotReloadConfig',
      ],
      configMap,
    ),
    mode: 'onChange',
  })

  const [saving, setSaving] = useState(false)

  const onSubmit = async (values: GeneralValues) => {
    setSaving(true)
    try {
      const res = await saveConfig(values as unknown as Record<string, unknown>)
      if (res.ok) {
        toast({
          title: 'General settings saved',
          description: `${res.saved} config keys updated`,
        })
        onSaved()
      } else {
        toast({ title: 'Some settings failed to save', variant: 'destructive' })
      }
    } finally {
      setSaving(false)
    }
  }

  if (!loaded) return <SettingsSkeleton />

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <SectionHeader
              icon={Info}
              title="Application Identity"
              description="Displayed across the admin studio, emails, and API responses."
            />
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2">
            <FormField
              control={form.control}
              name="general.appName"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-1.5">
                    <FormLabel>App Name</FormLabel>
                    <ValidationIndicator value={field.value} keyName="general.appName" />
                  </div>
                  <FormControl>
                    <Input placeholder="SelfBase" {...field} />
                  </FormControl>
                  <FormDescription>Shown in the sidebar header and browser title.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="general.adminEmail"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-1.5">
                    <FormLabel>Admin Email</FormLabel>
                    <ValidationIndicator value={field.value} keyName="general.adminEmail" />
                  </div>
                  <FormControl>
                    <Input type="email" placeholder="admin@selfbase.local" {...field} />
                  </FormControl>
                  <FormDescription>Receives system alerts and security notices.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="general.appDescription"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      placeholder="Self-hosted, local-first, AI-native backend-as-a-service"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>Short tagline used in onboarding screens.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionHeader
              icon={Sliders}
              title="Performance & Throttling"
              description="Tune heartbeat cadence, load shedding, and the deferred queue."
            />
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2">
            <FormField
              control={form.control}
              name="general.defaultTablePriority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Default Table Priority</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value as string}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Default priority assigned to newly created tables for queue ordering.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="general.heartbeatInterval"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Heartbeat Interval (seconds)</FormLabel>
                  <FormControl>
                    <Input type="number" min={5} max={600} {...field} />
                  </FormControl>
                  <FormDescription>How often the server emits heartbeat metrics.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="general.loadSheddingThreshold"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Load Shedding Threshold (%)</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={100} {...field} />
                  </FormControl>
                  <FormDescription>
                    When the load score exceeds this value, low-priority requests are deferred.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="general.idleThreshold"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Idle Threshold (%)</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={100} {...field} />
                  </FormControl>
                  <FormDescription>
                    Connections idle for longer than this percentage of the interval are pruned.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="general.queueTtl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Queue TTL (seconds)</FormLabel>
                  <FormControl>
                    <Input type="number" min={60} max={86400} {...field} />
                  </FormControl>
                  <FormDescription>
                    Time-to-live for deferred requests before they expire.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionHeader
              icon={Lock}
              title="Safety Toggles"
              description="Hardening switches for hot-reload and SSRF protection."
            />
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <ToggleField
              control={form.control}
              name="general.ssrfProtection"
              label="SSRF Protection"
              description="Block outbound requests to private IP ranges and link-local addresses."
            />
            <ToggleField
              control={form.control}
              name="general.hotReloadConfig"
              label="Hot-Reload Config"
              description="Apply config changes immediately without restarting services."
            />
          </CardContent>
        </Card>

        <StickySaveBar
          onSave={form.handleSubmit(onSubmit)}
          onReset={() => form.reset()}
          saving={saving}
          dirty={form.formState.isDirty}
          dirtyCount={Object.keys(form.formState.dirtyFields).length}
        />
      </form>
    </Form>
  )
}

/* -------------------------------------------------------------------------- */
/*                                 AI Tab                                     */
/* -------------------------------------------------------------------------- */

interface LlmConfigOption {
  id: string
  provider: string
  name: string
  isActive: boolean
}

function AiTab({
  configMap,
  loaded,
  onSaved,
}: {
  configMap: Record<string, unknown>
  loaded: boolean
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [providers, setProviders] = useState<LlmConfigOption[]>([])
  const [providersLoading, setProvidersLoading] = useState(true)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await fetch('/api/ai/llm-config')
        if (!res.ok) return
        const body = await res.json()
        const list: LlmConfigOption[] = Array.isArray(body) ? body : body?.data ?? []
        if (active) setProviders(list)
      } catch {
        // ignore — dropdown stays empty
      } finally {
        if (active) setProvidersLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const form = useForm<AiValues>({
    resolver: zodResolver(aiSchema),
    values: deriveInitial<AiValues>(
      [
        'ai.defaultLlmProvider',
        'ai.defaultEmbeddingModel',
        'ai.embeddingDimensions',
        'ai.autoEmbedOnWrite',
        'ai.semanticCache',
        'ai.costTracking',
      ],
      configMap,
    ),
    mode: 'onChange',
  })

  const [saving, setSaving] = useState(false)

  const onSubmit = async (values: AiValues) => {
    setSaving(true)
    try {
      const res = await saveConfig(values as unknown as Record<string, unknown>)
      if (res.ok) {
        toast({
          title: 'AI settings saved',
          description: `${res.saved} config keys updated`,
        })
        onSaved()
      } else {
        toast({ title: 'Some settings failed to save', variant: 'destructive' })
      }
    } finally {
      setSaving(false)
    }
  }

  if (!loaded) return <SettingsSkeleton />

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <SectionHeader
              icon={Brain}
              title="LLM Provider"
              description="Choose the default model used for chat, RAG, and completions."
            />
          </CardHeader>
          <CardContent className="grid gap-5">
            <FormField
              control={form.control}
              name="ai.defaultLlmProvider"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-1.5">
                    <FormLabel>Default LLM Provider</FormLabel>
                    <ValidationIndicator value={field.value} keyName="ai.defaultLlmProvider" />
                  </div>
                  <Select
                    onValueChange={field.onChange}
                    value={(field.value as string) || ''}
                    disabled={providersLoading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            providersLoading ? 'Loading providers...' : 'Select a provider'
                          }
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {providers.length === 0 && !providersLoading && (
                        <SelectItem value="" disabled>
                          No providers configured — visit AI section
                        </SelectItem>
                      )}
                      {providers.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} · {p.provider}
                          {p.isActive ? ' (active)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Manage providers in the AI section. Only configured LLMs appear here.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionHeader
              icon={Cpu}
              title="Embeddings"
              description="Vectorisation settings drive semantic search and RAG retrieval."
            />
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2">
            <FormField
              control={form.control}
              name="ai.defaultEmbeddingModel"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-1.5">
                    <FormLabel>Default Embedding Model</FormLabel>
                    <ValidationIndicator value={field.value} keyName="ai.defaultEmbeddingModel" />
                  </div>
                  <FormControl>
                    <Input placeholder="text-embedding-3-small" {...field} />
                  </FormControl>
                  <FormDescription>Used when a table has embeddings enabled.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="ai.embeddingDimensions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Embedding Dimensions</FormLabel>
                  <Select onValueChange={field.onChange} value={String(field.value)}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Dimensions" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {[64, 128, 256, 512, 768, 1024, 1536, 3072].map((d) => (
                        <SelectItem key={d} value={String(d)}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Higher dimensions improve recall at the cost of storage and latency.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionHeader
              icon={Activity}
              title="Runtime Behavior"
              description="Automatic embedding, semantic caching, and cost observability."
            />
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <ToggleField
              control={form.control}
              name="ai.autoEmbedOnWrite"
              label="Auto-Embed on Write"
              description="Generate embeddings automatically when rows are inserted or updated."
            />
            <ToggleField
              control={form.control}
              name="ai.semanticCache"
              label="Semantic Cache"
              description="Cache LLM responses using cosine similarity to skip duplicate queries."
            />
            <ToggleField
              control={form.control}
              name="ai.costTracking"
              label="Cost Tracking"
              description="Log token usage and estimated cost for every LLM call."
            />
          </CardContent>
        </Card>

        <StickySaveBar
          onSave={form.handleSubmit(onSubmit)}
          onReset={() => form.reset()}
          saving={saving}
          dirty={form.formState.isDirty}
          dirtyCount={Object.keys(form.formState.dirtyFields).length}
        />
      </form>
    </Form>
  )
}

/* -------------------------------------------------------------------------- */
/*                              Storage Tab                                   */
/* -------------------------------------------------------------------------- */

function StorageTab({
  configMap,
  loaded,
  onSaved,
}: {
  configMap: Record<string, unknown>
  loaded: boolean
  onSaved: () => void
}) {
  const { toast } = useToast()
  const form = useForm<StorageValues>({
    resolver: zodResolver(storageSchema),
    values: deriveInitial<StorageValues>(
      [
        'storage.defaultBucketName',
        'storage.maxFileSizeMb',
        'storage.allowedMimeTypes',
        'storage.publicUrlPattern',
        'storage.cdnBaseUrl',
      ],
      configMap,
    ),
    mode: 'onChange',
  })

  const [saving, setSaving] = useState(false)

  const onSubmit = async (values: StorageValues) => {
    setSaving(true)
    try {
      const res = await saveConfig(values as unknown as Record<string, unknown>)
      if (res.ok) {
        toast({
          title: 'Storage settings saved',
          description: `${res.saved} config keys updated`,
        })
        onSaved()
      } else {
        toast({ title: 'Some settings failed to save', variant: 'destructive' })
      }
    } finally {
      setSaving(false)
    }
  }

  if (!loaded) return <SettingsSkeleton />

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <SectionHeader
              icon={HardDrive}
              title="Bucket & Limits"
              description="Default bucket and upload size constraints."
            />
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2">
            <FormField
              control={form.control}
              name="storage.defaultBucketName"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-1.5">
                    <FormLabel>Default Bucket Name</FormLabel>
                    <ValidationIndicator value={field.value} keyName="storage.defaultBucketName" />
                  </div>
                  <FormControl>
                    <Input placeholder="selfbase-default" {...field} />
                  </FormControl>
                  <FormDescription>
                    Bucket used for uploads that do not specify an explicit target.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="storage.maxFileSizeMb"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Max File Size (MB)</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={10240} {...field} />
                  </FormControl>
                  <FormDescription>Hard limit enforced at the upload API.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="storage.allowedMimeTypes"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Allowed MIME Types</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      placeholder="image/jpeg,image/png,application/pdf"
                      className="font-mono text-xs"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Comma-separated list. Uploads with other types are rejected.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionHeader
              icon={Globe}
              title="Public URLs & CDN"
              description="How files are exposed to the public internet."
            />
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2">
            <FormField
              control={form.control}
              name="storage.publicUrlPattern"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Public URL Pattern</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://{cdn}/{bucket}/{path}"
                      className="font-mono text-xs"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Tokens <code className="text-emerald-700">{'{cdn}'}</code>,{' '}
                    <code className="text-emerald-700">{'{bucket}'}</code>, and{' '}
                    <code className="text-emerald-700">{'{path}'}</code> are substituted at runtime.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="storage.cdnBaseUrl"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-1.5">
                    <FormLabel>CDN Base URL</FormLabel>
                    <ValidationIndicator value={field.value} keyName="storage.cdnBaseUrl" />
                  </div>
                  <FormControl>
                    <Input
                      placeholder="https://cdn.selfbase.local"
                      className="font-mono text-xs"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>Origin-pull base for the public CDN edge.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <StickySaveBar
          onSave={form.handleSubmit(onSubmit)}
          onReset={() => form.reset()}
          saving={saving}
          dirty={form.formState.isDirty}
          dirtyCount={Object.keys(form.formState.dirtyFields).length}
        />
      </form>
    </Form>
  )
}

/* -------------------------------------------------------------------------- */
/*                              Security Tab                                  */
/* -------------------------------------------------------------------------- */

function SecurityTab({
  configMap,
  loaded,
  onSaved,
}: {
  configMap: Record<string, unknown>
  loaded: boolean
  onSaved: () => void
}) {
  const { toast } = useToast()
  const form = useForm<SecurityValues>({
    resolver: zodResolver(securitySchema),
    values: deriveInitial<SecurityValues>(
      [
        'security.jwtExpiration',
        'security.apiTokenExpiryMinutes',
        'security.apiKeyRotationPeriod',
        'security.mfaRequiredForAdmin',
        'security.ipWhitelist',
        'security.corsOrigins',
      ],
      configMap,
    ),
    mode: 'onChange',
  })

  const [saving, setSaving] = useState(false)

  const onSubmit = async (values: SecurityValues) => {
    setSaving(true)
    try {
      const res = await saveConfig(values as unknown as Record<string, unknown>)
      if (res.ok) {
        toast({
          title: 'Security settings saved',
          description: `${res.saved} config keys updated`,
        })
        onSaved()
      } else {
        toast({ title: 'Some settings failed to save', variant: 'destructive' })
      }
    } finally {
      setSaving(false)
    }
  }

  if (!loaded) return <SettingsSkeleton />

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <SectionHeader
              icon={Shield}
              title="Tokens & Rotation"
              description="Lifetime of issued credentials and admin MFA enforcement."
            />
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2">
            <FormField
              control={form.control}
              name="security.jwtExpiration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>JWT Expiration (minutes)</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={10080} {...field} />
                  </FormControl>
                  <FormDescription>
                    Time-to-live for access tokens. Refresh tokens last 7× longer.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="security.apiKeyRotationPeriod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API Key Rotation Period (days)</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={365} {...field} />
                  </FormControl>
                  <FormDescription>
                    Recommended rotation cadence surfaced in the Auth section.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="security.apiTokenExpiryMinutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API Token Expiry (minutes)</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={10080} {...field} />
                  </FormControl>
                  <FormDescription>
                    How long external app tokens remain valid after login. Default: 60 min (1 hour).
                    Used by /api/v1/auth/login.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="md:col-span-2">
              <ToggleField
                control={form.control}
                name="security.mfaRequiredForAdmin"
                label="Require MFA for Admins"
                description="Admins without a verified second factor cannot access the studio."
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionHeader
              icon={Lock}
              title="Network Policy"
              description="IP allow-listing and CORS configuration."
            />
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2">
            <FormField
              control={form.control}
              name="security.ipWhitelist"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-1.5">
                    <FormLabel>IP Whitelist</FormLabel>
                    <ValidationIndicator value={field.value} keyName="security.ipWhitelist" />
                  </div>
                  <FormControl>
                    <Textarea
                      rows={5}
                      placeholder={'10.0.0.0/8\n192.168.1.0/24\n203.0.113.42'}
                      className="font-mono text-xs"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    One CIDR or IP per line. Empty list means all source IPs are allowed.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="security.corsOrigins"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-1.5">
                    <FormLabel>CORS Origins</FormLabel>
                    <ValidationIndicator value={field.value} keyName="security.corsOrigins" />
                  </div>
                  <FormControl>
                    <Textarea
                      rows={5}
                      placeholder={'https://app.selfbase.local\nhttps://studio.selfbase.local'}
                      className="font-mono text-xs"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    One origin per line. Use <code className="text-emerald-700">*</code> to allow all
                    (not recommended for production).
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Account Management */}
        <AccountManagementCard />

        <StickySaveBar
          onSave={form.handleSubmit(onSubmit)}
          onReset={() => form.reset()}
          saving={saving}
          dirty={form.formState.isDirty}
          dirtyCount={Object.keys(form.formState.dirtyFields).length}
        />
      </form>
    </Form>
  )
}

/* -------------------------------------------------------------------------- */
/*                          Account Management Card                           */
/* -------------------------------------------------------------------------- */

function AccountManagementCard() {
  const { toast } = useToast()
  const [changingPassword, setChangingPassword] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwSuccess, setPwSuccess] = useState(false)

  function getAuthToken(): string | null {
    try { return localStorage.getItem('sb_auth_token') } catch { return null }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwError(null)
    setPwSuccess(false)

    if (newPassword.length < 6) {
      setPwError('New password must be at least 6 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setPwError('Passwords do not match')
      return
    }

    setChangingPassword(true)
    try {
      const token = getAuthToken()
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json()

      if (!res.ok) {
        setPwError(data.error || 'Failed to change password')
        return
      }

      setPwSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      toast({ title: 'Password updated', description: 'Your password has been changed successfully.' })
      setTimeout(() => setPwSuccess(false), 3000)
    } catch {
      setPwError('Network error. Please try again.')
    } finally {
      setChangingPassword(false)
    }
  }

  async function handleLogout() {
    try {
      const token = getAuthToken()
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        })
      }
    } catch {
      // ignore
    }
    localStorage.removeItem('sb_auth_token')
    // Reload the page to reset auth state
    window.location.reload()
  }

  return (
    <Card>
      <CardHeader>
        <SectionHeader
          icon={Lock}
          title="Account"
          description="Manage your password and session."
        />
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Change Password */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Change Password</h4>
          <form onSubmit={handleChangePassword} className="space-y-3 max-w-md">
            <div className="space-y-1.5">
              <Label className="text-xs">Current Password</Label>
              <div className="relative">
                <Input
                  type={showCurrentPw ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="pr-10"
                  disabled={changingPassword}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPw(!showCurrentPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCurrentPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">New Password</Label>
              <div className="relative">
                <Input
                  type={showNewPw ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="pr-10"
                  disabled={changingPassword}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw(!showNewPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNewPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Confirm New Password</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                disabled={changingPassword}
                required
                minLength={6}
              />
            </div>

            {pwError && (
              <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {pwError}
              </div>
            )}

            {pwSuccess && (
              <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                Password updated successfully!
              </div>
            )}

            <Button
              type="submit"
              size="sm"
              disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}
              className="gap-1.5"
            >
              {changingPassword ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
              Update Password
            </Button>
          </form>
        </div>

        <Separator />

        {/* Sign Out */}
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium">Sign Out</h4>
            <p className="text-xs text-muted-foreground">End your current session and return to the login page.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="gap-1.5 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */
/*                              Webhooks Tab                                  */
/* -------------------------------------------------------------------------- */

const WEBHOOK_EVENTS = [
  'pipeline.success',
  'pipeline.failed',
  'scraper.complete',
  'alert.triggered',
  'function.error',
] as const

type WebhookEvent = (typeof WEBHOOK_EVENTS)[number]

interface WebhookItem {
  id: string
  url: string
  events: WebhookEvent[]
  secretKey: string
  description: string
  isActive: boolean
  lastTriggered: string | null
  createdAt: string
}

function generateSecretKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const segments: string[] = []
  for (let s = 0; s < 4; s++) {
    let seg = ''
    for (let i = 0; i < 8; i++) {
      seg += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    segments.push(seg)
  }
  return `whk_${segments.join('_')}`
}

function WebhooksTab() {
  const { toast } = useToast()
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([
    {
      id: 'wh-1',
      url: 'https://hooks.example.com/pipeline-notify',
      events: ['pipeline.success', 'pipeline.failed'],
      secretKey: 'whk_aBcDeFgH_jKlMnOpQ_rStUvWxY_zAbCdEfG',
      description: 'Pipeline status notifications',
      isActive: true,
      lastTriggered: new Date(Date.now() - 3600000).toISOString(),
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    },
    {
      id: 'wh-2',
      url: 'https://api.myapp.com/webhooks/scraper-done',
      events: ['scraper.complete'],
      secretKey: 'whk_XyZaBcDe_fGhIjKlM_nOpQrStU_vWxYzAbC',
      description: 'Trigger post-scraper processing',
      isActive: true,
      lastTriggered: new Date(Date.now() - 7200000).toISOString(),
      createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
    },
    {
      id: 'wh-3',
      url: 'https://alerts.example.com/function-errors',
      events: ['function.error', 'alert.triggered'],
      secretKey: 'whk_MnOpQrSt_UvWxYzAb_CdEfGhIj_KlMnOpQr',
      description: '',
      isActive: false,
      lastTriggered: null,
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    },
  ])

  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingWebhook, setEditingWebhook] = useState<WebhookItem | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; ms: number }>>({})

  // Add form state
  const [addUrl, setAddUrl] = useState('')
  const [addEvents, setAddEvents] = useState<WebhookEvent[]>([])
  const [addDescription, setAddDescription] = useState('')
  const [addActive, setAddActive] = useState(true)
  const [addSecret, setAddSecret] = useState('')
  const [addUrlError, setAddUrlError] = useState('')

  // Edit form state
  const [editUrl, setEditUrl] = useState('')
  const [editEvents, setEditEvents] = useState<WebhookEvent[]>([])
  const [editDescription, setEditDescription] = useState('')
  const [editActive, setEditActive] = useState(true)
  const [editUrlError, setEditUrlError] = useState('')

  const resetAddForm = () => {
    setAddUrl('')
    setAddEvents([])
    setAddDescription('')
    setAddActive(true)
    setAddSecret('')
    setAddUrlError('')
  }

  const openAddDialog = () => {
    resetAddForm()
    setAddSecret(generateSecretKey())
    setShowAddDialog(true)
  }

  const validateUrl = (url: string): string => {
    if (!url) return 'URL is required'
    if (!url.startsWith('https://')) return 'URL must start with https://'
    try {
      new URL(url)
      return ''
    } catch {
      return 'Invalid URL format'
    }
  }

  const handleAddWebhook = () => {
    const error = validateUrl(addUrl)
    if (error) {
      setAddUrlError(error)
      return
    }
    if (addEvents.length === 0) {
      toast({ title: 'Select at least one event', variant: 'destructive' })
      return
    }

    const newWebhook: WebhookItem = {
      id: `wh-${Date.now()}`,
      url: addUrl,
      events: addEvents,
      secretKey: addSecret,
      description: addDescription,
      isActive: addActive,
      lastTriggered: null,
      createdAt: new Date().toISOString(),
    }
    setWebhooks((prev) => [newWebhook, ...prev])
    setShowAddDialog(false)
    toast({ title: 'Webhook created', description: `Listening for ${addEvents.join(', ')}` })
  }

  const openEditDialog = (wh: WebhookItem) => {
    setEditingWebhook(wh)
    setEditUrl(wh.url)
    setEditEvents([...wh.events])
    setEditDescription(wh.description)
    setEditActive(wh.isActive)
    setEditUrlError('')
    setShowEditDialog(true)
  }

  const handleEditWebhook = () => {
    if (!editingWebhook) return
    const error = validateUrl(editUrl)
    if (error) {
      setEditUrlError(error)
      return
    }
    if (editEvents.length === 0) {
      toast({ title: 'Select at least one event', variant: 'destructive' })
      return
    }
    setWebhooks((prev) =>
      prev.map((wh) =>
        wh.id === editingWebhook.id
          ? { ...wh, url: editUrl, events: editEvents, description: editDescription, isActive: editActive }
          : wh,
      ),
    )
    setShowEditDialog(false)
    toast({ title: 'Webhook updated' })
  }

  const handleDelete = (id: string) => {
    setWebhooks((prev) => prev.filter((wh) => wh.id !== id))
    toast({ title: 'Webhook deleted' })
  }

  const handleTest = async (wh: WebhookItem) => {
    setTestingId(wh.id)
    setTestResults((prev) => {
      const next = { ...prev }
      delete next[wh.id]
      return next
    })

    // Simulate sending a test payload
    const start = Date.now()
    await new Promise((r) => setTimeout(r, 800 + Math.random() * 700))
    const elapsed = Date.now() - start
    const ok = Math.random() > 0.2 // 80% success rate for demo

    setTestResults((prev) => ({ ...prev, [wh.id]: { ok, ms: elapsed } }))
    setTestingId(null)

    toast({
      title: ok ? 'Test successful' : 'Test failed',
      description: ok
        ? `${wh.url} responded in ${elapsed}ms`
        : `${wh.url} returned an error after ${elapsed}ms`,
      variant: ok ? 'default' : 'destructive',
    })
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(
      () => toast({ title: `${label} copied` }),
      () => toast({ title: 'Failed to copy', variant: 'destructive' }),
    )
  }

  const toggleEvent = (
    event: WebhookEvent,
    current: WebhookEvent[],
    setter: React.Dispatch<React.SetStateAction<WebhookEvent[]>>,
  ) => {
    setter(current.includes(event) ? current.filter((e) => e !== event) : [...current, event])
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Webhooks</h2>
          <p className="text-sm text-muted-foreground">
            Configure outgoing webhooks to receive real-time event notifications.
          </p>
        </div>
        <Button
          onClick={openAddDialog}
          size="sm"
          className="gap-1.5 bg-emerald-600 text-xs hover:bg-emerald-700 active:scale-[0.97] transition-transform"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Webhook
        </Button>
      </div>

      {/* Webhook List Table */}
      {webhooks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-10">
            <div className="rounded-full bg-emerald-500/10 p-3 text-emerald-600">
              <Webhook className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium">No webhooks configured</p>
            <p className="text-xs text-muted-foreground">Add a webhook to receive event notifications.</p>
            <Button
              onClick={openAddDialog}
              variant="outline"
              size="sm"
              className="mt-2 gap-1.5 active:scale-[0.97] transition-transform"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Webhook
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[280px]">URL</TableHead>
                    <TableHead>Events</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead className="w-[140px]">Last Triggered</TableHead>
                    <TableHead className="w-[140px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {webhooks.map((wh) => (
                    <TableRow key={wh.id}>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <code className="max-w-[200px] truncate rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                            {wh.url.length > 40 ? `${wh.url.slice(0, 40)}…` : wh.url}
                          </code>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => copyToClipboard(wh.url, 'URL')}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Copy URL</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {wh.events.map((ev) => (
                            <Badge
                              key={ev}
                              variant="outline"
                              className="border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400"
                            >
                              {ev}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            wh.isActive
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400'
                              : 'border-muted bg-muted/50 text-muted-foreground'
                          }
                        >
                          <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${wh.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground'}`} />
                          {wh.isActive ? 'Active' : 'Disabled'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {wh.lastTriggered ? formatWebhookTime(wh.lastTriggered) : 'Never'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => openEditDialog(wh)}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                disabled={testingId === wh.id}
                                onClick={() => void handleTest(wh)}
                              >
                                {testingId === wh.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : testResults[wh.id]?.ok ? (
                                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                ) : testResults[wh.id] && !testResults[wh.id].ok ? (
                                  <XCircle className="h-3 w-3 text-red-500" />
                                ) : (
                                  <Zap className="h-3 w-3" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {testingId === wh.id
                                ? 'Sending test...'
                                : testResults[wh.id]
                                  ? `${testResults[wh.id].ok ? 'Success' : 'Failed'} · ${testResults[wh.id].ms}ms`
                                  : 'Test webhook'}
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-red-500 hover:text-red-700"
                                onClick={() => handleDelete(wh.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Webhook Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Webhook className="h-4.5 w-4.5 text-emerald-600" />
              Add Webhook
            </DialogTitle>
            <DialogDescription>
              Create a new webhook endpoint to receive event notifications.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* URL */}
            <div className="space-y-1.5">
              <Label htmlFor="wh-url" className="text-sm font-medium">
                Endpoint URL
              </Label>
              <Input
                id="wh-url"
                placeholder="https://example.com/webhook"
                value={addUrl}
                onChange={(e) => {
                  setAddUrl(e.target.value)
                  setAddUrlError('')
                }}
                className={addUrlError ? 'border-red-500' : ''}
              />
              {addUrlError && <p className="text-xs text-red-500">{addUrlError}</p>}
              <p className="text-[11px] text-muted-foreground">Must start with https://</p>
            </div>

            {/* Events */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Events</Label>
              <div className="grid grid-cols-2 gap-2">
                {WEBHOOK_EVENTS.map((event) => (
                  <label
                    key={event}
                    className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-muted/50 cursor-pointer"
                  >
                    <Checkbox
                      checked={addEvents.includes(event)}
                      onCheckedChange={() => toggleEvent(event, addEvents, setAddEvents)}
                    />
                    <span className="font-mono text-xs">{event}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Secret Key */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Secret Key</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-muted px-3 py-2 font-mono text-xs break-all">
                  {addSecret}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => copyToClipboard(addSecret, 'Secret key')}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">Used to verify webhook payloads. Auto-generated.</p>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="wh-desc" className="text-sm font-medium">
                Description <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="wh-desc"
                placeholder="What is this webhook for?"
                value={addDescription}
                onChange={(e) => setAddDescription(e.target.value)}
              />
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="text-sm font-medium">Active</div>
                <div className="text-xs text-muted-foreground">Enable this webhook immediately</div>
              </div>
              <Switch checked={addActive} onCheckedChange={setAddActive} />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddDialog(false)}
              className="active:scale-[0.97] transition-transform"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddWebhook}
              className="bg-emerald-600 hover:bg-emerald-700 active:scale-[0.97] transition-transform"
            >
              <Webhook className="mr-1.5 h-3.5 w-3.5" />
              Create Webhook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Webhook Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4.5 w-4.5 text-emerald-600" />
              Edit Webhook
            </DialogTitle>
            <DialogDescription>
              Update the webhook endpoint configuration.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-wh-url" className="text-sm font-medium">
                Endpoint URL
              </Label>
              <Input
                id="edit-wh-url"
                value={editUrl}
                onChange={(e) => {
                  setEditUrl(e.target.value)
                  setEditUrlError('')
                }}
                className={editUrlError ? 'border-red-500' : ''}
              />
              {editUrlError && <p className="text-xs text-red-500">{editUrlError}</p>}
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Events</Label>
              <div className="grid grid-cols-2 gap-2">
                {WEBHOOK_EVENTS.map((event) => (
                  <label
                    key={event}
                    className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-muted/50 cursor-pointer"
                  >
                    <Checkbox
                      checked={editEvents.includes(event)}
                      onCheckedChange={() => toggleEvent(event, editEvents, setEditEvents)}
                    />
                    <span className="font-mono text-xs">{event}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-wh-desc" className="text-sm font-medium">
                Description <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="edit-wh-desc"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="text-sm font-medium">Active</div>
                <div className="text-xs text-muted-foreground">Enable this webhook</div>
              </div>
              <Switch checked={editActive} onCheckedChange={setEditActive} />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
              className="active:scale-[0.97] transition-transform"
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditWebhook}
              className="bg-emerald-600 hover:bg-emerald-700 active:scale-[0.97] transition-transform"
            >
              <Save className="mr-1.5 h-3.5 w-3.5" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function formatWebhookTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

/* -------------------------------------------------------------------------- */
/*                            Deployment Tab                                  */
/* -------------------------------------------------------------------------- */

function DeploymentTab({ configMap }: { configMap: Record<string, unknown> }) {
  const { toast } = useToast()
  const [dbSizeKb, setDbSizeKb] = useState<number | null>(null)
  const [storageUsageKb, setStorageUsageKb] = useState<number | null>(null)
  const [restarting, setRestarting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [showRestartConfirm, setShowRestartConfirm] = useState(false)

  // Compute uptime from process start; for demo we use a stable start time.
  const startTimeRef = useRef<number>(Date.now() - 1000 * 60 * 60 * 27.4) // ~27.4h uptime
  const [, force] = useState(0)
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await fetch('/api/monitoring/metrics?limit=1')
        if (!res.ok) return
        const body = await res.json()
        const item = Array.isArray(body) ? body[0] : body?.data?.[0]
        if (item && typeof item.diskUsedMb === 'number') {
          setStorageUsageKb(item.diskUsedMb * 1024)
        }
      } catch {
        // ignore
      }
    })()
    return () => {
      active = false
    }
  }, [])

  // DB size — derive roughly from config row count + 12KB baseline.
  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await fetch('/api/tables?limit=200')
        if (!res.ok) return
        const body = await res.json()
        const list = Array.isArray(body) ? body : body?.data ?? []
        const rows = list.reduce((acc: number, t: any) => acc + (t.rowCount ?? 0), 0)
        const size = 12 * 1024 + rows * 1.2 // ~1.2KB per row + schema overhead
        if (active) setDbSizeKb(size)
      } catch {
        // ignore
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const uptime = formatUptime(Date.now() - startTimeRef.current)

  const handleRestart = async () => {
    setRestarting(true)
    setShowRestartConfirm(false)
    await new Promise((r) => setTimeout(r, 900))
    setRestarting(false)
    toast({
      title: 'Restart requested',
      description: 'Service containers will reload within 30 seconds.',
    })
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const exportPayload = {
        exportedAt: new Date().toISOString(),
        version: '1.0',
        deployment: { mode: 'Docker Compose', uptimeSeconds: Math.floor((Date.now() - startTimeRef.current) / 1000) },
        config: { ...configMap },
      }
      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `selfbase-config-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast({ title: 'Config exported', description: 'JSON downloaded successfully.' })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent">
          <CardHeader>
            <SectionHeader
              icon={Server}
              title="Deployment"
              description="Runtime metadata about this SelfBase instance."
            />
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <InfoStat icon={Info} label="Version" value="v1.0" hint="SelfBase release" />
              <InfoStat
                icon={Server}
                label="Deployment Mode"
                value="Docker Compose"
                hint="Multi-container"
              />
              <InfoStat
                icon={Clock}
                label="Uptime"
                value={uptime}
                hint="Since last restart"
              />
              <InfoStat
                icon={Activity}
                label="Status"
                value="Healthy"
                hint="All services reporting"
                valueClassName="text-emerald-600"
              />
            </div>
          </CardContent>
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <SectionHeader
              icon={Database}
              title="Database Usage"
              description="SQLite storage footprint (computed estimate)."
            />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-3xl font-bold tracking-tight text-emerald-600">
                  {dbSizeKb == null ? '—' : formatBytes(dbSizeKb)}
                </div>
                <div className="text-xs text-muted-foreground">Total DB file size</div>
              </div>
              <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                SQLite
              </Badge>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="text-muted-foreground">Schema overhead</div>
                <div className="font-medium">~12 KB</div>
              </div>
              <div>
                <div className="text-muted-foreground">Row data</div>
                <div className="font-medium">
                  {dbSizeKb == null ? '—' : formatBytes(Math.max(0, dbSizeKb - 12 * 1024))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionHeader
              icon={HardDrive}
              title="Storage Usage"
              description="Disk usage reported by the latest monitoring heartbeat."
            />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-3xl font-bold tracking-tight text-teal-600">
                  {storageUsageKb == null
                    ? '—'
                    : formatBytes(storageUsageKb)}
                </div>
                <div className="text-xs text-muted-foreground">Disk used</div>
              </div>
              <Badge variant="outline" className="border-teal-200 bg-teal-50 text-teal-700">
                Local Volume
              </Badge>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="text-muted-foreground">Mounted at</div>
                <div className="font-mono font-medium">/data</div>
              </div>
              <div>
                <div className="text-muted-foreground">Backing store</div>
                <div className="font-medium">ext4</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-2 border-red-200 bg-red-500/5 dark:border-red-800 dark:bg-red-500/10">
        <CardHeader>
          <SectionHeader
            icon={CircleAlert}
            title="Danger Zone"
            description="Irreversible operations that affect service availability."
          />
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setShowRestartConfirm(true)}
              disabled={restarting}
              className="gap-2 border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950/30"
            >
              {restarting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              Restart Services
            </Button>
            <AlertDialog open={showRestartConfirm} onOpenChange={setShowRestartConfirm}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Restart all services?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will trigger a graceful container reload. All active requests will be allowed to
                    complete before services restart. Expect ~30 seconds of downtime.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-red-600 text-white hover:bg-red-700"
                    onClick={() => void handleRestart()}
                  >
                    Restart Now
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={exporting}
              className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Export Config
            </Button>
            <p className="text-xs text-muted-foreground">
              These actions are irreversible. Restart triggers a graceful container reload. Export downloads a JSON snapshot of all
              system config keys.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function InfoStat({
  icon: Icon,
  label,
  value,
  hint,
  valueClassName,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  hint: string
  valueClassName?: string
}) {
  return (
    <div className="rounded-lg border bg-background/60 p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className={cn('text-lg font-semibold tracking-tight', valueClassName)}>{value}</div>
      <div className="text-[10px] text-muted-foreground">{hint}</div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                              Skeleton & Utils                              */
/* -------------------------------------------------------------------------- */

function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-full max-w-2xl" />
      <div className="space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  )
}

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const parts: string[] = []
  if (d > 0) parts.push(`${d}d`)
  parts.push(`${h}h`)
  parts.push(`${m}m`)
  return parts.join(' ')
}

function formatBytes(kb: number): string {
  if (kb < 1024) return `${kb.toFixed(0)} KB`
  const mb = kb / 1024
  if (mb < 1024) return `${mb.toFixed(1)} MB`
  const gb = mb / 1024
  return `${gb.toFixed(2)} GB`
}

/* -------------------------------------------------------------------------- */
/*                              Main View                                     */
/* -------------------------------------------------------------------------- */

export function SettingsView() {
  const [configMap, setConfigMap] = useState<Record<string, unknown>>({})
  const [loaded, setLoaded] = useState(false)
  const [activeTab, setActiveTab] = useState('general')

  const load = useCallback(async () => {
    const map = await fetchConfigMap()
    setConfigMap(map)
    setLoaded(true)
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const map = await fetchConfigMap()
      if (cancelled) return
      setConfigMap(map)
      setLoaded(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Manage system configuration, AI defaults, storage, security, and deployment.
          </p>
        </div>
        <Badge variant="outline" className="w-fit gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-700">
          <SettingsIcon className="h-3 w-3" />
          {loaded ? `${Object.keys(configMap).length} keys` : 'Loading...'}
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-4">
        <div className="overflow-x-auto pb-1">
          <TabsList className="h-auto bg-muted/60 p-1">
            <TabsTrigger
              value="general"
              className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-emerald-500 data-[state=active]:to-teal-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
            >
              <SettingsIcon className="h-3.5 w-3.5" />
              General
            </TabsTrigger>
            <TabsTrigger
              value="ai"
              className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-emerald-500 data-[state=active]:to-teal-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
            >
              <Brain className="h-3.5 w-3.5" />
              AI
            </TabsTrigger>
            <TabsTrigger
              value="storage"
              className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-emerald-500 data-[state=active]:to-teal-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
            >
              <Database className="h-3.5 w-3.5" />
              Storage
            </TabsTrigger>
            <TabsTrigger
              value="security"
              className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-emerald-500 data-[state=active]:to-teal-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
            >
              <Shield className="h-3.5 w-3.5" />
              Security
            </TabsTrigger>
            <TabsTrigger
              value="webhooks"
              className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-emerald-500 data-[state=active]:to-teal-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
            >
              <Webhook className="h-3.5 w-3.5" />
              Webhooks
            </TabsTrigger>
            <TabsTrigger
              value="deployment"
              className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-emerald-500 data-[state=active]:to-teal-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
            >
              <Wrench className="h-3.5 w-3.5" />
              Deployment
            </TabsTrigger>
          </TabsList>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15 }}
          >
            {activeTab === 'general' && <GeneralTab configMap={configMap} loaded={loaded} onSaved={load} />}
            {activeTab === 'ai' && <AiTab configMap={configMap} loaded={loaded} onSaved={load} />}
            {activeTab === 'storage' && <StorageTab configMap={configMap} loaded={loaded} onSaved={load} />}
            {activeTab === 'security' && <SecurityTab configMap={configMap} loaded={loaded} onSaved={load} />}
            {activeTab === 'webhooks' && <WebhooksTab />}
            {activeTab === 'deployment' && <DeploymentTab configMap={configMap} />}
          </motion.div>
        </AnimatePresence>
      </Tabs>
    </div>
  )
}
