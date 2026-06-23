<p align="center">
  <img src="public/readme-hero.png" alt="SelfBase - Self-hosted Backend-as-a-Service" width="100%" />
</p>

<h1 align="center">SelfBase</h1>

<p align="center">
  <strong>Self-hosted Backend-as-a-Service</strong> — Your own Supabase, in your own infrastructure.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/TypeScript-5-blue?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/SQLite-Prisma-00354B?logo=sqlite" alt="SQLite + Prisma" />
  <img src="https://img.shields.io/badge/Realtime-Socket.IO-010101?logo=socket.io" alt="Socket.IO" />
  <img src="https://img.shields.io/badge/License-Private-red" alt="Private" />
</p>

---

## 🎯 What is SelfBase?

SelfBase is an **all-in-one, self-hosted backend platform** that gives you everything you need to build and run applications — without relying on third-party cloud services. Think of it as **your own Supabase/Firebase that runs entirely on your server**.

### Who is it for?

| Role | Why SelfBase? |
|------|--------------|
| **Mobile Developers** | Get a complete backend API for your iOS/Android app in minutes — auth, database, realtime, storage, and AI — all from one self-hosted service |
| **Web Developers** | Full REST API with 80+ endpoints, real-time subscriptions, and serverless functions — no cloud vendor lock-in |
| **Startups** | Ship faster with built-in auth, database, pipelines, AI, and monitoring — deploy on any VPS for $5/month |
| **Enterprises** | Keep all data on-premises, self-managed, with row-level security and audit logging |
| **Tinkerers** | A powerful playground to experiment with AI, web scraping, and data pipelines |

---

## ✨ Feature Overview

