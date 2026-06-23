'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Terminal, Play, Copy, Plus, Trash2, Send, Clock, Search,
  ChevronDown, ChevronRight, CheckCircle2, XCircle, AlertTriangle,
  Loader2, RotateCcw, FileJson, ArrowDownToLine, Hash, Zap, Activity,
  Gauge, Key, Shield, Smartphone, ArrowRight, Eye, EyeOff, RefreshCw,
  ExternalLink, Globe, Code2, Lock, Unlock, Database, Table2, Server,
  FileCode, BarChart3, Cpu, HardDrive, Upload, Download, Columns3,
  Rows3, Pencil, Trash, List, FolderOpen, Workflow, Bot, MessageSquare,
  Webhook, Eye as EyeIcon, Save, CheckCheck, Timer,
} from 'lucide-react'
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { apiGet, apiPost, apiDelete } from '@/lib/api-client'

// =====================================================================
// TYPES
// =====================================================================

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

interface EndpointTemplate {
  id: string
  category: string
  method: HttpMethod
  path: string
  description: string
  requiresAuth: boolean
  defaultBody?: string
  defaultParams?: Array<{ key: string; value: string }>
  defaultHeaders?: Array<{ key: string; value: string }>
}

interface KeyValueRow {
  id: string
  key: string
  value: string
}

interface ResponseData {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  durationMs: number
  sizeBytes: number
  ok: boolean
}

interface HistoryEntry {
  status: number
  durationMs: number
  timestamp: number
  ok: boolean
}

interface ApiKeyInfo {
  id: string
  name: string
  prefix: string
  permissions: string
  isActive: boolean
  lastUsedAt: string | null
  expiresAt: string | null
  createdAt: string
}

// =====================================================================
// CONSTANTS
// =====================================================================

const STORAGE_KEY_TOKEN = 'selfbase_playground_token'
const STORAGE_KEY_TOKEN_INFO = 'selfbase_playground_token_info'
const STORAGE_KEY_API_KEY = 'selfbase_playground_api_key'

function readFromLocalStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch { return fallback }
}

function writeToLocalStorage(key: string, value: unknown) {
  if (typeof window === 'undefined') return
  try {
    if (value === null || value === undefined) {
      localStorage.removeItem(key)
    } else {
      localStorage.setItem(key, JSON.stringify(value))
    }
  } catch { /* ignore */ }
}

const methodColors: Record<HttpMethod, string> = {
  GET: 'bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:text-emerald-400 dark:border-emerald-900',
  POST: 'bg-blue-500/10 text-blue-700 border-blue-200 dark:text-blue-400 dark:border-blue-900',
  PUT: 'bg-amber-500/10 text-amber-700 border-amber-200 dark:text-amber-400 dark:border-amber-900',
  DELETE: 'bg-red-500/10 text-red-700 border-red-200 dark:text-red-400 dark:border-red-900',
  PATCH: 'bg-purple-500/10 text-purple-700 border-purple-200 dark:text-purple-400 dark:border-purple-900',
}

