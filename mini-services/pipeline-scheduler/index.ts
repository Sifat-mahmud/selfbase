/**
 * Pipeline Auto-Run Scheduler
 *
 * Independent mini-service that periodically checks active pipelines
 * and triggers runs when the configured fetch interval has elapsed.
 *
 * Port: 3010
 * DB:    ../../db/custom.db (SQLite via bun:sqlite)
 */

import { Database } from 'bun:sqlite'
import { createServer } from 'http'

// ─── Configuration ───────────────────────────────────────────────────────────
const PORT = 3010
const CHECK_INTERVAL_MS = 5000
const MIN_INTERVAL_SEC = 5
const MAIN_APP_BASE = 'http://localhost:3000'
const DB_PATH = '../../db/custom.db'
const SCHEDULER_SECRET = process.env.SCHEDULER_SECRET || 'scheduler-internal-secret'

// ─── Database ────────────────────────────────────────────────────────────────
const db = new Database(DB_PATH)
db.exec('PRAGMA journal_mode = WAL')

const stmtActivePipelines = db.prepare(
  `SELECT id, name, "fetchInterval", "isActive" FROM PipelineSource WHERE "isActive" = 1`
)
const stmtLastRun = db.prepare(
  `SELECT "completedAt", "startedAt" FROM PipelineRun WHERE "sourceId" = ? ORDER BY "completedAt" DESC LIMIT 1`
)

// ─── State ───────────────────────────────────────────────────────────────────
let lastCheckTime: string | null = null
let activePipelineCount = 0

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseTime(val: string | number | null): number | null {
  if (val == null) return null
  if (typeof val === 'number') return val * 1000
  const ms = Date.parse(val)
  return Number.isNaN(ms) ? null : ms
}

function timeSince(dateStr: string | number | null): number | null {
  const t = parseTime(dateStr)
  if (t == null) return null
  return (Date.now() - t) / 1000
}

function formatInterval(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`
}

// ─── Scheduler Core ──────────────────────────────────────────────────────────

async function checkAndRun(): Promise<void> {
  try {
    const pipelines = stmtActivePipelines.all() as Array<{
      id: string; name: string; fetchInterval: number; isActive: number
    }>

    activePipelineCount = pipelines.length
    lastCheckTime = new Date().toISOString()

    for (const pipeline of pipelines) {
      const intervalSec = Math.max(pipeline.fetchInterval || 300, MIN_INTERVAL_SEC)
      const lastRun = stmtLastRun.get(pipeline.id) as {
        completedAt: string | null; startedAt: string | null
      } | null

      const lastTimeStr = lastRun?.completedAt ?? lastRun?.startedAt ?? null
      const elapsed = timeSince(lastTimeStr)

      if (elapsed === null || elapsed >= intervalSec) {
        try {
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), 60000)

          const response = await fetch(
            `${MAIN_APP_BASE}/api/pipelines/${pipeline.id}/run`,
            {
              method: 'POST',
              signal: controller.signal,
              headers: {
                'x-trigger-type': 'scheduler',
                'x-scheduler-secret': SCHEDULER_SECRET,
              },
            }
          )
          clearTimeout(timeout)

          const elapsedStr = elapsed !== null ? `after ${formatInterval(Math.round(elapsed))}` : '(first run)'
          console.log(
            `[Auto-Run] ${new Date().toISOString()} | ${pipeline.name} | ${response.status} ${response.statusText} | ${elapsedStr}`
          )
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err)
          console.error(`[Auto-Run Error] ${new Date().toISOString()} | ${pipeline.name} | ${message}`)
        }
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[Scheduler Error] ${new Date().toISOString()} | ${message}`)
  }
}

console.log(`[Scheduler] Starting pipeline auto-run scheduler on port ${PORT}`)
console.log(`[Scheduler] Check interval: ${CHECK_INTERVAL_MS / 1000}s, Min interval: ${MIN_INTERVAL_SEC}s`)
console.log(`[Scheduler] DB path: ${DB_PATH}`)

checkAndRun().catch(err => console.error(`[Scheduler] Initial check failed:`, err))

const schedulerTimer = setInterval(() => {
  checkAndRun().catch(err => console.error(`[Scheduler] Check failed:`, err))
}, CHECK_INTERVAL_MS)

// ─── HTTP API ────────────────────────────────────────────────────────────────

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  if (url.pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      status: 'ok',
      pipelines: activePipelineCount,
      lastCheck: lastCheckTime,
      checkIntervalMs: CHECK_INTERVAL_MS,
      minIntervalSec: MIN_INTERVAL_SEC,
    }))
    return
  }

  if (url.pathname.startsWith('/api/trigger/') && req.method === 'POST') {
    const id = url.pathname.split('/api/trigger/')[1]
    if (!id) { res.writeHead(400); res.end('Missing pipeline ID'); return }
    ;(async () => {
      try {
        const response = await fetch(`${MAIN_APP_BASE}/api/pipelines/${id}/run`, {
          method: 'POST',
          headers: {
            'x-trigger-type': 'scheduler',
            'x-scheduler-secret': SCHEDULER_SECRET,
          },
        })
        const body = await response.text()
        res.writeHead(response.status, { 'Content-Type': 'application/json' })
        res.end(body)
      } catch (err: unknown) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }))
      }
    })()
    return
  }

  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not found' }))
})

server.listen(PORT, () => {
  console.log(`[Scheduler] HTTP API listening on port ${PORT}`)
  console.log(`[Scheduler] Health check: GET /api/health`)
  console.log(`[Scheduler] Manual trigger: POST /api/trigger/:id`)
})

// ─── Graceful shutdown ───────────────────────────────────────────────────────
function shutdown() {
  console.log('[Scheduler] Shutting down...')
  clearInterval(schedulerTimer)
  db.close()
  server.close()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