```
┌──────────────────────────────────────────────────────────────┐
│                      SelfBase v0.2.0                         │
│              Self-hosted Backend-as-a-Service                │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  🗄️  Database          📡  Realtime         🤖  AI Engine   │
│  ─────────────       ──────────────       ──────────────    │
│  Dynamic tables      WebSocket push        LLM Chat         │
│  Schema builder      Live subscriptions    Embeddings        │
│  Row CRUD            Version tracking      RAG queries       │
│  Version tracking    Auto-refresh UI       Vector search     │
│  Import/Export       Presence indicators   Multi-provider    │
│                                                              │
│  ⚡  Functions        🌐  Scrapers         📊  Monitoring   │
│  ─────────────       ──────────────       ──────────────    │
│  Serverless JS/TS    Web page scraping     System metrics    │
│  HTTP/schedule       Pagination handling   Heartbeat track   │
│  Event triggers      Stealth mode          Alert rules       │
│  Inline editor       Auto schema           Uptime stats      │
│                                                              │
│  🔄  Pipelines        🔐  Auth             💾  Storage      │
│  ─────────────       ──────────────       ──────────────    │
│  REST/RSS/WS         API Keys (sb_live_)   File buckets     │
│  Auto-scheduling     App Tokens (1hr)      Presigned URLs   │
│  Smart preview       Row-level security    Metadata         │
│  Column mapping      Session management    Public/private    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 🏗️ Architecture

<p align="center">
  <img src="public/readme-database.png" alt="SelfBase Architecture" width="80%" />
</p>

```
                          ┌─────────────────┐
                          │  Your Apps      │
                          │  (iOS/Android/  │
                          │   Web/Desktop)  │
                          └────────┬────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │ REST API     │ WebSocket     │ Auth
                    │ (80+ routes) │ (Socket.IO)  │ (API Keys)
                    └──────────────┼──────────────┘
                                   │
                          ┌────────▼────────┐
                          │   SelfBase       │
                          │   (Next.js 16)   │
                          │                  │
                          │  ┌────────────┐ │
                          │  │  Admin UI  │ │
                          │  │  Dashboard │ │
                          │  └────────────┘ │
                          │                  │
                          │  ┌────────────┐ │
                          │  │  API Layer │ │
                          │  │  /api/*    │ │
                          │  └────────────┘ │
                          │                  │
                          │  ┌────────────┐ │
                          │  │  Database  │ │
                          │  │  (SQLite)  │ │
                          │  └────────────┘ │
                          └──────────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
            ┌───────▼──────┐ ┌───▼──────┐ ┌────▼───────┐
            │  Pipeline     │ │ Realtime │ │  AI        │
            │  Scheduler    │ │ Service  │ │  (LLM/Emb) │
            │  (port 3004)  │ │(port 3003)│ │            │
            └──────────────┘ └──────────┘ └────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 (App Router) + React 19 |
| **Language** | TypeScript 5 (strict mode) |
| **Database** | SQLite via Prisma ORM |
| **UI** | shadcn/ui + Tailwind CSS 4 + Framer Motion |
| **Realtime** | Socket.IO (dedicated microservice) |
| **Auth** | NextAuth.js + API Keys + App Tokens |
| **AI** | z-ai-web-dev-sdk (OpenAI/Anthropic/Ollama) |
| **State** | Zustand + TanStack Query |
| **Scheduler** | Custom cron-based pipeline scheduler |

---

## 📡 Realtime Database

<p align="center">
  <img src="public/readme-realtime.png" alt="SelfBase Realtime" width="80%" />
</p>

Any table can be turned into a **realtime database** with a single toggle:

```
┌─────────────────────────────────────────────────────────────┐
│  Table: cse_stocks                                          │
│                                                              │
│  Features                                                    │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  🟢 Realtime    ⬜ Embeddings    ⬜ Row-Level Security ││
│  │  (toggle ON)                                             ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### How It Works

```
1. Toggle ON  →  PUT /api/tables/{id} { enableRealtime: true }

2. Row CRUD   →  API route → emitRealtimeEvent() → Socket.IO service

3. Subscribe  →  socket.emit('subscribe', { tableId: '...' })

4. Receive    →  socket.on('data-changed', (data) => { ... })
                  socket.on('update-available', (data) => { ... })
```

### Event Flow

| Action | Event | Payload |
|--------|-------|---------|
| **Insert** row | `data-changed` | `{ eventType: "insert", row: {...}, rowId }` |
| **Update** row | `data-changed` | `{ eventType: "update", row: {...}, version++ }` |
| **Delete** row | `data-changed` | `{ eventType: "delete", rowId }` |
| **Any** change | `update-available` | `{ versionHash, rowCount }` |

### Version Tracking

Every row has a `version` field that increments on update. Every table has a `versionHash` that changes on any mutation. This enables **local-first sync**:

```
Client: "I have versionHash abc123"
Server: "Current is def456 — here's the diff since your version"
        OR
Server: "304 Not Modified" (ETag match)
```

---

## 🔐 Authentication & API Access

SelfBase supports **three authentication methods** for different use cases:

### 1. Admin Session (Browser)
```
Browser → Login → Session Cookie → All Admin APIs
```

### 2. API Key → App Token (Mobile/External Apps)
```
┌──────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  1. Generate │────▶│  2. Login with   │────▶│  3. Use Token   │
│  API Key     │     │  API Key         │     │  for API Calls  │
│  sb_live_... │     │  POST /v1/auth/  │     │  Bearer token   │
│              │     │  login           │     │  (valid 1 hr)   │
└──────────────┘     └──────────────────┘     └─────────────────┘
```

```javascript
// Step 1: Login with API key
const res = await fetch('/api/v1/auth/login', {
  method: 'POST',
  headers: { Authorization: 'Bearer sb_live_your_api_key' }
})
const { token } = await res.json()

// Step 2: Use the token for all subsequent requests
const data = await fetch('/api/tables/my_table/rows', {
  headers: { Authorization: `Bearer ${token}` }
})
```

### 3. API Key Permissions

| Permission | Access |
|-----------|--------|
| `read` | GET endpoints only |
| `read,write` | GET + POST + PUT + DELETE |
| `read,write,admin` | Full access including schema changes |

---

## 📱 API Playground

SelfBase includes a **built-in API playground** with 85+ documented endpoints across 18 categories:

| Category | Endpoints | Description |
|----------|-----------|-------------|
| 🔐 Auth API | 3 | Login, validate, logout |
| 📡 Realtime | 5 | Subscribe, health, emit, toggle, sync |
| 🔄 Sync API | 2 | Local-first data fetch with ETag |
| 📊 Data — Tables | 7 | Full CRUD + columns + version |
| 📋 Data — Rows | 5 | CRUD with pagination & search |
| ⚡ Functions | 7 | Serverless function management |
| 🔄 Pipelines | 9 | Pipeline CRUD + run + preview |
| 🤖 AI | 6 | Chat, embed, RAG, search |
| 💾 Storage | 4 | File management |
| 🌐 Scrapers | 7 | Web scraping management |
| 📈 Monitoring | 6 | System health & alerts |
| 📨 Queue | 3 | Priority queue management |
| 📝 Logs | 3 | System & error logs |
| 📦 Import/Export | 8 | Data transfer |
| ⚙️ Config | 2 | System configuration |
| 🔑 API Keys | 3 | Key management |
| 👤 Auth/Users | 5 | User & session management |

### Playground Features
- 🔍 Search across all endpoints
- 📋 One-click cURL copy
- 🎯 Auto-inject auth token
- 📝 Pre-filled request bodies
- ⚡ Live response viewer with timing

---

## 🗄️ Database Management

### Dynamic Schema

Create tables with any column types — no migrations needed:

```
┌─────────────────────────────────────────────────────┐
│  Create Table                                        │
│                                                      │
│  Table Name: [ products        ]                    │
│  Description: [ Product catalog  ]                  │
│                                                      │
│  ┌──────────────┬──────────┬───────┬────────┐      │
│  │ Column Name  │ Type     │ Null? │ Unique │      │
│  ├──────────────┼──────────┼───────┼────────┤      │
│  │ id           │ INTEGER  │  ☐    │   ☑    │      │
│  │ name         │ TEXT     │  ☐    │   ☐    │      │
│  │ price        │ DECIMAL  │  ☑    │   ☐    │      │
│  │ in_stock     │ BOOLEAN  │  ☑    │   ☐    │      │
│  │ tags         │ JSON     │  ☑    │   ☐    │      │
│  └──────────────┴──────────┴───────┴────────┘      │
│                                                      │
│  [+ Add Column]                     [Create Table]    │
└─────────────────────────────────────────────────────┘
```

### Supported Column Types

| Type | Description | Example |
|------|------------|---------|
| `TEXT` | String values | `"Hello World"` |
| `INTEGER` | Whole numbers | `42` |
| `DECIMAL` | Floating point | `9.99` |
| `BOOLEAN` | True/false | `true` |
| `TIMESTAMP` | Date/time | `"2025-01-01T00:00:00Z"` |
| `JSON` | Nested objects | `{"key": "value"}` |

### View Data Dialog

```
┌─────────────────────────────────────────────────────────────────┐
│  📊 products — Rows  50 rows  🟢 RT                            │
│                                                                  │
│  🔍 Search...                    [Export ▾] [+ Add Row]        │
│  🟢 Live — listening for changes on products                    │
│                                                                  │
│  ┌───┬──────┬─────────┬───────┬──────────┬─────┬────────┐    │
│  │ ☐ │ #    │ name    │ price │ in_stock │ Ver │ Actions│    │
│  ├───┼──────┼─────────┼───────┼──────────┼─────┼────────┤    │
│  │ ☐ │ 1    │ Widget  │ 9.99  │ ✓ true   │ v1  │ ✏️ 🗑️  │    │
│  │ ☐ │ 2    │ Gadget  │ 24.99 │ ✗ false  │ v3  │ ✏️ 🗑️  │    │
│  │ ☐ │ 3    │ Thingy  │ 5.99  │ ✓ true   │ v1  │ ✏️ 🗑️  │    │
│  └───┴──────┴─────────┴───────┴──────────┴─────┴────────┘    │
│                                                                  │
│  Showing 1-50 of 50 rows           Page 1 of 1                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## ⚡ Serverless Functions

Write and deploy JavaScript/TypeScript functions that run on your server:

```javascript
// Example: Send notification on new order
export default async function(input) {
  const { orderId, customerEmail, total } = input
  
  // Query the database
  const order = await db.sbRow.findFirst({
    where: { id: orderId }
  })
  
  // Process the order
  await sendEmail(customerEmail, `Order confirmed: $${total}`)
  
  return { success: true, orderId }
}
```

### Trigger Types

| Trigger | When | Use Case |
|---------|------|---------|
| `http` | HTTP request | REST endpoints, webhooks |
| `schedule` | Cron schedule | Periodic cleanup, reports |
| `event` | Database event | Real-time reactions |

---

## 🤖 AI Integration

SelfBase includes a full AI engine with multiple capabilities:

```
┌─────────────────────────────────────────────────┐
│                 AI Engine                        │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │  💬 Chat │  │  📊 Embed│  │  🔍 RAG      │  │
│  │          │  │          │  │              │  │
│  │ Multi-   │  │ Text →   │  │ Retrieve +  │  │
│  │ turn     │  │ Vectors  │  │ Generate    │  │
│  │ convers- │  │ for      │  │ answers     │  │
│  │ ations   │  │ search   │  │ from data   │  │
│  └──────────┘  └──────────┘  └──────────────┘  │
│                                                  │
│  Providers: OpenAI · Anthropic · Ollama · Custom │
└─────────────────────────────────────────────────┘
```

### LLM Chat
```bash
curl -X POST /api/ai/chat \
  -H "Authorization: Bearer <token>" \
  -d '{"messages": [{"role": "user", "content": "Explain this data"}]}'
```

### Embeddings & Vector Search
```bash
# Generate embeddings
curl -X POST /api/ai/embed \
  -d '{"texts": ["Hello world", "Another text"]}'

# Search with RAG
curl -X POST /api/ai/rag \
  -d '{"query": "What patterns exist in sales data?", "topK": 5}'
```

---

## 🔄 Data Pipelines

Automate data ingestion from external sources:

```
┌────────────┐    ┌──────────────┐    ┌──────────────┐
│  Source     │───▶│  Pipeline    │───▶│  Your Table  │
│             │    │  (Transform) │    │              │
│ • REST API  │    │ • Map cols   │    │ • Auto-      │
│ • RSS Feed  │    │ • Filter     │    │   created    │
│ • WebSocket │    │ • Validate   │    │ • Versioned  │
│ • Web Page  │    │ • Schedule   │    │ • Realtime   │
└────────────┘    └──────────────┘    └──────────────┘
```

### Pipeline Features
- **Auto-scheduling** with cron expressions
- **Smart Preview** — dry-run before committing
- **Column mapping** — map source fields to target columns
- **Conflict resolution** — skip, upsert, or replace
- **Error tracking** — detailed error logs per source
- **Pipeline Wizard** — step-by-step creation

---

## 📊 Monitoring & Observability

SelfBase monitors itself with built-in dashboards:

```
┌──────────────────────────────────────────────┐
│  System Health                               │
│                                               │
│  CPU ████████░░░░░░  42%                     │
│  RAM ██████░░░░░░░░  28%                     │
│  Disk ████░░░░░░░░░  15%                     │
│  Connections: 12 active                       │
│  Requests/s: 342                              │
│  Uptime: 99.97%                               │
│                                               │
│  🟢 All systems operational                  │
└──────────────────────────────────────────────┘
```

### Alert System
Configure alerts that trigger on thresholds:
- **CPU** usage > 80%
- **Error rate** > 5%
- **Latency** > 500ms
- **Disk** usage > 90%

Alerts can notify via **webhooks** or **email**.

---

## 🚀 Quick Start

### Prerequisites
- [Bun](https://bun.sh/) runtime
- Node.js 18+

### Installation

```bash
# Clone the repository
git clone <repo-url> selfbase
cd selfbase

# Install dependencies
bun install

# Initialize the database
bun run db:push

# Start the development server
bun run dev
```

The app will be available at `http://localhost:3000`.

### First-Time Setup

1. Open `http://localhost:3000`
2. Create your admin account
3. Start building!

### Mini-Services

SelfBase uses microservices for background tasks:

```bash
# Start the realtime WebSocket service (port 3003)
cd mini-services/realtime-service && bun run dev

# Start the pipeline scheduler (port 3004)
cd mini-services/pipeline-scheduler && bun run dev
```

---

## 📂 Project Structure

```
selfbase/
├── prisma/
│   └── schema.prisma          # Database schema (20 models)
├── src/
│   ├── app/
│   │   ├── api/               # 80+ API route handlers
│   │   │   ├── v1/            # Public API (auth, data, sync)
│   │   │   ├── tables/        # Table & row CRUD
│   │   │   ├── functions/     # Serverless functions
│   │   │   ├── pipelines/     # Data pipelines
│   │   │   ├── scrapers/      # Web scrapers
│   │   │   ├── ai/            # AI endpoints
│   │   │   ├── storage/       # File storage
│   │   │   ├── monitoring/    # System health
│   │   │   ├── auth/          # User management
│   │   │   ├── realtime/      # Realtime proxy
│   │   │   └── ...
│   │   └── page.tsx           # Main app entry
│   ├── components/
│   │   ├── admin/             # 18 admin UI components
│   │   └── ui/                # shadcn/ui primitives
│   ├── hooks/
│   │   └── use-realtime.ts    # WebSocket hook
│   └── lib/
│       ├── db.ts              # Prisma client
│       ├── api-client.ts      # Frontend API helper
│       ├── api-utils.ts       # Backend API utilities
│       ├── app-auth.ts        # App token validation
│       ├── realtime-emit.ts   # Server-side event emitter
│       └── system-config.ts   # Configuration helpers
├── mini-services/
│   ├── realtime-service/      # Socket.IO server (port 3003)
│   └── pipeline-scheduler/    # Cron pipeline runner (port 3004)
├── db/
│   └── selfbase.db            # SQLite database file
└── public/                    # Static assets
```

---

## 🔌 API Quick Reference

### External App Authentication

```bash
# 1. Login with API key → get short-lived token
curl -X POST /api/v1/auth/login \
  -H "Authorization: Bearer sb_live_xxxxxxxx"

# Response: { "token": "...", "expiresAt": "...", "permissions": [...] }

# 2. Use token for all subsequent requests
curl /api/tables/my_table/rows \
  -H "Authorization: Bearer <token>"

# 3. Check if token is still valid
curl -X POST /api/v1/auth/validate \
  -H "Authorization: Bearer <token>"

# 4. Revoke token
curl -X POST /api/v1/auth/logout \
  -H "Authorization: Bearer <token>"
```

### Data Operations

```bash
# List tables
GET /api/tables

# Create table
POST /api/tables
{ "name": "products", "columns": [{"name": "title", "type": "TEXT"}] }

# Insert row
POST /api/tables/{id}/rows
{ "data": { "title": "Widget", "price": 9.99 } }

# Query rows
GET /api/tables/{id}/rows?page=1&pageSize=50&search=widget

# Update row
PUT /api/tables/{id}/rows/{rowId}
{ "data": { "price": 12.99 } }

# Delete row
DELETE /api/tables/{id}/rows/{rowId}
```

### Realtime Connection

```javascript
import { io } from 'socket.io-client'

const socket = io('/?XTransformPort=3003')

// Subscribe to a table
socket.emit('subscribe', { tableId: 'your-table-id' })

// Listen for changes
socket.on('data-changed', (data) => {
  console.log(data.eventType, data.row)  // insert/update/delete
})

// Listen for version changes
socket.on('update-available', (data) => {
  console.log('New version:', data.versionHash)
})
```

### Local-First Sync

```bash
# Fetch data with version tracking
GET /api/v1/data/products
Headers: If-None-Match: "abc123"

# 200 → New data available (with ETag)
# 304 → Not modified (no data transferred)

# Incremental sync
GET /api/v1/data/products?since=2025-01-01T00:00:00Z
```

---

## 🗺️ Roadmap

| Status | Feature | Description |
|--------|---------|-------------|
| ✅ | Dynamic Tables | Create/modify tables at runtime |
| ✅ | API Authentication | API Keys + App Tokens for external apps |
| ✅ | Realtime Database | WebSocket subscriptions per table |
| ✅ | Serverless Functions | JS/TS functions with HTTP/schedule/event triggers |
| ✅ | Data Pipelines | REST/RSS/WS/Scraper sources with auto-scheduling |
| ✅ | Web Scrapers | Paginated scraping with stealth mode |
| ✅ | AI Engine | Multi-provider LLM, embeddings, RAG |
| ✅ | File Storage | Buckets, presigned URLs, metadata |
| ✅ | Monitoring | Metrics, heartbeat, alert rules |
| ✅ | API Playground | 85+ documented endpoints with live testing |
| 🔜 | Auth on WebSocket | Token validation on Socket.IO connect |
| 🔜 | Reconnect Catchup | Missed-change sync after reconnection |
| 🔜 | Conflict Resolution | UI for concurrent edit conflicts |
| 🔜 | Rate Limiting | Per-API-key request throttling |
| 🔜 | Multi-Tenant | Team/organization isolation |
| 🔜 | GraphQL API | Alternative query interface |
| 🔜 | Edge Functions | Deno-based edge runtime |

---

## 📄 License

Private — All rights reserved.

---

<p align="center">
  Built with ❤️ using Next.js, Prisma, and Socket.IO
</p>