const ENDPOINT_TEMPLATES: EndpointTemplate[] = [
  // ====== Auth API (for external apps) ======
  {
    id: 'v1-auth-login',
    category: '🔐 Auth API',
    method: 'POST',
    path: '/api/v1/auth/login',
    description: 'Login with API key → get short-lived token',
    requiresAuth: false,
    defaultBody: '',
    defaultHeaders: [{ key: 'Authorization', value: 'Bearer sb_live_your_api_key_here' }],
  },
  {
    id: 'v1-auth-validate',
    category: '🔐 Auth API',
    method: 'POST',
    path: '/api/v1/auth/validate',
    description: 'Validate if your token is still active',
    requiresAuth: true,
    defaultHeaders: [{ key: 'Authorization', value: 'Bearer your_token_here' }],
  },
  {
    id: 'v1-auth-logout',
    category: '🔐 Auth API',
    method: 'POST',
    path: '/api/v1/auth/logout',
    description: 'Revoke an active token',
    requiresAuth: true,
    defaultHeaders: [{ key: 'Authorization', value: 'Bearer your_token_here' }],
  },

  // ====== Sync API (Local-First / v1) ======
  {
    id: 'v1-data-fetch',
    category: '🔄 Sync API (Local-First)',
    method: 'GET',
    path: '/api/v1/data/{table}',
    description: 'Fetch table data with version info & ETag',
    requiresAuth: true,
    defaultParams: [
      { key: 'limit', value: '1000' },
      { key: 'offset', value: '0' },
      { key: 'since', value: '' },
    ],
    defaultHeaders: [{ key: 'If-None-Match', value: '' }],
  },
  {
    id: 'v1-version-check',
    category: '🔄 Sync API (Local-First)',
    method: 'GET',
    path: '/api/v1/version/{table}',
    description: 'HEAD check — returns ETag + row count headers only',
    requiresAuth: true,
    defaultHeaders: [{ key: 'If-None-Match', value: '' }],
  },

  // ====== Data API — Tables ======
  {
    id: 'data-tables-list',
    category: '📊 Data — Tables',
    method: 'GET',
    path: '/api/tables',
    description: 'List all tables',
    requiresAuth: true,
    defaultParams: [{ key: 'search', value: '' }],
  },
  {
    id: 'data-tables-get',
    category: '📊 Data — Tables',
    method: 'GET',
    path: '/api/tables/{id}',
    description: 'Get a single table by ID',
    requiresAuth: true,
  },
  {
    id: 'data-tables-create',
    category: '📊 Data — Tables',
    method: 'POST',
    path: '/api/tables',
    description: 'Create a new table with columns',
    requiresAuth: true,
    defaultBody: '{\n  "name": "items",\n  "displayName": "Items",\n  "columns": [\n    { "name": "title", "type": "TEXT", "nullable": false },\n    { "name": "qty", "type": "INTEGER" },\n    { "name": "price", "type": "REAL" },\n    { "name": "active", "type": "BOOLEAN" }\n  ]\n}',
  },
  {
    id: 'data-tables-update',
    category: '📊 Data — Tables',
    method: 'PUT',
    path: '/api/tables/{id}',
    description: 'Update table schema / metadata',
    requiresAuth: true,
    defaultBody: '{\n  "displayName": "Updated Name",\n  "columns": [\n    { "name": "title", "type": "TEXT" },\n    { "name": "qty", "type": "INTEGER" },\n    { "name": "tags", "type": "TEXT", "nullable": true }\n  ]\n}',
  },
  {
    id: 'data-tables-delete',
    category: '📊 Data — Tables',
    method: 'DELETE',
    path: '/api/tables/{id}',
    description: 'Delete a table and all its data',
    requiresAuth: true,
  },
  {
    id: 'data-tables-columns',
    category: '📊 Data — Tables',
    method: 'GET',
    path: '/api/tables/{id}/columns',
    description: 'Get table column definitions',
    requiresAuth: true,
  },
  {
    id: 'data-tables-version',
    category: '📊 Data — Tables',
    method: 'GET',
    path: '/api/tables/{id}/version',
    description: 'Get table version hash',
    requiresAuth: true,
  },

  // ====== Data API — Rows ======
  {
    id: 'data-rows-list',
    category: '📋 Data — Rows',
    method: 'GET',
    path: '/api/tables/{id}/rows',
    description: 'Query rows with pagination & search',
    requiresAuth: true,
    defaultParams: [
      { key: 'page', value: '1' },
      { key: 'pageSize', value: '50' },
      { key: 'search', value: '' },
      { key: 'sortField', value: '' },
      { key: 'sortOrder', value: 'desc' },
    ],
  },
  {
    id: 'data-rows-create',
    category: '📋 Data — Rows',
    method: 'POST',
    path: '/api/tables/{id}/rows',
    description: 'Insert a new row',
    requiresAuth: true,
    defaultBody: '{\n  "data": {\n    "title": "New Item",\n    "qty": 10,\n    "price": 9.99,\n    "active": true\n  }\n}',
  },
  {
    id: 'data-rows-get',
    category: '📋 Data — Rows',
    method: 'GET',
    path: '/api/tables/{id}/rows/{rowId}',
    description: 'Get a single row by ID',
    requiresAuth: true,
  },
  {
    id: 'data-rows-update',
    category: '📋 Data — Rows',
    method: 'PUT',
    path: '/api/tables/{id}/rows/{rowId}',
    description: 'Update an existing row',
    requiresAuth: true,
    defaultBody: '{\n  "data": {\n    "title": "Updated Item",\n    "qty": 20\n  }\n}',
  },
  {
    id: 'data-rows-delete',
    category: '📋 Data — Rows',
    method: 'DELETE',
    path: '/api/tables/{id}/rows/{rowId}',
    description: 'Delete a row by ID',
    requiresAuth: true,
  },

  // ====== Functions ======
  {
    id: 'functions-list',
    category: '⚡ Functions',
    method: 'GET',
    path: '/api/functions',
    description: 'List all serverless functions',
    requiresAuth: true,
  },
  {
    id: 'functions-get',
    category: '⚡ Functions',
    method: 'GET',
    path: '/api/functions/{id}',
    description: 'Get function details',
    requiresAuth: true,
  },
  {
    id: 'functions-run',
    category: '⚡ Functions',
    method: 'POST',
    path: '/api/functions/{id}/run',
    description: 'Invoke a serverless function',
    requiresAuth: true,
    defaultBody: '{\n  "input": {\n    "key": "value"\n  }\n}',
  },
  {
    id: 'functions-runs',
    category: '⚡ Functions',
    method: 'GET',
    path: '/api/functions/runs',
    description: 'List recent function execution runs',
    requiresAuth: true,
    defaultParams: [{ key: 'limit', value: '20' }],
  },
  {
    id: 'functions-create',
    category: '⚡ Functions',
    method: 'POST',
    path: '/api/functions',
    description: 'Create a new function',
    requiresAuth: true,
    defaultBody: '{\n  "name": "myFunction",\n  "description": "A sample function",\n  "code": "export default async function(input) { return { result: input }; }",\n  "runtime": "javascript"\n}',
  },
  {
    id: 'functions-update',
    category: '⚡ Functions',
    method: 'PUT',
    path: '/api/functions/{id}',
    description: 'Update function code / settings',
    requiresAuth: true,
    defaultBody: '{\n  "code": "export default async function(input) { return { updated: true, input }; }",\n  "description": "Updated function"\n}',
  },
  {
    id: 'functions-delete',
    category: '⚡ Functions',
    method: 'DELETE',
    path: '/api/functions/{id}',
    description: 'Delete a function',
    requiresAuth: true,
  },

  // ====== Pipelines ======
  {
    id: 'pipelines-list',
    category: '🔄 Pipelines',
    method: 'GET',
    path: '/api/pipelines',
    description: 'List all data pipelines',
    requiresAuth: true,
  },
  {
    id: 'pipelines-get',
    category: '🔄 Pipelines',
    method: 'GET',
    path: '/api/pipelines/{id}',
    description: 'Get pipeline details',
    requiresAuth: true,
  },
  {
    id: 'pipelines-run',
    category: '🔄 Pipelines',
    method: 'POST',
    path: '/api/pipelines/{id}/run',
    description: 'Trigger a pipeline execution',
    requiresAuth: true,
  },
  {
    id: 'pipelines-preview',
    category: '🔄 Pipelines',
    method: 'POST',
    path: '/api/pipelines/{id}/preview',
    description: 'Preview pipeline output (dry-run)',
    requiresAuth: true,
  },
  {
    id: 'pipelines-runs',
    category: '🔄 Pipelines',
    method: 'GET',
    path: '/api/pipelines/runs',
    description: 'List recent pipeline runs',
    requiresAuth: true,
    defaultParams: [{ key: 'limit', value: '20' }],
  },
  {
    id: 'pipelines-smart-preview',
    category: '🔄 Pipelines',
    method: 'POST',
    path: '/api/pipelines/smart-preview',
    description: 'AI-powered pipeline preview',
    requiresAuth: true,
    defaultBody: '{\n  "source": "url_or_text",\n  "options": {}\n}',
  },
  {
    id: 'pipelines-auto-create',
    category: '🔄 Pipelines',
    method: 'POST',
    path: '/api/pipelines/auto-create-table',
    description: 'Auto-create table from data schema',
    requiresAuth: true,
    defaultBody: '{\n  "tableName": "auto_items",\n  "sampleData": [{ "name": "Item 1", "value": 100 }]\n}',
  },
  {
    id: 'pipelines-create',
    category: '🔄 Pipelines',
    method: 'POST',
    path: '/api/pipelines',
    description: 'Create a new pipeline',
    requiresAuth: true,
    defaultBody: '{\n  "name": "My Pipeline",\n  "source": "url",\n  "config": {}\n}',
  },
  {
    id: 'pipelines-delete',
    category: '🔄 Pipelines',
    method: 'DELETE',
    path: '/api/pipelines/{id}',
    description: 'Delete a pipeline',
    requiresAuth: true,
  },

  // ====== AI API ======
  {
    id: 'ai-chat',
    category: '🤖 AI',
    method: 'POST',
    path: '/api/ai/chat',
    description: 'AI chat completion',
    requiresAuth: true,
    defaultBody: '{\n  "messages": [\n    { "role": "user", "content": "Hello, how are you?" }\n  ],\n  "model": "default"\n}',
  },
  {
    id: 'ai-embed',
    category: '🤖 AI',
    method: 'POST',
    path: '/api/ai/embed',
    description: 'Generate text embeddings',
    requiresAuth: true,
    defaultBody: '{\n  "texts": ["Hello world", "Another text"]\n}',
  },
  {
    id: 'ai-rag',
    category: '🤖 AI',
    method: 'POST',
    path: '/api/ai/rag',
    description: 'RAG query — retrieve + generate',
    requiresAuth: true,
    defaultBody: '{\n  "query": "What is SelfBase?",\n  "topK": 5\n}',
  },
  {
    id: 'ai-search',
    category: '🤖 AI',
    method: 'POST',
    path: '/api/ai/search',
    description: 'AI-powered web search',
    requiresAuth: true,
    defaultBody: '{\n  "query": "latest news about AI",\n  "numResults": 5\n}',
  },
  {
    id: 'ai-llm-configs',
    category: '🤖 AI',
    method: 'GET',
    path: '/api/ai/llm-config',
    description: 'List LLM configurations',
    requiresAuth: true,
  },
  {
    id: 'ai-calls',
    category: '🤖 AI',
    method: 'GET',
    path: '/api/ai/calls',
    description: 'List recent AI API call logs',
    requiresAuth: true,
    defaultParams: [{ key: 'limit', value: '20' }],
  },

  // ====== Storage ======
  {
    id: 'storage-list',
    category: '💾 Storage',
    method: 'GET',
    path: '/api/storage',
    description: 'List stored files',
    requiresAuth: true,
    defaultParams: [{ key: 'limit', value: '50' }],
  },
  {
    id: 'storage-get',
    category: '💾 Storage',
    method: 'GET',
    path: '/api/storage/{id}',
    description: 'Get file metadata by ID',
    requiresAuth: true,
  },
  {
    id: 'storage-upload-url',
    category: '💾 Storage',
    method: 'POST',
    path: '/api/storage/upload-url',
    description: 'Get a presigned upload URL',
    requiresAuth: true,
    defaultBody: '{\n  "fileName": "photo.jpg",\n  "contentType": "image/jpeg",\n  "sizeBytes": 102400\n}',
  },
  {
    id: 'storage-delete',
    category: '💾 Storage',
    method: 'DELETE',
    path: '/api/storage/{id}',
    description: 'Delete a stored file',
    requiresAuth: true,
  },

  // ====== Scrapers ======
  {
    id: 'scrapers-list',
    category: '🌐 Scrapers',
    method: 'GET',
    path: '/api/scrapers',
    description: 'List all scrapers',
    requiresAuth: true,
  },
  {
    id: 'scrapers-get',
    category: '🌐 Scrapers',
    method: 'GET',
    path: '/api/scrapers/{id}',
    description: 'Get scraper details',
    requiresAuth: true,
  },
  {
    id: 'scrapers-run',
    category: '🌐 Scrapers',
    method: 'POST',
    path: '/api/scrapers/{id}/run',
    description: 'Trigger a scraper run',
    requiresAuth: true,
  },
  {
    id: 'scrapers-preview',
    category: '🌐 Scrapers',
    method: 'POST',
    path: '/api/scrapers/{id}/preview',
    description: 'Preview scraper output',
    requiresAuth: true,
  },
  {
    id: 'scrapers-runs',
    category: '🌐 Scrapers',
    method: 'GET',
    path: '/api/scrapers/runs',
    description: 'List recent scraper runs',
    requiresAuth: true,
    defaultParams: [{ key: 'limit', value: '20' }],
  },
  {
    id: 'scrapers-create',
    category: '🌐 Scrapers',
    method: 'POST',
    path: '/api/scrapers',
    description: 'Create a new scraper',
    requiresAuth: true,
    defaultBody: '{\n  "name": "My Scraper",\n  "url": "https://example.com",\n  "config": {}\n}',
  },
  {
    id: 'scrapers-delete',
    category: '🌐 Scrapers',
    method: 'DELETE',
    path: '/api/scrapers/{id}',
    description: 'Delete a scraper',
    requiresAuth: true,
  },

  // ====== Monitoring ======
  {
    id: 'monitoring-load',
    category: '📈 Monitoring',
    method: 'GET',
    path: '/api/monitoring/load',
    description: 'Server load snapshot',
    requiresAuth: true,
  },
  {
    id: 'monitoring-metrics',
    category: '📈 Monitoring',
    method: 'GET',
    path: '/api/monitoring/metrics',
    description: 'System metrics overview',
    requiresAuth: true,
  },
  {
    id: 'monitoring-uptime',
    category: '📈 Monitoring',
    method: 'GET',
    path: '/api/monitoring/uptime',
    description: 'Uptime statistics',
    requiresAuth: true,
  },
  {
    id: 'monitoring-alerts',
    category: '📈 Monitoring',
    method: 'GET',
    path: '/api/monitoring/alerts',
    description: 'List monitoring alerts',
    requiresAuth: true,
    defaultParams: [{ key: 'limit', value: '20' }],
  },
  {
    id: 'monitoring-alert-events',
    category: '📈 Monitoring',
    method: 'GET',
    path: '/api/monitoring/alert-events',
    description: 'List alert event history',
    requiresAuth: true,
    defaultParams: [{ key: 'limit', value: '20' }],
  },
  {
    id: 'monitoring-heartbeat',
    category: '📈 Monitoring',
    method: 'POST',
    path: '/api/monitoring/heartbeat',
    description: 'Send a heartbeat ping',
    requiresAuth: true,
  },

  // ====== Queue ======
  {
    id: 'queue-list',
    category: '📨 Queue',
    method: 'GET',
    path: '/api/queue',
    description: 'List pending queue items',
    requiresAuth: true,
    defaultParams: [{ key: 'limit', value: '20' }],
  },
  {
    id: 'queue-get',
    category: '📨 Queue',
    method: 'GET',
    path: '/api/queue/{id}',
    description: 'Get a queue item by ID',
    requiresAuth: true,
  },
  {
    id: 'queue-drain',
    category: '📨 Queue',
    method: 'POST',
    path: '/api/queue/drain',
    description: 'Process all pending queue items',
    requiresAuth: true,
  },

  // ====== Logs ======
  {
    id: 'logs-list',
    category: '📝 Logs',
    method: 'GET',
    path: '/api/logs',
    description: 'View system logs',
    requiresAuth: true,
    defaultParams: [
      { key: 'limit', value: '50' },
      { key: 'level', value: '' },
      { key: 'source', value: '' },
    ],
  },
  {
    id: 'logs-source-errors',
    category: '📝 Logs',
    method: 'GET',
    path: '/api/logs/source-errors',
    description: 'View data source error logs',
    requiresAuth: true,
    defaultParams: [{ key: 'limit', value: '20' }],
  },
  {
    id: 'logs-function-errors',
    category: '📝 Logs',
    method: 'GET',
    path: '/api/logs/function-errors',
    description: 'View function execution error logs',
    requiresAuth: true,
    defaultParams: [{ key: 'limit', value: '20' }],
  },

  // ====== Import/Export ======
  {
    id: 'import-tables',
    category: '📦 Import / Export',
    method: 'POST',
    path: '/api/import/tables',
    description: 'Import table definitions',
    requiresAuth: true,
    defaultBody: '{\n  "data": []\n}',
  },
  {
    id: 'import-functions',
    category: '📦 Import / Export',
    method: 'POST',
    path: '/api/import/functions',
    description: 'Import function definitions',
    requiresAuth: true,
    defaultBody: '{\n  "data": []\n}',
  },
  {
    id: 'import-pipelines',
    category: '📦 Import / Export',
    method: 'POST',
    path: '/api/import/pipelines',
    description: 'Import pipeline definitions',
    requiresAuth: true,
    defaultBody: '{\n  "data": []\n}',
  },
  {
    id: 'import-scrapers',
    category: '📦 Import / Export',
    method: 'POST',
    path: '/api/import/scrapers',
    description: 'Import scraper definitions',
    requiresAuth: true,
    defaultBody: '{\n  "data": []\n}',
  },
  {
    id: 'export-tables',
    category: '📦 Import / Export',
    method: 'GET',
    path: '/api/export/tables',
    description: 'Export all table definitions',
    requiresAuth: true,
  },
  {
    id: 'export-functions',
    category: '📦 Import / Export',
    method: 'GET',
    path: '/api/export/functions',
    description: 'Export all function definitions',
    requiresAuth: true,
  },
  {
    id: 'export-pipelines',
    category: '📦 Import / Export',
    method: 'GET',
    path: '/api/export/pipelines',
    description: 'Export all pipeline definitions',
    requiresAuth: true,
  },
  {
    id: 'export-scrapers',
    category: '📦 Import / Export',
    method: 'GET',
    path: '/api/export/scrapers',
    description: 'Export all scraper definitions',
    requiresAuth: true,
  },

  // ====== Config ======
  {
    id: 'config-get',
    category: '⚙️ Config',
    method: 'GET',
    path: '/api/config',
    description: 'Get all system configuration',
    requiresAuth: true,
  },
  {
    id: 'config-get-key',
    category: '⚙️ Config',
    method: 'GET',
    path: '/api/config/{key}',
    description: 'Get a specific config value',
    requiresAuth: true,
  },

  // ====== API Key Management ======
  {
    id: 'apikeys-list',
    category: '🔑 API Keys',
    method: 'GET',
    path: '/api/api-keys',
    description: 'List all API keys',
    requiresAuth: true,
  },
  {
    id: 'apikeys-create',
    category: '🔑 API Keys',
    method: 'POST',
    path: '/api/api-keys',
    description: 'Create a new API key',
    requiresAuth: true,
    defaultBody: '{\n  "name": "My App",\n  "permissions": "read,write"\n}',
  },
  {
    id: 'apikeys-revoke',
    category: '🔑 API Keys',
    method: 'DELETE',
    path: '/api/api-keys/{id}',
    description: 'Revoke an API key',
    requiresAuth: true,
  },

  // ====== Auth Admin ======
  {
    id: 'auth-users',
    category: '👤 Auth / Users',
    method: 'GET',
    path: '/api/auth/users',
    description: 'List all users',
    requiresAuth: true,
  },
  {
    id: 'auth-user-get',
    category: '👤 Auth / Users',
    method: 'GET',
    path: '/api/auth/users/{id}',
    description: 'Get user details',
    requiresAuth: true,
  },
  {
    id: 'auth-sessions',
    category: '👤 Auth / Users',
    method: 'GET',
    path: '/api/auth/sessions',
    description: 'List active sessions',
    requiresAuth: true,
  },
  {
    id: 'auth-change-password',
    category: '👤 Auth / Users',
    method: 'POST',
    path: '/api/auth/change-password',
    description: 'Change user password',
    requiresAuth: true,
    defaultBody: '{\n  "currentPassword": "old",\n  "newPassword": "newSecurePassword123"\n}',
  },
  {
    id: 'auth-admin-apikeys',
    category: '👤 Auth / Users',
    method: 'GET',
    path: '/api/auth/api-keys',
    description: 'List auth API keys (admin view)',
    requiresAuth: true,
  },
]

