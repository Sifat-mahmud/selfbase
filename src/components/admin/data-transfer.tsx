'use client'

import { useState, useEffect, useRef } from 'react'
import { apiGet, apiPost } from '@/lib/api-client'
import {
  ArrowRightLeft, Download, Upload, Sparkles, Copy, Check,
  Table as TableIcon, GitBranch, Globe, Code, FileJson,
  ChevronDown, ChevronUp, Loader2, AlertCircle, X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

// ─── AI Prompt Templates ─────────────────────────────────────────────────────

const AI_PROMPTS: Record<string, string> = {
  tables: `You are a SelfBase schema designer. SelfBase is a self-hosted, local-first, AI-native Backend-as-a-Service platform. Generate a table definition in the following JSON format:

{
  "selfbase_format": "1.0",
  "type": "tables",
  "items": [
    {
      "name": "string (lowercase, underscores only, e.g. user_profiles)",
      "displayName": "string (human-readable name)",
      "description": "string (what this table stores)",
      "columns": [
        {
          "name": "string (column name)",
          "type": "TEXT | INTEGER | DECIMAL | BOOLEAN | TIMESTAMP | JSON | UUID",
          "nullable": boolean,
          "isPrimaryKey": boolean,
          "isUnique": boolean,
          "isIndexed": boolean,
          "defaultValue": "string or null"
        }
      ],
      "rows": [
        { "columnName": value }
      ]
    }
  ]
}

Rules:
- Table names must be lowercase with underscores
- Every table needs a primary key column
- Use INTEGER for IDs/counts, TEXT for strings, DECIMAL for prices, TIMESTAMP for dates
- Include 3-5 realistic sample rows matching the column definitions
- Add indexes on frequently queried columns (foreign keys, status fields)

⚠️ IMPORTANT — DO NOT ASSUME:
- If the user does not specify a table name, ASK them what they want to store
- If the user's description is vague, ASK clarifying questions before generating
- Do NOT guess column names or types — confirm with the user if unsure
- Do NOT invent business logic the user didn't mention

Generate a table for: [DESCRIBE YOUR TABLE HERE]`,

  pipelines: `You are a SelfBase pipeline designer. SelfBase is a self-hosted BaaS platform that fetches data from external sources and writes to local tables. Generate a data pipeline configuration in this JSON format:

{
  "selfbase_format": "1.0",
  "type": "pipelines",
  "items": [
    {
      "name": "string (descriptive pipeline name)",
      "description": "string",
      "sourceType": "rest | rss | websocket | scraper",
      "url": "string (MUST be a real, accessible API endpoint URL — do NOT guess or invent URLs)",
      "method": "GET | POST",
      "headers": { "key": "value" },
      "authType": "none | bearer | basic | api_key",
      "authConfig": { "token": "" },
      "jsonPath": "string (dot-notation path to data array, e.g. 'data.results')",
      "fetchInterval": 300,
      "isActive": true,
      "onConflict": "update | insert | skip | replace | truncate",
      "targetTableName": "string (MUST be the name of an existing or planned table — do NOT leave empty)",
      "columnMappings": [{ "src": "source_field", "target": "db_column", "type": "TEXT" }],
      "primaryKeyCols": ["id"],
      "preRunAction": "none | truncate | archive"
    }
  ]
}

⚠️ CRITICAL RULES — READ CAREFULLY:

1. **URL is REQUIRED and must be real:**
   - You MUST provide an actual, working API URL in the "url" field.
   - Do NOT guess, invent, or assume URLs. If you don't know the exact API endpoint, DO NOT make one up.
   - If you do NOT have live internet access to verify the URL, you MUST:
     a) Tell the user: "I don't have live URL access. Please verify this URL works, or use Gemini/Grok/Perplexity which can access live URLs."
     b) Provide your best educated URL but clearly mark it with a comment: ⚠️ UNVERIFIED — please test this URL
   - If the user hasn't told you which API to use, ASK them: "Which API endpoint should this pipeline fetch from? Please provide the full URL."

2. **targetTableName is REQUIRED:**
   - You MUST provide a targetTableName. Do NOT leave it empty or null.
   - If the user hasn't specified which table to write to, ASK them: "Which table should the data be written to? You may need to create a table first using the Tables prompt."

3. **fetchInterval is REQUIRED:**
   - Minimum is 5 seconds. Do NOT set it to 0 or leave it out.
   - If the user hasn't specified how often to fetch, ASK: "How often should this pipeline run? (e.g., every 5 minutes, every hour, once a day?)"

4. **jsonPath is important:**
   - If you don't know the API response structure, you MUST say: "I cannot verify the API response structure. The jsonPath I've provided is a guess — please test the API first and adjust the jsonPath to match the actual response."
   - Consider suggesting the user test the API with curl or Postman first.

5. **DO NOT ASSUME:**
   - Do NOT assume authentication requirements — if the API needs auth and the user hasn't specified, ASK
   - Do NOT assume column mappings — if you haven't seen the actual API response, state that your mappings are unverified
   - Do NOT assume conflict resolution strategy — ASK the user if they want update/insert/skip/replace

Generate a pipeline for: [DESCRIBE YOUR DATA SOURCE — MUST INCLUDE THE API URL]`,

  scrapers: `You are a SelfBase web scraper designer. SelfBase is a self-hosted BaaS platform that scrapes web pages and writes data to local tables. Generate a web scraper configuration in this JSON format:

{
  "selfbase_format": "1.0",
  "type": "scrapers",
  "items": [
    {
      "name": "string (descriptive scraper name)",
      "description": "string",
      "startUrl": "string (MUST be a real, accessible webpage URL — do NOT guess or invent URLs)",
      "selectorTree": { "container": "CSS selector", "fields": { "title": "h2.title", "price": ".price" } },
      "paginationType": "none | click | scroll | url_pattern",
      "paginationConfig": { "nextSelector": "a.next", "maxPages": 5 },
      "targetTableName": "string (MUST be the name of an existing or planned table — do NOT leave empty)",
      "outputFormat": "json",
      "isActive": true,
      "fetchInterval": 3600,
      "rateLimitMs": 1000,
      "concurrency": 1,
      "respectRobotsTxt": true,
      "useStealth": false,
      "maxPages": 10
    }
  ]
}

⚠️ CRITICAL RULES — READ CAREFULLY:

1. **startUrl is REQUIRED and must be real:**
   - You MUST provide an actual, working webpage URL in the "startUrl" field.
   - Do NOT guess, invent, or assume URLs. If you don't know the exact page to scrape, DO NOT make one up.
   - If you do NOT have live internet access to verify the URL and inspect the page, you MUST:
     a) Tell the user: "I don't have live web access to inspect this page. The CSS selectors I provide may not work. Please use Gemini/Grok/Perplexity which can access live pages and generate accurate selectors."
     b) Provide your best guess at selectors but clearly mark them: ⚠️ UNVERIFIED — please inspect the page and adjust selectors
   - If the user hasn't told you which page to scrape, ASK them: "Which webpage should I scrape? Please provide the full URL."

2. **selectorTree must match the actual page:**
   - CSS selectors depend entirely on the page's HTML structure. Without seeing the page, selectors are unreliable.
   - If you haven't seen the page, you MUST warn: "I cannot verify these selectors without accessing the page. Please inspect the page (right-click → Inspect Element) and adjust the selectors to match the actual HTML."
   - Strongly suggest the user test with Gemini or another AI that has live web access for accurate selector generation.

3. **targetTableName is REQUIRED:**
   - You MUST provide a targetTableName. Do NOT leave it empty or null.
   - If the user hasn't specified which table to write to, ASK them: "Which table should scraped data go into? You may need to create a table first using the Tables prompt."

4. **fetchInterval is REQUIRED:**
   - Minimum is 5 seconds. Do NOT set it to 0 or leave it out.
   - If the user hasn't specified how often to scrape, ASK: "How often should this scraper run? Be respectful of the target site — don't scrape too frequently."

5. **Ethical scraping:**
   - Always set respectRobotsTxt: true unless the user explicitly opts out
   - Use reasonable rateLimitMs (at least 1000ms between requests)
   - Do NOT help scrape private/authenticated pages without the owner's consent

6. **DO NOT ASSUME:**
   - Do NOT assume the page structure — if you haven't seen the page, say so
   - Do NOT assume pagination exists — ask the user if the data spans multiple pages
   - Do NOT assume how many pages to scrape — ask the user

Generate a scraper for: [DESCRIBE THE WEBSITE — MUST INCLUDE THE URL]`,

  functions: `You are a SelfBase function designer. SelfBase is a self-hosted BaaS platform that runs serverless functions. Generate a serverless function in this JSON format:

{
  "selfbase_format": "1.0",
  "type": "functions",
  "items": [
    {
      "name": "string (function name, lowercase_underscores)",
      "description": "string (what this function does)",
      "code": "string (JavaScript/TypeScript code)",
      "runtime": "javascript | typescript",
      "triggerType": "http | schedule | event",
      "triggerConfig": { "cron": "0 9 * * *", "method": "POST" },
      "envVars": { "API_KEY": "your-key" },
      "timeoutMs": 30000,
      "memoryMb": 128,
      "isActive": true
    }
  ]
}

Rules:
- Code must export a handler function: module.exports.handler = async (input) => { ... }
- The input parameter contains request data for HTTP triggers
- Return an object with your response data
- Use envVars for secrets (never hardcode)
- timeoutMs max is 300000 (5 minutes)
- For schedule triggers, triggerConfig.cron uses standard cron format

⚠️ IMPORTANT — DO NOT ASSUME:
- If the user says "send an email" but doesn't specify the provider/API, ASK which email service to use
- If the user says "call an API" but doesn't give the URL, ASK for the exact endpoint
- If the user wants a schedule but doesn't specify the frequency, ASK how often it should run
- Do NOT invent API keys, tokens, or credentials — use envVars placeholders and tell the user to fill them in
- If you need an external API URL to make the function work and the user hasn't provided one, ASK — do NOT guess URLs

Generate a function for: [DESCRIBE WHAT IT SHOULD DO]`,
}

// ─── Entity Config ───────────────────────────────────────────────────────────

interface EntityConfig {
  key: string
  label: string
  icon: React.ReactNode
  exportUrl: string
  importUrl: string
  listUrl: string
}

const ENTITIES: EntityConfig[] = [
  { key: 'tables', label: 'Tables', icon: <TableIcon className="h-5 w-5" />, exportUrl: '/api/export/tables', importUrl: '/api/import/tables', listUrl: '/api/tables' },
  { key: 'pipelines', label: 'Pipelines', icon: <GitBranch className="h-5 w-5" />, exportUrl: '/api/export/pipelines', importUrl: '/api/import/pipelines', listUrl: '/api/pipelines' },
  { key: 'scrapers', label: 'Web Scrapers', icon: <Globe className="h-5 w-5" />, exportUrl: '/api/export/scrapers', importUrl: '/api/import/scrapers', listUrl: '/api/scrapers' },
  { key: 'functions', label: 'Functions', icon: <Code className="h-5 w-5" />, exportUrl: '/api/export/functions', importUrl: '/api/import/functions', listUrl: '/api/functions' },
]

// ─── Component ───────────────────────────────────────────────────────────────

export default function DataTransfer() {
  const [counts, setCounts] = useState<Record<string, number>>({ tables: 0, pipelines: 0, scrapers: 0, functions: 0 })
  const [showAiSection, setShowAiSection] = useState(true)
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null)
  const [importing, setImporting] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<{ entity: string; result: unknown } | null>(null)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [importEntity, setImportEntity] = useState<EntityConfig | null>(null)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importPreview, setImportPreview] = useState<string>('')
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append')
  const [importProgress, setImportProgress] = useState(false)
  const [importMethod, setImportMethod] = useState<'file' | 'paste'>('file')
  const [pastedJson, setPastedJson] = useState<string>('')
  const [lastAction, setLastAction] = useState<Record<string, string>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pasteAreaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { loadCounts() }, [])

  async function loadCounts() {
    try {
      const [tables, pipelines, scrapers, functions] = await Promise.all([
        apiGet<unknown[]>('/api/tables'),
        apiGet<unknown[]>('/api/pipelines'),
        apiGet<unknown[]>('/api/scrapers'),
        apiGet<unknown[]>('/api/functions'),
      ])
      setCounts({
        tables: Array.isArray(tables) ? tables.length : 0,
        pipelines: Array.isArray(pipelines) ? pipelines.length : 0,
        scrapers: Array.isArray(scrapers) ? scrapers.length : 0,
        functions: Array.isArray(functions) ? functions.length : 0,
      })
    } catch { /* ignore */ }
  }

  async function handleExport(entity: EntityConfig) {
    try {
      const data = await apiGet<Record<string, unknown>>(entity.exportUrl)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `selfbase-${entity.key}-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
      setLastAction(prev => ({ ...prev, [entity.key]: `Exported at ${new Date().toLocaleTimeString()}` }))
    } catch (err) {
      console.error('Export failed:', err)
      alert('Export failed. Please try again.')
    }
  }

  function openImportDialog(entity: EntityConfig) {
    setImportEntity(entity)
    setImportFile(null)
    setImportPreview('')
    setImportMode('append')
    setImportProgress(false)
    setImportMethod('file')
    setPastedJson('')
    setImportDialogOpen(true)
  }

  async function handleFileSelect(file: File) {
    setImportFile(file)
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      setImportPreview(JSON.stringify(json, null, 2).substring(0, 2000))
    } catch {
      setImportPreview('Invalid JSON file')
    }
  }

  async function executeImport() {
    if (!importEntity) return
    setImportProgress(true)
    try {
      let jsonText: string
      if (importMethod === 'paste') {
        jsonText = pastedJson.trim()
        if (!jsonText) { setImportProgress(false); return }
      } else {
        if (!importFile) { setImportProgress(false); return }
        jsonText = await importFile.text()
      }
      const json = JSON.parse(jsonText)
      const result = await apiPost<{ imported: number; skipped: number; errors: string[] }>(
        importEntity.importUrl,
        { ...json, mode: importMode }
      )
      setImportResult({ entity: importEntity.label, result })
      setLastAction(prev => ({ ...prev, [importEntity.key]: `Imported at ${new Date().toLocaleTimeString()}` }))
      await loadCounts()
    } catch (err) {
      setImportResult({ entity: importEntity!.label, result: { error: String(err) } })
    } finally {
      setImportProgress(false)
      setImportDialogOpen(false)
    }
  }

  async function copyPrompt(key: string) {
    await navigator.clipboard.writeText(AI_PROMPTS[key])
    setCopiedPrompt(key)
    setTimeout(() => setCopiedPrompt(null), 2000)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-emerald-100 p-2 dark:bg-emerald-900/30">
          <ArrowRightLeft className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Data Transfer</h1>
          <p className="text-sm text-muted-foreground">Export and import your SelfBase data, or use AI to generate configurations</p>
        </div>
      </div>

      {/* AI-Powered Generation Section */}
      <Card className="border-emerald-200 dark:border-emerald-800">
        <CardHeader className="cursor-pointer" onClick={() => setShowAiSection(!showAiSection)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <CardTitle className="text-lg">AI-Powered Generation</CardTitle>
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">New</Badge>
            </div>
            <Button variant="ghost" size="sm">
              {showAiSection ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        {showAiSection && (
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              Copy the format prompt below and ask <strong>ChatGPT</strong>, <strong>Claude</strong>, <strong>Gemini</strong>, or any AI to generate SelfBase configurations. Then import the AI-generated JSON here!
            </p>
            <Tabs defaultValue="tables" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="tables">Tables</TabsTrigger>
                <TabsTrigger value="pipelines">Pipelines</TabsTrigger>
                <TabsTrigger value="scrapers">Scrapers</TabsTrigger>
                <TabsTrigger value="functions">Functions</TabsTrigger>
              </TabsList>
              {Object.entries(AI_PROMPTS).map(([key, prompt]) => (
                <TabsContent key={key} value={key} className="space-y-3">
                  <div className="flex justify-end">
                    <Button size="sm" variant="outline" onClick={() => copyPrompt(key)}>
                      {copiedPrompt === key ? <Check className="mr-1 h-3 w-3" /> : <Copy className="mr-1 h-3 w-3" />}
                      {copiedPrompt === key ? 'Copied!' : 'Copy AI Prompt'}
                    </Button>
                  </div>
                  <pre className="max-h-64 overflow-auto rounded-lg bg-muted p-3 text-xs leading-relaxed whitespace-pre-wrap">
                    {prompt}
                  </pre>
                </TabsContent>
              ))}
            </Tabs>
            <div className="mt-4 rounded-lg border border-dashed border-emerald-300 bg-emerald-50 p-3 dark:border-emerald-700 dark:bg-emerald-950/20">
              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                <strong>💡 Pro Tip:</strong> Copy the prompt above → Paste in ChatGPT/Claude → Describe what you need → Get JSON → Import it below!
              </p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Export/Import Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {ENTITIES.map(entity => (
          <Card key={entity.key} className="group relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 to-teal-400 opacity-0 transition-opacity group-hover:opacity-100" />
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="rounded-md bg-muted p-1.5">{entity.icon}</div>
                  <CardTitle className="text-base">{entity.label}</CardTitle>
                </div>
                <Badge variant="secondary">{counts[entity.key]} {counts[entity.key] === 1 ? 'item' : 'items'}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => handleExport(entity)}>
                  <Download className="mr-1.5 h-3.5 w-3.5" /> Export JSON
                </Button>
                <Button size="sm" className="flex-1" onClick={() => openImportDialog(entity)}>
                  <Upload className="mr-1.5 h-3.5 w-3.5" /> Import JSON
                </Button>
              </div>
              {lastAction[entity.key] && (
                <p className="text-xs text-muted-foreground">{lastAction[entity.key]}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Import Result Toast */}
      {importResult && (
        <Card className={cn(
          'border',
          (importResult.result as Record<string, unknown>)?.errors && (importResult.result as { errors: string[] }).errors.length > 0
            ? 'border-amber-300' : 'border-emerald-300'
        )}>
          <CardContent className="flex items-start gap-3 pt-4">
            {(importResult.result as Record<string, unknown>)?.errors && (importResult.result as { errors: string[] }).errors.length > 0
              ? <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
              : <Check className="h-5 w-5 text-emerald-500 shrink-0" />
            }
            <div className="flex-1">
              <p className="font-medium text-sm">{importResult.entity} Import Complete</p>
              <p className="text-xs text-muted-foreground mt-1">
                Imported: {(importResult.result as { imported: number }).imported} | Skipped: {(importResult.result as { skipped: number }).skipped}
                {(importResult.result as { errors: string[] }).errors?.length > 0 && ` | Errors: ${(importResult.result as { errors: string[] }).errors.length}`}
              </p>
              {(importResult.result as { errors: string[] }).errors?.length > 0 && (
                <pre className="mt-2 max-h-24 overflow-auto rounded bg-muted p-2 text-xs">
                  {(importResult.result as { errors: string[] }).errors.join('\n')}
                </pre>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setImportResult(null)}>
              <X className="h-3 w-3" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" /> Import {importEntity?.label}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* File Upload Area */}
            <div
              className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 transition-colors hover:border-muted-foreground/50 cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); e.stopPropagation() }}
              onDrop={e => {
                e.preventDefault(); e.stopPropagation()
                const file = e.dataTransfer.files[0]
                if (file) handleFileSelect(file)
              }}
            >
              <FileJson className="mb-2 h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                {importFile ? importFile.name : 'Drop a JSON file here or click to browse'}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f) }}
              />
            </div>

            {/* Preview */}
            {importPreview && (
              <pre className="max-h-40 overflow-auto rounded-lg bg-muted p-3 text-xs">
                {importPreview}
                {importPreview.length >= 2000 && '\n... (truncated)'}
              </pre>
            )}

            {/* Mode Selector */}
            <div className="flex gap-2">
              <Button
                size="sm" variant={importMode === 'append' ? 'default' : 'outline'}
                onClick={() => setImportMode('append')}
              >
                Append (keep existing)
              </Button>
              <Button
                size="sm" variant={importMode === 'replace' ? 'destructive' : 'outline'}
                onClick={() => setImportMode('replace')}
              >
                Replace (delete existing)
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>Cancel</Button>
            <Button onClick={executeImport} disabled={!importFile || importProgress}>
              {importProgress ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
