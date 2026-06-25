<p align="center">
  <img src="public/hero-banner.png" alt="SelfBase" width="100%" />
</p>

<h1 align="center">SelfBase — AI-Native Backend-as-a-Service</h1>

<p align="center">
  <strong>Self-hosted · Local-First · Realtime · AI-Powered</strong>
</p>

<p align="center">
  <a href="https://selfbase.space-z.ai/">
    <img src="https://img.shields.io/badge/Live-Demo-emerald?style=for-the-badge&logo=globe&logoColor=white" alt="Live Demo" />
  </a>
  <img src="https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Prisma-SQLite-teal?style=for-the-badge&logo=prisma&logoColor=white" alt="Prisma" />
</p>

---

## 🚀 Live Demo

**👉 [https://selfbase.space-z.ai/](https://selfbase.space-z.ai/)**

Login with `admin@selfbase.dev` / `admin123` (demo instance)

---

## 📋 What is SelfBase?

SelfBase is a **self-hosted, local-first Backend-as-a-Service** platform that gives you everything you need to build and run modern applications — databases, APIs, web scrapers, data pipelines, serverless functions, and AI integration — all from a single dashboard.

No cloud lock-in. No vendor dependency. Your data stays on your machine.

<p align="center">
  <img src="public/architecture.png" alt="Architecture" width="80%" />
</p>

---

## ✨ Key Features

### 🗄️ Dynamic Tables
Create database tables with typed columns directly from the UI. Toggle realtime to push changes to all connected clients instantly via WebSocket.

| Feature | Details |
|---------|---------|
| Column Types | TEXT, INTEGER, DECIMAL, BOOLEAN, TIMESTAMP, JSON |
| Realtime Sync | WebSocket push with version tracking |
| Row-Level Security | Configurable per-table |
| Vector Embeddings | Auto-embed text columns for AI/RAG |
| REST API | Auto-generated CRUD endpoints |

### 🌐 Multi-Level Web Scraper
Scrape any website with a visual step-by-step script builder powered by **Playwright** headless browser.

| Step Type | What It Does |
|-----------|-------------|
| `navigate` | Go to a URL |
| `click` | Click a button/link |
| `type` | Type into input fields |
| `wait` | Wait for element/content |
| `scroll` | Scroll the page |
| `extract` | Extract data (table or single points) |
| `paginate` | Auto-click next page |

- **Column Mapping** — Map scraped fields directly to table columns
- **Conflict Resolution** — `insert`, `upsert`, or `update` modes
- **Run History** — View past scrape results and durations

### 🔗 Pipeline Studio
Ingest data from REST APIs, RSS feeds, or web scrapers on a schedule.

- **Source Types**: REST API, RSS Feed, Web Scraper
- **Scheduling**: Cron expressions or fixed intervals
- **Column Mapping**: Map source fields → table columns
- **Conflict Modes**: update, insert, upsert, skip, truncate
- **Smart Preview**: See data before committing
- **Auto Table Creation**: Create target table from pipeline schema

### ⚡ Serverless Functions
Write JavaScript functions that run in a sandboxed environment.

```javascript
function handler(input, env) {
  // input: request body (JSON)
  // env: environment variables
  return { message: "Hello " + input.name };
}
```

- **Trigger Types**: HTTP, Schedule (cron), Event (on data change)
- **Invoke via API**: `POST /api/v1/functions/{name}/invoke`
- **Environment Variables**: Securely store secrets
- **Run History**: Track every execution with duration and output

### 🤖 AI Bridge
SelfBase doesn't generate scripts — it's a **backend service**. Share config formats with any AI (Gemini, ChatGPT, Claude), and import their generated JSON configs back.

1. **Copy** the config format documentation
2. **Paste** into your AI chat
3. AI **generates** JSON configs for tables, scrapers, pipelines, functions
4. **Import** the JSON into SelfBase — auto-detects type and creates the resource

### 🔐 Authentication & API Keys
- **Admin Login** with session tokens
- **API Keys** (`sb_live_*`) for external apps
- **App Tokens** — short-lived tokens for mobile/web apps
- **Password Reset** flow with force-change support

### 📊 Realtime Monitoring
- System health dashboard (CPU, RAM, disk, connections)
- CPU & RAM trend charts
- Load score history
- Service status overview
- Alert configuration

### 📁 File Storage
Upload and manage files with bucket organization.

### 🔄 Data Transfer
Import/export data in JSON format for tables, pipelines, scrapers, and functions.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js 16 App Router                 │
│              (Turbopack · TypeScript · Tailwind)         │
├──────────┬──────────┬──────────┬──────────┬─────────────┤
│ Dashboard │  Tables  │ Scraper  │ Pipeline │  Functions   │
│  Monitor  │ Realtime │ Playwright│  REST   │  Serverless  │
├──────────┴──────────┴──────────┴──────────┴─────────────┤
│                    Prisma ORM + SQLite                   │
├─────────────────────────────────────────────────────────┤
│                   Microservices Layer                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │  Realtime    │  │  Pipeline   │  │   Scraper   │     │
│  │  Socket.IO   │  │  Scheduler  │  │  Playwright │     │
│  │  Port 3003   │  │  Port 3004  │  │  Port 3005  │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
├─────────────────────────────────────────────────────────┤
│              API Gateway (Caddy)                         │
│         Port 3000 → Routes to microservices             │
└─────────────────────────────────────────────────────────┘
```

---

## 🖼️ Screenshots

### Dashboard — System Overview
![Dashboard](https://via.placeholder.com/800x450/1a1a2e/16c79a?text=Dashboard+with+Charts+%26+Stats)

### Tables — Data Management
![Tables](https://via.placeholder.com/800x450/1a1a2e/16c79a?text=Dynamic+Tables+with+Realtime)

### Web Scraper — Step Builder
![Scraper](https://via.placeholder.com/800x450/1a1a2e/16c79a?text=Multi-Level+Scraper+Builder)

### Pipeline Studio
![Pipeline](https://via.placeholder.com/800x450/1a1a2e/16c79a?text=Pipeline+Configuration)

### Serverless Functions
![Functions](https://via.placeholder.com/800x450/1a1a2e/16c79a?text=Function+Editor+%26+Runner)

### AI Bridge
![AI Bridge](https://via.placeholder.com/800x450/1a1a2e/16c79a?text=AI+Bridge+Config+Formats)

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ or **Bun**
- **npm** or **bun** package manager

### 1. Clone & Install

```bash
git clone https://github.com/Sifat-mahmud/selfbase.git
cd selfbase
bun install
```

### 2. Setup Database

```bash
bun run db:push
```

### 3. Start Development Server

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) — Default login: `admin@selfbase.dev` / `admin123`

### 4. Start Microservices

```bash
# Realtime service (Socket.IO) — Port 3003
cd mini-services/realtime-service && bun install && bun --hot index.ts

# Pipeline scheduler — Port 3004
cd mini-services/pipeline-scheduler && bun install && bun --hot index.ts

# Web scraper (Playwright) — Port 3005
cd mini-services/scraper-service && bun install && bun --hot index.ts
```

---

## 📡 API Reference

### External App API (v1)

All v1 endpoints require an **App Token** (obtain via API key login).

#### Auth
```
POST /api/v1/auth/login      # Login with API key → get app token
POST /api/v1/auth/validate    # Check if token is valid
POST /api/v1/auth/logout      # Revoke app token
```

#### Data
```
GET    /api/v1/data/{table}          # Query table rows
POST   /api/v1/data/{table}          # Insert row
GET    /api/v1/version/{table}       # Get table version hash
```

#### Functions
```
POST /api/v1/functions/{name}/invoke  # Execute function by name
```

### Admin API

Admin endpoints require a **session token** (from dashboard login).

```
# Tables
GET/POST    /api/tables
GET/PUT/DELETE /api/tables/{id}
GET/POST    /api/tables/{id}/rows
GET/PUT/DELETE /api/tables/{id}/rows/{rowId}
POST        /api/tables/{id}/columns

# Pipelines
GET/POST    /api/pipelines
GET/PUT/DELETE /api/pipelines/{id}
POST        /api/pipelines/{id}/run
POST        /api/pipelines/{id}/preview
POST        /api/pipelines/smart-preview
POST        /api/pipelines/auto-create-table

# Scrapers
GET/POST    /api/scrapers
GET/PUT/DELETE /api/scrapers/{id}
POST        /api/scrapers/{id}/run
POST        /api/scrapers/{id}/preview
POST        /api/scrapers/generate-script

# Functions
GET/POST    /api/functions
GET/PUT/DELETE /api/functions/{id}
POST        /api/functions/{id}/run
GET         /api/functions/runs

# Import (AI Bridge)
POST        /api/import              # Auto-detect type & create resource

# AI
GET/POST    /api/ai/llm-config
POST        /api/ai/chat
POST        /api/ai/embed
POST        /api/ai/rag
POST        /api/ai/search

# Monitoring
GET         /api/monitoring/heartbeat
GET         /api/monitoring/uptime
GET         /api/monitoring/metrics
GET         /api/monitoring/load
GET/POST    /api/monitoring/alerts

# Storage
GET/POST    /api/storage
DELETE      /api/storage/{id}
```

---

## 🤖 AI Bridge — How It Works

SelfBase is a **backend service**, not a script generator. The AI Bridge lets you use any external AI to generate configs:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Copy the   │────▶│  Paste in   │────▶│  AI creates │────▶│  Import to  │
│  Config Docs │     │  AI Chat    │     │  JSON files │     │  SelfBase   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

### Supported Config Types

<details>
<summary>📊 Table Schema</summary>

```json
{
  "name": "my_table",
  "displayName": "My Table",
  "columns": [
    { "name": "id", "type": "TEXT", "isPrimaryKey": true, "nullable": false },
    { "name": "title", "type": "TEXT", "nullable": false },
    { "name": "price", "type": "DECIMAL", "nullable": true },
    { "name": "created_at", "type": "TIMESTAMP", "defaultValue": "CURRENT_TIMESTAMP" }
  ],
  "enableRealtime": false
}
```
</details>

<details>
<summary>🌐 Web Scraper</summary>

```json
{
  "name": "My Scraper",
  "startUrl": "https://example.com",
  "scraperScript": {
    "steps": [
      { "type": "navigate", "url": "https://example.com" },
      { "type": "click", "selector": "button.menu" },
      { "type": "extract", "name": "data", "repeat": ".item", "fields": [
        { "name": "title", "selector": ".title", "type": "text" }
      ]}
    ]
  },
  "columnMapping": { "title": "title_column" },
  "conflictMode": "upsert",
  "conflictKey": "title"
}
```
</details>

<details>
<summary>🔗 Pipeline Config</summary>

```json
{
  "name": "My Pipeline",
  "sourceType": "rest",
  "url": "https://api.example.com/data",
  "fetchInterval": 300,
  "onConflict": "upsert",
  "primaryKeyCols": ["id"],
  "columnMappings": [
    { "src": "api_field", "target": "table_column", "type": "TEXT" }
  ]
}
```
</details>

<details>
<summary>⚡ Function Script</summary>

```json
{
  "name": "my_function",
  "code": "function handler(input, env) { return { ok: true }; }",
  "triggerType": "http",
  "timeoutMs": 30000
}
```
</details>

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 (App Router, Turbopack) |
| **Language** | TypeScript 5 |
| **Styling** | Tailwind CSS 4 + shadcn/ui |
| **Database** | Prisma ORM + SQLite |
| **State** | Zustand + TanStack Query |
| **Animations** | Framer Motion |
| **Realtime** | Socket.IO |
| **Scraping** | Playwright (headless Chromium) |
| **Scheduling** | Custom cron-based scheduler |
| **AI** | z-ai-web-dev-sdk (LLM, VLM, Embeddings) |
| **Auth** | Session tokens + API keys + App tokens |

---

## 📁 Project Structure

```
selfbase/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Main admin dashboard
│   │   ├── layout.tsx            # Root layout
│   │   ├── proxy.ts              # Next.js 16 proxy (auth middleware)
│   │   └── api/
│   │       ├── tables/           # Table CRUD + rows
│   │       ├── pipelines/        # Pipeline CRUD + runs
│   │       ├── scrapers/         # Scraper CRUD + runs
│   │       ├── functions/        # Function CRUD + execution
│   │       ├── ai/               # LLM, embeddings, RAG
│   │       ├── import/           # AI Bridge import
│   │       ├── auth/             # Login, sessions, users
│   │       ├── v1/               # External API (apps)
│   │       ├── monitoring/       # Heartbeat, alerts
│   │       └── storage/          # File management
│   ├── components/
│   │   ├── admin/               # Dashboard views
│   │   ├── auth/                 # Login pages
│   │   ├── ui/                   # shadcn/ui components (48+)
│   │   └── theme-*.tsx          # Dark/light mode
│   ├── hooks/                    # useRealtime, useToast, useMobile
│   ├── lib/                      # DB, auth, API clients
│   └── stores/                   # Zustand state
├── mini-services/
│   ├── realtime-service/         # Socket.IO (port 3003)
│   ├── pipeline-scheduler/      # Cron scheduler (port 3004)
│   └── scraper-service/         # Playwright (port 3005)
├── prisma/
│   └── schema.prisma            # 20+ models
└── public/                       # Static assets
```

---

## 🔌 Microservices

| Service | Port | Purpose |
|---------|------|---------|
| **Realtime** | 3003 | Socket.IO WebSocket server for live data push |
| **Pipeline Scheduler** | 3004 | Cron-based pipeline execution |
| **Scraper** | 3005 | Playwright headless browser scraping |

All microservices are standalone Bun projects with hot-reload.

---

## 🧩 Database Schema

SelfBase uses **20+ Prisma models** covering:

- **Auth**: User, Session, ApiKey, AppToken, OAuthProvider
- **Data**: SbTable, SbColumn, SbRow, SbSubscription
- **Pipeline**: PipelineSource, PipelineRun, SourceError
- **Scraper**: ScraperSitemap, ScrapeRun
- **Functions**: SbFunction, FunctionRun
- **Monitoring**: Heartbeat, TableCall, AlertConfig, AlertEvent
- **AI**: Embedding, LlmConfig, LlmCall, RagSession
- **Storage**: StorageFile
- **System**: SystemConfig, DeferredRequest

---

## 🧪 Example: Full Stack in 5 Minutes

### 1. Create a Table
Go to **Tables** → Click **New Table** → Define columns like `name`, `price`, `stock`

### 2. Setup a Scraper
Go to **Web Scraper** → Create a multi-step script:
- Navigate to the product page
- Click on the category menu
- Extract product data
- Map fields to table columns

### 3. Create a Pipeline
Go to **Pipeline Studio** → Connect an API or scraper → Set schedule → Map columns

### 4. Write a Function
Go to **Functions** → Create a function:
```javascript
function handler(input, env) {
  // Check if price dropped below threshold
  if (input.price < input.threshold) {
    return { alert: true, message: `Price dropped to ${input.price}` };
  }
  return { alert: false };
}
```

### 5. Connect from Your App
```bash
# Get an app token
curl -X POST /api/v1/auth/login \
  -H "Authorization: Bearer sb_live_YOUR_API_KEY"

# Query data
curl /api/v1/data/products \
  -H "Authorization: Bearer YOUR_APP_TOKEN"

# Invoke a function
curl -X POST /api/v1/functions/check_price/invoke \
  -H "Authorization: Bearer YOUR_APP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"price": 29.99, "threshold": 30}'
```

---

## 📝 Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start Next.js dev server (port 3000) |
| `bun run build` | Production build |
| `bun run lint` | ESLint check |
| `bun run db:push` | Push Prisma schema to SQLite |
| `bun run db:generate` | Generate Prisma client |

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

<p align="center">
  Built with ❤️ using Next.js, Prisma, Playwright & Socket.IO<br/>
  <strong><a href="https://selfbase.space-z.ai/">Try SelfBase Live →</a></strong>
</p>