let _rowIdCounter = 0
function newRowId() { _rowIdCounter += 1; return `row-${Date.now()}-${_rowIdCounter}` }

function toKv(arr: Array<{ key: string; value: string }> | undefined): KeyValueRow[] {
  if (!arr || arr.length === 0) return [{ id: newRowId(), key: '', value: '' }]
  return arr.map(r => ({ id: newRowId(), key: r.key, value: r.value }))
}

// =====================================================================
// SUB-COMPONENTS
// =====================================================================

function MethodBadge({ method, className }: { method: HttpMethod; className?: string }) {
  return (
    <span className={`inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-[10px] font-bold tracking-wide ${methodColors[method]} ${className ?? ''}`}>
      {method}
    </span>
  )
}

function StatusBadge({ status }: { status: number }) {
  const firstDigit = String(status).charAt(0)
  const colorMap: Record<string, string> = {
    '2': 'bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:text-emerald-400 dark:border-emerald-900',
    '3': 'bg-blue-500/10 text-blue-700 border-blue-200 dark:text-blue-400 dark:border-blue-900',
    '4': 'bg-amber-500/10 text-amber-700 border-amber-200 dark:text-amber-400 dark:border-amber-900',
    '5': 'bg-red-500/10 text-red-700 border-red-200 dark:text-red-400 dark:border-red-900',
  }
  const cls = colorMap[firstDigit] ?? 'bg-muted text-muted-foreground border-border'
  return <span className={`inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-bold ${cls}`}>{status}</span>
}

