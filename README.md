<div align="center">

# SelfBase

**Self-Hosted · Local-First · AI-Native Backend Platform**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.1.0--alpha-orange.svg)](https://github.com/Sifat-mahmud/selfbase/releases)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

A Firebase / Supabase alternative that runs on your own VPS — with AI built into the data layer, not bolted on as an afterthought.

[Quick Start](#quick-start) · [Features](#features) · [Architecture](#architecture) · [Documentation](#documentation) · [Contributing](#contributing)

</div>

---

## What is SelfBase?

SelfBase is a backend-as-a-service platform you install on your own server. It gives you everything Firebase and Supabase offer — realtime database, auth, file storage, serverless functions, auto-generated REST APIs — plus three things they don't:

- **Local-first sync** — apps always render from on-device cache instantly. The server is consulted only for version checks and explicit user-triggered refreshes. Zero network wait on open.
- **Priority-aware load shedding** — every table has a priority number. Under high traffic, priority-1 tables are always served. Lower-priority requests are queued server-side and pushed to clients when the server is free.
- **AI-native data layer** — vector store, auto-embedding on write, LLM gateway, and RAG pipeline are first-class primitives — not separate services you wire together.

One `curl` command installs everything on a fresh Ubuntu VPS.

---

## Quick Start

```bash
# Bare minimum — all defaults
curl -fsSL https://raw.githubusercontent.com/Sifat-mahmud/selfbase/main/install.sh | bash

# Custom credentials
curl -fsSL https://raw.githubusercontent.com/Sifat-mahmud/selfbase/main/install.sh | \
  ADMIN_EMAIL=you@email.com ADMIN_PASS=mypassword bash

# With domain name
curl -fsSL https://raw.githubusercontent.com/Sifat-mahmud/selfbase/main/install.sh | \
  DOMAIN=selfbase.yourdomain.com ADMIN_EMAIL=you@email.com bash
```

After install:

| Service | URL |
|---|---|
| Admin Studio | `http://your-server:4000` |
| API Gateway | `http://your-server:3000` |

Default credentials: `admin@selfbase.local` / `changeme123` — **change on first login**.

**Requirements:** Ubuntu 22.04 or 24.04, 2GB RAM minimum (4GB recommended), Docker installed automatically by the script.

---

## Features

### Core Backend

| Feature | Description |
|---|---|
| **Realtime Database** | JSON document store with live WebSocket subscriptions per collection, document, or field |
| **Authentication** | JWT, OAuth2 (Google, GitHub), magic links, API keys, MFA |
| **File Storage** | S3-compatible (MinIO / R2 / S3) with presigned URLs and CDN delivery |
| **Serverless Functions** | Edge functions triggered by HTTP, schedule, or database events |
| **Auto-generated REST API** | Full CRUD endpoints generated from table schema — no manual routes |
| **Row-Level Security** | Per-row access rules written in SQL, enforced at the database layer |
| **Admin Studio** | Web UI for schema editing, data browsing, pipeline config, and monitoring |

### Local-First Sync Engine

```
App opens → render local cache instantly (zero network wait)
           → background HEAD request checks server version hash
           → if new version: show "update available" indicator
           → user taps refresh → fetch new dataset → update cache
```

No automatic data replacement. The user always controls when their view updates.

### Priority-Aware Request Queue

```yaml
# selfbase.yml
tables:
  stock_prices:  { priority: 1 }   # always served under load
  portfolio:     { priority: 1 }   # always served under load
  market_news:   { priority: 3 }   # deferred under load
  ai_summaries:  { priority: 4 }   # deferred under load
```

Under high load, P1 tables respond immediately. P3+ requests are queued and delivered via WebSocket/SSE when the server drops below the idle threshold.

### Visual Data Pipeline Studio

Map external web sources to SelfBase tables — no code required.

- **Source types:** REST JSON API, RSS/Atom feed, HTML scraper (CSS selectors), WebSocket stream
- **Column mapping:** drag-and-drop field → column with type casting (TEXT, DECIMAL, TIMESTAMP, etc.)
- **Fetch schedule:** every N seconds/minutes, cron expression, active window (e.g. market hours only)
- **Conflict strategy:** upsert, insert-only, or full replace
- **Live preview:** test fetch before activating

### AI-Native Layer

```js
// Semantic search — no separate vector service needed
const results = await selfbase.collection('articles').semanticSearch('climate policy', 10);

// RAG pipeline — built in
const answer = await selfbase.rag({
  table: 'docs',
  query: 'how do I configure rate limits?',
  model: 'claude-sonnet-4-6',
});

// LLM gateway — routes to your configured providers
const response = await selfbase.llm({ model: 'gpt-4o', messages: [...] });
```

| Feature | Description |
|---|---|
| **Vector store** | pgvector on Postgres — HNSW index, cosine/L2/inner product |
| **Auto-embedding** | Text columns auto-embedded on write — configure once, works forever |
| **LLM gateway** | Routes to OpenAI, Anthropic, or local Ollama with response caching |
| **RAG pipeline** | `selfbase.rag()` — retrieve relevant rows, inject as context, return completion |
| **AI guardrails** | Per-table output rules: allowlist, blocklist, regex, or LLM-judge |

### Server Monitoring

- **Heartbeat log** — server writes a row every N seconds (admin-configured). A gap in the log *is* the downtime — no status column needed.
- **Uptime graph** — visual bar showing up / degraded / down per interval. Zoomable: 6h, 24h, 7d, 30d.
- **VPS load breakdown** — CPU split into scraper engine, API server, and function runner per heartbeat.
- **Per-table API metrics** — call count and latency per table per minute, shown as a stacked bar chart.
- **Alert webhooks** — POST to any URL when CPU/load crosses a configured threshold.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│            Client (Web · Mobile · CLI)           │
│           SelfBase SDK (JS / Kotlin / Swift)     │
└─────────────────┬───────────────────────────────┘
                  │ REST / WebSocket / SSE
┌─────────────────▼───────────────────────────────┐
│                 API Gateway                      │
│         JWT auth · rate limit · priority         │
└──┬──────────┬──────────┬──────────┬─────────────┘
   │          │          │          │
┌──▼──┐  ┌───▼──┐  ┌────▼──┐  ┌───▼──────┐
│ API │  │Auth  │  │Storage│  │Functions │
│CRUD │  │ JWT  │  │ MinIO │  │  Deno    │
└──┬──┘  └──────┘  └───────┘  └──────────┘
   │
┌──▼──────────────────────────────────────────────┐
│                  AI Layer                        │
│   Vector store · LLM gateway · Embeddings · RAG  │
└──┬──────────────────────────────────────────────┘
   │
┌──▼──────────────────────────────────────────────┐
│                 Data Layer                       │
│    Postgres 16 · Redis 7 · MinIO · BullMQ        │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│            Ingestion (Pipeline Studio)           │
│  Scheduler → Fetch → Transform → Validate → DB  │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│                   Monitor                        │
│       Heartbeat · Metrics · Alerts · Studio      │
└─────────────────────────────────────────────────┘
```

### Services

| Service | Stack | Role |
|---|---|---|
| `gateway` | Node.js + Fastify | Auth, routing, priority queue, load shedding |
| `api` | Node.js + Fastify | Auto-generated CRUD, RLS enforcement |
| `realtime` | Node.js + ws | WebSocket subscriptions, version push |
| `auth` | Node.js | JWT, OAuth2, magic links |
| `storage` | Node.js + MinIO SDK | File upload/download, presigned URLs |
| `functions` | Deno | Edge function runner, DB triggers |
| `ingestion` | Node.js + BullMQ | Scheduler, fetcher, transform, upsert |
| `ai` | Node.js | LLM gateway, embeddings, RAG |
| `monitor` | Node.js | Heartbeat writer, metrics aggregator, alerts |
| `studio` | Next.js | Admin dashboard |

### Data stores

| Store | Use |
|---|---|
| Postgres 16 + pgvector | Primary database, vector store, heartbeat log |
| Redis 7 | Session cache, pub/sub, BullMQ broker |
| MinIO | Object/file storage (S3-compatible) |

---

## Repository Structure

```
selfbase/
├── install.sh                  # ← one-command VPS setup
├── docker-compose.yml          # production stack
├── docker-compose.dev.yml      # local dev with hot-reload
├── selfbase.yml.example        # all config with defaults
├── .env.example
│
├── services/
│   ├── gateway/                # API gateway + priority queue
│   ├── api/                    # REST CRUD + RLS
│   ├── realtime/               # WebSocket + version events
│   ├── auth/                   # JWT + OAuth
│   ├── storage/                # File service
│   ├── functions/              # Edge function runner
│   ├── ingestion/              # Pipeline Studio backend
│   ├── ai/                     # LLM gateway + embeddings
│   └── monitor/                # Heartbeat + metrics
│
├── studio/                     # Next.js admin UI
├── sdk/
│   ├── js/                     # TypeScript SDK (@selfbase/js)
│   ├── android/                # Kotlin SDK
│   └── ios/                    # Swift SDK
│
├── db/
│   ├── migrations/             # SQL migrations (run in order)
│   └── seed.sql                # Default admin + sample config
│
└── infra/
    ├── helm/                   # Kubernetes Helm chart
    ├── systemd/                # Bare-metal service units
    └── nginx/selfbase.conf     # Reverse proxy config
```

---

## SDK Usage

### JavaScript / TypeScript

```bash
npm install @selfbase/js
```

```ts
import { SelfBase } from '@selfbase/js';

const sb = new SelfBase({ url: 'http://your-server:3000', key: 'your-anon-key' });

// Instant local render — no network wait
const stocks = await sb.collection('stock_prices').get();

// Subscribe to live changes
sb.collection('stock_prices').subscribe((data) => {
  console.log('updated:', data);
});

// Explicit refresh when user requests
refreshBtn.onclick = () => sb.collection('stock_prices').refresh();

// Listen for update signals
sb.on('update-available', ({ table }) => showBanner(`${table} has new data`));
sb.on('deferred-ready',   ({ table }) => sb.collection(table).refresh());

// Semantic search
const results = await sb.collection('articles').semanticSearch('interest rates', 5);

// RAG
const answer = await sb.rag({ table: 'docs', query: 'setup guide', model: 'claude-sonnet-4-6' });
```

---

## Configuration

Copy `selfbase.yml.example` to `selfbase.yml` and edit:

```yaml
# selfbase.yml
server:
  domain: localhost
  port: 3000

load_shedding:
  shedding_threshold: 0.75   # activate queue above 75% load
  idle_threshold: 0.40       # drain queue below 40% load
  queue_ttl_seconds: 300     # drop queued requests after 5 min

heartbeat:
  interval_seconds: 60
  degraded_cpu_threshold: 80
  alert_webhook: ""          # POST here on downtime

tables:
  # priority: 1=critical, 2=high, 3=normal, 4=low
  users:        { priority: 1 }
  sessions:     { priority: 1 }
  notifications:{ priority: 3 }
```

---

## Deployment

### Docker Compose (recommended)

```bash
git clone https://github.com/Sifat-mahmud/selfbase
cd selfbase
cp selfbase.yml.example selfbase.yml
cp .env.example .env   # edit with your secrets
docker compose up -d
```

### Kubernetes

```bash
helm install selfbase ./infra/helm -f my-values.yaml
```

### Bare metal (systemd)

```bash
cp infra/systemd/*.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now selfbase-gateway selfbase-api selfbase-realtime
```

---

## Comparison

| Feature | SelfBase | Supabase | Appwrite | Firebase | PocketBase |
|---|:---:|:---:|:---:|:---:|:---:|
| Self-hosted | ✅ | ✅ | ✅ | ❌ | ✅ |
| Local-first SDK | ✅ | ❌ | ❌ | ❌ | ❌ |
| Priority queue | ✅ | ❌ | ❌ | ❌ | ❌ |
| Visual source mapper | ✅ | ❌ | ❌ | ❌ | ❌ |
| Auto-embed on write | ✅ | ❌ | ❌ | ❌ | ❌ |
| LLM gateway built-in | ✅ | ❌ | ❌ | ❌ | ❌ |
| Heartbeat monitoring | ✅ | ❌ | ❌ | ❌ | ❌ |
| Vector store | ✅ | ✅ | ❌ | ❌ | ❌ |
| Realtime DB | ✅ | ✅ | ✅ | ✅ | ✅ |
| Auth | ✅ | ✅ | ✅ | ✅ | ✅ |
| Storage | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Roadmap

- [x] Architecture design & documentation
- [x] Install script (`install.sh`)
- [x] Docker Compose stack definition
- [ ] Database migrations (`db/migrations/`)
- [ ] API Gateway — priority queue + load shedding
- [ ] Realtime service — WebSocket + version events
- [ ] Auth service
- [ ] Storage service
- [ ] Ingestion engine + Pipeline Studio backend
- [ ] AI layer — LLM gateway + auto-embedding
- [ ] Monitor service — heartbeat + metrics
- [ ] Admin Studio UI (Next.js)
- [ ] JavaScript SDK (`@selfbase/js`)
- [ ] Kotlin SDK
- [ ] v1.0.0 stable release

---

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a PR.

- **Bug reports:** open an issue with the `bug` label
- **Feature requests:** open an issue with the `enhancement` label
- **Code:** fork → branch → PR against `main`

---

## License

MIT — see [LICENSE](LICENSE).

---

<div align="center">
Built with intention. Owned by you.
</div>