function formatBytes(n: number) { return n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / (1024 * 1024)).toFixed(2)} MB` }
function formatDuration(ms: number) { return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(2)} s` }

// =====================================================================
// KEY-VALUE EDITOR
// =====================================================================

function KvEditor({ rows, onChange, keyPlaceholder = 'key', valuePlaceholder = 'value' }: {
  rows: KeyValueRow[]; onChange: (rows: KeyValueRow[]) => void; keyPlaceholder?: string; valuePlaceholder?: string
}) {
  const updateRow = (id: string, field: 'key' | 'value', val: string) => onChange(rows.map(r => r.id === id ? { ...r, [field]: val } : r))
  const removeRow = (id: string) => onChange(rows.filter(r => r.id !== id))
  const addRow = () => onChange([...rows, { id: newRowId(), key: '', value: '' }])

  return (
    <div className="space-y-2">
      {rows.map(row => (
        <div key={row.id} className="flex items-center gap-2">
          <Input value={row.key} onChange={e => updateRow(row.id, 'key', e.target.value)} placeholder={keyPlaceholder} className="h-8 font-mono text-xs flex-1" />
          <span className="text-muted-foreground text-xs">:</span>
          <Input value={row.value} onChange={e => updateRow(row.id, 'value', e.target.value)} placeholder={valuePlaceholder} className="h-8 font-mono text-xs flex-1" />
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeRow(row.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      ))}
      <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={addRow}><Plus className="h-3 w-3" />Add row</Button>
    </div>
  )
}

// =====================================================================
// AUTH FLOW SECTION
// =====================================================================

function AuthFlowSection({ onTokenObtained, initialToken, initialTokenInfo }: {
  onTokenObtained: (token: string) => void
  initialToken: string | null
  initialTokenInfo: { expiresAt: string; permissions: string[]; app: { name: string } } | null
}) {
  const { toast } = useToast()
  const [apiKeys, setApiKeys] = useState<ApiKeyInfo[]>([])
  const [creating, setCreating] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyPerms, setNewKeyPerms] = useState('read,write')
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [showCreatedKey, setShowCreatedKey] = useState(false)
  const [activeToken, setActiveToken] = useState<string | null>(initialToken)
  const [tokenInfo, setTokenInfo] = useState<{ expiresAt: string; permissions: string[]; app: { name: string } } | null>(initialTokenInfo)
  const [loginLoading, setLoginLoading] = useState(false)
  const [selectedApiKey, setSelectedApiKey] = useState<string>(readFromLocalStorage<string>(STORAGE_KEY_API_KEY, ''))

  useEffect(() => { loadApiKeys() }, [])

  async function loadApiKeys() {
    try {
      const data = await apiGet<{ data: ApiKeyInfo[] }>('/api/api-keys')
      const list = Array.isArray(data) ? data : (data as any)?.data ?? []
      setApiKeys(list)
    } catch { /* ignore */ }
  }

  async function createApiKey() {
    if (!newKeyName.trim()) return
    setCreating(true)
    try {
      const result = await apiPost<{ success: boolean; apiKey: { key: string } }>('/api/api-keys', {
        name: newKeyName.trim(),
        permissions: newKeyPerms,
      })
      if ((result as any).apiKey?.key) {
        setCreatedKey((result as any).apiKey.key)
        setShowCreatedKey(true)
        setNewKeyName('')
        await loadApiKeys()
        toast({ title: 'API Key created', description: 'Copy the key now — it won\'t be shown again!' })
      }
    } catch (err) {
      toast({ title: 'Failed to create key', variant: 'destructive' })
    } finally {
      setCreating(false)
    }
  }

  async function revokeKey(id: string) {
    try {
      await apiDelete(`/api/api-keys/${id}`)
      await loadApiKeys()
      toast({ title: 'API Key revoked' })
    } catch {
      toast({ title: 'Failed to revoke key', variant: 'destructive' })
    }
  }

  async function loginWithApiKey() {
    if (!selectedApiKey) {
      toast({ title: 'Select an API key first', variant: 'destructive' })
      return
    }
    setLoginLoading(true)
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { Authorization: `Bearer ${selectedApiKey}` },
      })
      const data = await res.json()
      if (res.ok && data.token) {
        setActiveToken(data.token)
        const info = {
          expiresAt: data.expiresAt,
          permissions: data.permissions,
          app: data.app,
        }
        setTokenInfo(info)
        writeToLocalStorage(STORAGE_KEY_TOKEN, data.token)
        writeToLocalStorage(STORAGE_KEY_TOKEN_INFO, info)
        writeToLocalStorage(STORAGE_KEY_API_KEY, selectedApiKey)
        onTokenObtained(data.token)
        toast({ title: 'Token obtained!', description: `Valid for ${Math.round(data.expiresIn / 60)} minutes` })
      } else {
        toast({ title: 'Login failed', description: data.error || 'Invalid API key', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Login failed', variant: 'destructive' })
    } finally {
      setLoginLoading(false)
    }
  }

  async function validateToken() {
    if (!activeToken) return
    try {
      const res = await fetch('/api/v1/auth/validate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${activeToken}` },
      })
      const data = await res.json()
      if (data.valid) {
        toast({ title: 'Token is valid', description: `Expires: ${new Date(data.expiresAt).toLocaleTimeString()}` })
      } else {
        toast({ title: 'Token invalid', description: data.error, variant: 'destructive' })
        setActiveToken(null)
        setTokenInfo(null)
        writeToLocalStorage(STORAGE_KEY_TOKEN, null)
        writeToLocalStorage(STORAGE_KEY_TOKEN_INFO, null)
      }
    } catch {
      toast({ title: 'Validation failed', variant: 'destructive' })
    }
  }

  async function logoutToken() {
    if (!activeToken) return
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${activeToken}` },
      })
      setActiveToken(null)
      setTokenInfo(null)
      writeToLocalStorage(STORAGE_KEY_TOKEN, null)
      writeToLocalStorage(STORAGE_KEY_TOKEN_INFO, null)
      toast({ title: 'Token revoked' })
    } catch { /* ignore */ }
  }

  return (
    <div className="space-y-4">
      {/* Auth Flow Diagram */}
      <Card className="border-2 border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50/50 via-teal-50/30 to-background dark:from-emerald-950/20 dark:via-teal-950/10 dark:to-background">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-5 w-5 text-emerald-600" />
            API Authentication Flow
          </CardTitle>
          <CardDescription>
            How external apps (iOS, Android, web) authenticate with SelfBase
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Visual Flow Diagram */}
          <div className="flex flex-col md:flex-row items-stretch gap-3">
            {/* Step 1 */}
            <div className="flex-1 rounded-lg border bg-background p-3 space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white text-xs font-bold">1</div>
                <span className="text-sm font-semibold">Generate API Key</span>
              </div>
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Create a key for your app in the dashboard below</p>
              </div>
              <div className="rounded bg-muted p-2">
                <code className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400">
                  sb_live_a1b2c3d4e5f6...
                </code>
              </div>
            </div>

            <div className="flex items-center justify-center">
              <ArrowRight className="h-5 w-5 text-emerald-400 hidden md:block" />
              <ChevronDown className="h-5 w-5 text-emerald-400 md:hidden" />
            </div>

            {/* Step 2 */}
            <div className="flex-1 rounded-lg border bg-background p-3 space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-500 text-white text-xs font-bold">2</div>
                <span className="text-sm font-semibold">Login with API Key</span>
              </div>
              <div className="flex items-center gap-2">
                <Code2 className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">App calls <code className="text-[10px]">/api/v1/auth/login</code></p>
              </div>
              <div className="rounded bg-muted p-2">
                <code className="text-[10px] font-mono">POST /api/v1/auth/login<br/>Auth: Bearer sb_live_...</code>
              </div>
            </div>

            <div className="flex items-center justify-center">
              <ArrowRight className="h-5 w-5 text-teal-400 hidden md:block" />
              <ChevronDown className="h-5 w-5 text-teal-400 md:hidden" />
            </div>

            {/* Step 3 */}
            <div className="flex-1 rounded-lg border bg-background p-3 space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-white text-xs font-bold">3</div>
                <span className="text-sm font-semibold">Use Token for API Calls</span>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Include token in all subsequent requests</p>
              </div>
              <div className="rounded bg-muted p-2">
                <code className="text-[10px] font-mono">GET /api/tables<br/>Auth: Bearer &lt;token&gt;</code>
              </div>
            </div>
          </div>

          {/* Token lifecycle info */}
          <div className="mt-4 flex flex-wrap gap-3">
            <div className="flex items-center gap-1.5 text-xs">
              <Clock className="h-3.5 w-3.5 text-amber-500" />
              <span>Token valid for <strong>1 hour</strong> (configurable in Settings)</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <RefreshCw className="h-3.5 w-3.5 text-teal-500" />
              <span>Re-login when token expires</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <Lock className="h-3.5 w-3.5 text-emerald-500" />
              <span>API keys never expire (unless revoked)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* API Key Management */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Key className="h-4 w-4 text-emerald-600" />
              API Keys
            </CardTitle>
            <CardDescription>Manage keys for your external applications</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Create new key */}
            <div className="flex gap-2">
              <Input
                placeholder="App name (e.g. My iOS App)"
                value={newKeyName}
                onChange={e => setNewKeyName(e.target.value)}
                className="h-8 text-sm"
                onKeyDown={e => e.key === 'Enter' && createApiKey()}
              />
              <Select value={newKeyPerms} onValueChange={setNewKeyPerms}>
                <SelectTrigger className="h-8 w-36 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="read">Read only</SelectItem>
                  <SelectItem value="read,write">Read & Write</SelectItem>
                  <SelectItem value="read,write,admin">Full Access</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" onClick={createApiKey} disabled={creating || !newKeyName.trim()} className="gap-1">
                {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Create
              </Button>
            </div>

            {/* Show created key */}
            {showCreatedKey && createdKey && (
              <div className="rounded-lg border-2 border-emerald-300 bg-emerald-50 p-3 dark:border-emerald-700 dark:bg-emerald-950/30 space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">API Key Created — Copy Now!</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-white dark:bg-gray-900 p-2 text-xs font-mono break-all select-all border">
                    {createdKey}
                  </code>
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(createdKey); toast({ title: 'Copied!' }) }}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  This key will not be shown again. Store it securely.
                </p>
                <Button size="sm" variant="ghost" onClick={() => { setShowCreatedKey(false); setCreatedKey(null) }}>Dismiss</Button>
              </div>
            )}

            {/* Existing keys list */}
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {apiKeys.length === 0 && (
                <p className="text-xs text-muted-foreground py-2">No API keys yet. Create one above to get started.</p>
              )}
              {apiKeys.map(key => (
                <div key={key.id} className="flex items-center justify-between rounded-lg border p-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{key.name}</span>
                      <Badge variant="outline" className="text-[10px]">{key.prefix}...</Badge>
                      {key.isActive ? (
                        <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200">Active</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">Revoked</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Permissions: {key.permissions} · Created {new Date(key.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700 shrink-0" onClick={() => revokeKey(key.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Login Test */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              Quick Auth Test
            </CardTitle>
            <CardDescription>Test the full authentication flow right here</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Step 1: Enter API Key */}
            <div className="space-y-2">
              <label className="text-xs font-medium flex items-center gap-1">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white text-[8px] font-bold">1</span>
                Enter your API Key
              </label>
              <div className="flex gap-2">
                <Input
                  placeholder="sb_live_xxxxxxxxxxxxxxxx"
                  value={selectedApiKey}
                  onChange={e => setSelectedApiKey(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
                <Button size="sm" onClick={loginWithApiKey} disabled={loginLoading || !selectedApiKey} className="gap-1">
                  {loginLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                  Login
                </Button>
              </div>
            </div>

            {/* Step 2: Token Result */}
            {activeToken && tokenInfo ? (
              <div className="space-y-3">
                <div className="rounded-lg border-2 border-emerald-300 bg-emerald-50 p-3 dark:border-emerald-700 dark:bg-emerald-950/30 space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Authenticated!</span>
                  </div>
                  <div className="space-y-1 text-xs">
                    <p><strong>App:</strong> {tokenInfo.app.name}</p>
                    <p><strong>Permissions:</strong> {tokenInfo.permissions.join(', ')}</p>
                    <p><strong>Expires:</strong> {new Date(tokenInfo.expiresAt).toLocaleTimeString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded bg-white dark:bg-gray-900 p-1.5 text-[10px] font-mono break-all select-all border">
                      {activeToken}
                    </code>
                    <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(activeToken); toast({ title: 'Token copied!' }) }}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={validateToken} className="gap-1">
                    <RefreshCw className="h-3 w-3" /> Validate
                  </Button>
                  <Button size="sm" variant="outline" onClick={logoutToken} className="gap-1 text-red-600 hover:text-red-700">
                    <Unlock className="h-3 w-3" /> Revoke Token
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 text-center">
                <Lock className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Enter an API key and click Login to get a token</p>
              </div>
            )}

            {/* Code snippet */}
            <div className="space-y-2">
              <label className="text-xs font-medium">Copy this code for your app:</label>
              <div className="rounded-lg bg-gray-950 p-3 text-xs font-mono text-gray-300 overflow-x-auto">
                <pre>{`// Swift (iOS)
let url = URL(string: "${window.location.origin}/api/v1/auth/login")!
var request = URLRequest(url: url)
request.httpMethod = "POST"
request.setValue("Bearer ${selectedApiKey || 'sb_live_your_key'}", forHTTPHeaderField: "Authorization")
let (data, _) = try await URLSession.shared.data(for: request)
// Parse token from response JSON

// Kotlin (Android)
val client = OkHttpClient()
val request = Request.Builder()
  .url("${window.location.origin}/api/v1/auth/login")
  .post("".toRequestBody())
  .addHeader("Authorization", "Bearer ${selectedApiKey || 'sb_live_your_key'}")
  .build()
val response = client.newCall(request).execute()`}</pre>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// =====================================================================
// MAIN PLAYGROUND COMPONENT
// =====================================================================

export function PlaygroundView() {
  const { toast } = useToast()
  const [activePlaygroundTab, setActivePlaygroundTab] = useState<'auth' | 'api'>('auth')

  const [selectedTemplate, setSelectedTemplate] = useState<EndpointTemplate | null>(null)
  const [method, setMethod] = useState<HttpMethod>('GET')
  const [url, setUrl] = useState('')
  const [params, setParams] = useState<KeyValueRow[]>(toKv([]))
  const [headers, setHeaders] = useState<KeyValueRow[]>(toKv([]))
  const [body, setBody] = useState('')
  const [activeTab, setActiveTab] = useState<'params' | 'headers' | 'body'>('params')
  const [response, setResponse] = useState<ResponseData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [history, setHistory] = useState<HistoryEntry[]>([])

  // Auth token for playground requests — persisted in localStorage
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [tokenInfo, setTokenInfo] = useState<{ expiresAt: string; permissions: string[]; app: { name: string } } | null>(null)
  const [hydrated, setHydrated] = useState(false)

  // Hydrate from localStorage on mount
  useEffect(() => {
    const storedToken = readFromLocalStorage<string | null>(STORAGE_KEY_TOKEN, null)
    const storedInfo = readFromLocalStorage<{ expiresAt: string; permissions: string[]; app: { name: string } } | null>(STORAGE_KEY_TOKEN_INFO, null)
    if (storedToken) {
      setAuthToken(storedToken)
      setTokenInfo(storedInfo)
      // Auto-switch to API tester tab if already authenticated
      setActivePlaygroundTab('api')
    }
    setHydrated(true)
  }, [])

  const clearAuthToken = useCallback(() => {
    setAuthToken(null)
    setTokenInfo(null)
    writeToLocalStorage(STORAGE_KEY_TOKEN, null)
    writeToLocalStorage(STORAGE_KEY_TOKEN_INFO, null)
  }, [])

  const filteredTemplates = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return ENDPOINT_TEMPLATES
    return ENDPOINT_TEMPLATES.filter(t =>
      t.path.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q) || t.method.toLowerCase().includes(q)
    )
  }, [search])

  const groupedTemplates = useMemo(() => {
    const map = new Map<string, EndpointTemplate[]>()
    filteredTemplates.forEach(t => {
      if (!map.has(t.category)) map.set(t.category, [])
      map.get(t.category)!.push(t)
    })
    return Array.from(map.entries())
  }, [filteredTemplates])

  const loadTemplate = useCallback((template: EndpointTemplate) => {
    setSelectedTemplate(template)
    setMethod(template.method)
    setUrl(template.path)
    setParams(toKv(template.defaultParams))
    // Auto-inject auth token into headers if template requires auth
    const defaultHeaders = toKv(template.defaultHeaders)
    if (template.requiresAuth && authToken) {
      const hasAuth = defaultHeaders.some(h => h.key.toLowerCase() === 'authorization')
      if (!hasAuth) {
        defaultHeaders.push({ id: newRowId(), key: 'Authorization', value: `Bearer ${authToken}` })
      } else {
        defaultHeaders.forEach(h => {
          if (h.key.toLowerCase() === 'authorization' && h.value.includes('your_token')) {
            h.value = `Bearer ${authToken}`
          }
        })
      }
    }
    setHeaders(defaultHeaders)
    setBody(template.defaultBody ?? '')
    setResponse(null)
    setError(null)
    setActiveTab(template.method === 'GET' || template.method === 'DELETE' ? 'params' : 'body')
  }, [authToken])

  const sendRequest = useCallback(async () => {
    if (!url) { toast({ title: 'URL is required', variant: 'destructive' }); return }
    setLoading(true); setError(null); setResponse(null)
    const startTime = performance.now()
    try {
      const urlObj = new URL(url, window.location.origin)
      params.forEach(p => { if (p.key.trim()) urlObj.searchParams.set(p.key, p.value) })

      const headerObj: Record<string, string> = {}
      headers.forEach(h => { if (h.key.trim()) headerObj[h.key] = h.value })
      const hasBody = method === 'POST' || method === 'PUT' || method === 'PATCH'
      if (!headerObj['Content-Type'] && hasBody) headerObj['Content-Type'] = 'application/json'

      const res = await fetch(urlObj.toString(), {
        method, headers: headerObj, body: hasBody && body ? body : undefined,
      })

      const responseText = await res.text()
      const durationMs = Math.round(performance.now() - startTime)
      const responseHeaders: Record<string, string> = {}
      res.headers.forEach((v, k) => { responseHeaders[k] = v })

      let responseBody = responseText
      try { responseBody = JSON.stringify(JSON.parse(responseText), null, 2) } catch { /* keep raw */ }

      const sizeBytes = new Blob([responseText]).size
      setResponse({ status: res.status, statusText: res.statusText, headers: responseHeaders, body: responseBody, durationMs, sizeBytes, ok: res.ok })
      setHistory(prev => [...prev, { status: res.status, durationMs, timestamp: Date.now(), ok: res.ok }].slice(-20))
      toast({ title: res.ok ? 'Request completed' : 'Request returned non-OK', description: `${res.status} · ${formatDuration(durationMs)} · ${formatBytes(sizeBytes)}`, variant: res.ok ? 'default' : 'destructive' })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Request failed'
      setError(msg)
      setHistory(prev => [...prev, { status: 0, durationMs: Math.round(performance.now() - startTime), timestamp: Date.now(), ok: false }].slice(-20))
      toast({ title: 'Request failed', description: msg, variant: 'destructive' })
    } finally { setLoading(false) }
  }, [url, params, headers, body, method, toast])

  const copyAsCurl = useCallback(() => {
    if (!url) return
    let cmd = `curl -X ${method} '${url}'`
    headers.forEach(h => { if (h.key.trim()) cmd += ` \\\n  -H '${h.key}: ${h.value}'` })
    if ((method === 'POST' || method === 'PUT' || method === 'PATCH') && body.trim()) cmd += ` \\\n  -d '${body.replace(/'/g, "'\\''")}'`
    navigator.clipboard.writeText(cmd)
    toast({ title: 'Copied as cURL' })
  }, [url, method, headers, body, toast])

  const hasBody = method === 'POST' || method === 'PUT' || method === 'PATCH'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Terminal className="h-6 w-6 text-emerald-600" />
            API Playground
            <Badge variant="outline" className="text-[10px] font-mono">{ENDPOINT_TEMPLATES.length} endpoints</Badge>
          </h1>
          <p className="text-sm text-muted-foreground">Test API endpoints and manage authentication for external apps</p>
        </div>
        {authToken && (
          <div className="flex items-center gap-2">
            {tokenInfo && (
              <span className="text-xs text-muted-foreground">
                {tokenInfo.app.name} · Expires {new Date(tokenInfo.expiresAt).toLocaleTimeString()}
              </span>
            )}
            <Badge className="gap-1.5 bg-emerald-100 text-emerald-700 border-emerald-200 w-fit">
              <CheckCircle2 className="h-3 w-3" /> Authenticated
            </Badge>
          </div>
        )}
      </div>

      {/* Main Tabs */}
      <Tabs value={activePlaygroundTab} onValueChange={v => setActivePlaygroundTab(v as 'auth' | 'api')}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="auth" className="gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            Authentication
          </TabsTrigger>
          <TabsTrigger value="api" className="gap-1.5">
            <Terminal className="h-3.5 w-3.5" />
            API Tester
          </TabsTrigger>
        </TabsList>

        <TabsContent value="auth" className="mt-4">
          <AuthFlowSection
            onTokenObtained={token => { setAuthToken(token); setActivePlaygroundTab('api') }}
            initialToken={authToken}
            initialTokenInfo={tokenInfo}
          />
        </TabsContent>

        <TabsContent value="api" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
            {/* Endpoint Library */}
            <Card className="lg:max-h-[calc(100vh-220px)] flex flex-col">
              <CardHeader className="pb-2 shrink-0">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input placeholder="Search endpoints..." value={search} onChange={e => setSearch(e.target.value)} className="h-8 pl-8 text-xs" />
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-2 pt-0 space-y-1">
                {groupedTemplates.map(([category, templates]) => (
                  <div key={category}>
                    <div className="flex items-center justify-between px-2 py-1.5">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{category}</p>
                      <Badge variant="secondary" className="text-[8px] h-4 px-1.5 font-mono">{templates.length}</Badge>
                    </div>
                    {templates.map(t => (
                      <button
                        key={t.id}
                        className={`w-full text-left rounded-md px-2 py-1.5 text-xs hover:bg-accent transition-colors flex items-center gap-2 group ${selectedTemplate?.id === t.id ? 'bg-accent ring-1 ring-primary/20' : ''}`}
                        onClick={() => loadTemplate(t)}
                      >
                        <MethodBadge method={t.method} className="shrink-0 text-[8px] px-1.5" />
                        <div className="flex-1 min-w-0">
                          <span className="truncate block">{t.description}</span>
                          <span className="text-[10px] font-mono text-muted-foreground/70 truncate block">{t.path}</span>
                        </div>
                        {t.requiresAuth && <Lock className="h-2.5 w-2.5 text-amber-500 shrink-0" />}
                      </button>
                    ))}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Request Builder */}
            <div className="space-y-4">
              {/* URL Bar */}
              <div className="flex gap-2">
                <Select value={method} onValueChange={v => setMethod(v as HttpMethod)}>
                  <SelectTrigger className={`h-10 w-24 font-mono text-sm font-bold ${methodColors[method]}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map(m => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="/api/..."
                  className="h-10 font-mono text-sm flex-1"
                />
                <Button onClick={sendRequest} disabled={loading} className="gap-1.5">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  Send
                </Button>
              </div>

              {/* Auth banner */}
              {authToken ? (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-800 dark:bg-emerald-950/20">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span className="text-xs text-emerald-700 dark:text-emerald-400">
                    Authenticated{tokenInfo ? ` as ${tokenInfo.app.name} · Expires ${new Date(tokenInfo.expiresAt).toLocaleTimeString()}` : ''} · <button className="underline" onClick={() => { navigator.clipboard.writeText(authToken); toast({ title: 'Token copied' }) }}>Copy token</button>
                  </span>
                  <Button size="sm" variant="ghost" className="ml-auto text-xs h-6" onClick={clearAuthToken}>Clear</Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800 dark:bg-amber-950/20">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <span className="text-xs text-amber-700 dark:text-amber-400">
                    No auth token set — go to <button className="underline font-medium" onClick={() => setActivePlaygroundTab('auth')}>Authentication tab</button> to login first
                  </span>
                </div>
              )}

              {/* Tabs: Params / Headers / Body */}
              <Tabs value={activeTab} onValueChange={v => setActiveTab(v as any)}>
                <TabsList className="h-8">
                  <TabsTrigger value="params" className="text-xs h-6">Params</TabsTrigger>
                  <TabsTrigger value="headers" className="text-xs h-6">Headers</TabsTrigger>
                  {hasBody && <TabsTrigger value="body" className="text-xs h-6">Body</TabsTrigger>}
                </TabsList>
                <TabsContent value="params"><KvEditor rows={params} onChange={setParams} keyPlaceholder="param" valuePlaceholder="value" /></TabsContent>
                <TabsContent value="headers"><KvEditor rows={headers} onChange={setHeaders} keyPlaceholder="Header" valuePlaceholder="Value" /></TabsContent>
                {hasBody && <TabsContent value="body"><Textarea value={body} onChange={e => setBody(e.target.value)} className="font-mono text-xs min-h-[120px]" placeholder="JSON body..." /></TabsContent>}
              </Tabs>

              {/* Response */}
              {(response || error) && (
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-sm">Response</CardTitle>
                        {response && <StatusBadge status={response.status} />}
                      </div>
                      {response && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{formatDuration(response.durationMs)}</span>
                          <span>{formatBytes(response.sizeBytes)}</span>
                          <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => { navigator.clipboard.writeText(response.body); toast({ title: 'Copied' }) }}><Copy className="h-3 w-3" /></Button>
                          <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={copyAsCurl}>cURL</Button>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {error ? (
                      <div className="rounded bg-red-50 dark:bg-red-950/20 p-3 text-sm text-red-700 dark:text-red-400">{error}</div>
                    ) : response && (
                      <pre className="max-h-96 overflow-auto rounded-lg bg-muted p-3 text-xs font-mono leading-relaxed whitespace-pre-wrap break-words">{response.body}</pre>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
