# SelfBase Worklog

## Session R25 - API Authentication System for External Apps

---
Task ID: 1
Agent: Main
Task: Implement full API authentication system for external apps (iOS/Android) + redesign API Playground

Work Log:
- Updated Prisma schema: Added `AppToken` model for short-lived tokens, updated `ApiKey` model with `name` (app name), `keyPlain` fields, and `appTokens` relation
- Ran `bun run db:push` to sync DB schema
- Created `/api/api-keys` route: GET (list keys), POST (create new key with `sb_live_` prefix)
- Created `/api/api-keys/[id]` route: DELETE (revoke key + cleanup app tokens)
- Created `/api/v1/auth/login` - External app auth: accepts API key as Bearer token, returns short-lived app token with configurable expiry (default 1 hour)
- Created `/api/v1/auth/validate` - Check if app token is still valid
- Created `/api/v1/auth/logout` - Revoke an app token
- Created `/lib/app-auth.ts` - `validateAppToken()` and `checkAuth()` utilities for route handlers
- Created `/lib/system-config.ts` - Helper for getting/ensuring system config defaults
- Updated middleware.ts to detect auth method (api-key vs bearer-token vs none)
- Added `security.apiTokenExpiryMinutes` config to Settings security form (default 60 min)
- Completely redesigned `/components/admin/playground.tsx` with:
  - Two-tab layout: "Authentication" and "API Tester"
  - Auth Flow Visualization: 3-step visual diagram (Generate Key → Login → Use Token)
  - API Key Management: Create with name + permissions, list, revoke
  - Quick Auth Test: Login with API key, validate token, copy code snippets
  - Code snippets for Swift (iOS) and Kotlin (Android)
  - Token status banner showing auth state
  - Auto-inject auth token into API request headers
  - Updated endpoint templates with /api/v1/* routes and auth requirement indicators

Stage Summary:
- Full API auth system implemented and verified via API testing:
  - ✅ POST /api/v1/auth/login → Returns app token from API key
  - ✅ POST /api/v1/auth/validate → Returns valid/invalid with permissions
  - ✅ POST /api/v1/auth/logout → Revokes token
  - ✅ Wrong API key → Returns proper error
  - ✅ API Key CRUD (create, list, revoke)
  - ✅ Token expiry configurable from Settings (default 1 hour)
- API Playground completely redesigned with auth flow visualization
- External apps can now use SelfBase as their backend service

### Architecture:
```
External App → API Key (sb_live_xxx) → /api/v1/auth/login → App Token (valid 1hr)
External App → App Token → /api/tables, /api/functions, etc. → Data
Admin → Session Token → All admin APIs
```

### Priority Recommendations for Next Phase:
1. Add API key permissions enforcement (read/write/admin) on individual routes
2. Add rate limiting per API key
3. Add API usage analytics per key
4. Test playground UI via agent-browser (limited by server stability)
5. Add refresh token support for seamless re-auth

---

## Session R26 - Token Persistence & Comprehensive API Endpoints

---
Task ID: 1
Agent: Main
Task: Persist auth token to localStorage + expand API playground with comprehensive endpoint coverage

Work Log:
- Added localStorage persistence for auth token, token info, and API key in `playground.tsx`
- Created `readFromLocalStorage` and `writeToLocalStorage` helper functions with SSR safety
- Defined storage keys: `selfbase_playground_token`, `selfbase_playground_token_info`, `selfbase_playground_api_key`
- Updated `AuthFlowSection` to accept `initialToken` and `initialTokenInfo` props for hydration from localStorage
- On login: token, token info, and API key are written to localStorage
- On validate (invalid) / logout: localStorage entries are cleared
- Updated `PlaygroundView` to hydrate from localStorage on mount via `useEffect`
- Auto-switches to API Tester tab when token is already present from localStorage
- Added `clearAuthToken` callback that clears both state and localStorage
- Expanded ENDPOINT_TEMPLATES from 15 to 80 endpoints across 17 categories:
  - 🔐 Auth API (3) — login, validate, logout
  - 🔄 Sync API / Local-First (2) — data fetch with ETag, version check
  - 📊 Data — Tables (7) — list, get, create, update, delete, columns, version
  - 📋 Data — Rows (5) — list, create, get, update, delete
  - ⚡ Functions (7) — list, get, run, runs, create, update, delete
  - 🔄 Pipelines (9) — list, get, run, preview, runs, smart-preview, auto-create, create, delete
  - 🤖 AI (6) — chat, embed, rag, search, llm-config, calls
  - 💾 Storage (4) — list, get, upload-url, delete
  - 🌐 Scrapers (7) — list, get, run, preview, runs, create, delete
  - 📈 Monitoring (6) — load, metrics, uptime, alerts, alert-events, heartbeat
  - 📨 Queue (3) — list, get, drain
  - 📝 Logs (3) — list, source-errors, function-errors
  - 📦 Import/Export (8) — import tables/functions/pipelines/scrapers, export tables/functions/pipelines/scrapers
  - ⚙️ Config (2) — get all, get by key
  - 🔑 API Keys (3) — list, create, revoke
  - 👤 Auth/Users (5) — users, user detail, sessions, change password, admin api-keys
- Improved endpoint sidebar: added category count badges, path display per endpoint, ring highlight on selected
- Enhanced header: shows "80 endpoints" badge, token expiry info when authenticated
- Enhanced auth banner: shows app name and token expiry time
- Widened endpoint sidebar from 280px to 300px for better readability
- Verified with agent-browser — all 80 endpoints visible, tabs working, auth flow correct

Stage Summary:
- ✅ Token persistence to localStorage works — survives navigation and page refresh
- ✅ Auto-switches to API Tester tab when returning with stored token
- ✅ 80 comprehensive API endpoints across 17 categories for external app developers
- ✅ UI improvements: count badges, path display, expiry info in banner
- ✅ Verified via agent-browser with zero errors
- ✅ Cron job created for periodic review (job ID: 227170)

### Current State:
- The API Playground is now a fully functional API testing and documentation tool
- Token persists across sessions, auto-hydrates on page load
- External app developers have full reference for all SelfBase APIs
- Lint clean, dev server running without errors

### Priority Recommendations for Next Phase:
1. Add API key permissions enforcement (read/write/admin) on individual routes
2. Add rate limiting per API key
3. Add API usage analytics per key with per-key request counts and charts
4. Add request history persistence (save last N requests to localStorage)
5. Add "Quick Start" guide for mobile developers in the auth tab
6. Add environment variable support in playground (base URL toggle for staging vs production)
7. Improve response viewer with syntax highlighting and JSON tree view

---

## Session R27 - Dialog & Table View Responsive Fix

---
Task ID: 1
Agent: Main
Task: Review all popup windows, fix table column widths and alignments, make visual easy to understand

Work Log:
- **ROOT CAUSE IDENTIFIED**: `sm:max-w-lg` in `DialogContent` base class (`src/components/ui/dialog.tsx`) overrode all non-responsive `max-w-*` classes on consuming components — every dialog was capped at 512px regardless of intended width
- Added `overflow-hidden` to DialogContent base class to prevent content overflow
- Changed all 12 `DialogContent` instances across 5 files from `max-w-*` to `sm:max-w-*` so they properly override the base class
- Fixed Pipeline Wizard crash: `dp.sampleColumns` was undefined (API returns `sampleKeys`), added null coalescing + fallback
- Fixed Pipeline Wizard `rowCount` fallback: API returns `count` instead of `rowCount` in some cases
- Fixed Pipeline Preview dialog: added `max-h-[90vh] flex flex-col`, improved table cells with `whitespace-nowrap max-w-[200px] truncate`
- **View Data dialog (tables.tsx)** — Major improvements:
  - Upgraded from `sm:max-w-5xl` to `sm:max-w-6xl` for wider display
  - Added `max-h-[90vh] flex flex-col` for proper dialog sizing
  - Removed type annotations `(INTEGER)`, `(TEXT)`, etc. from column headers — moved to `title` attribute (hover to see)
  - Added `whitespace-nowrap max-w-[180px] truncate` to data cells with title tooltip
  - Boolean values now render as colored badges: `✓ true` (emerald) / `✗ false` (secondary)
  - Version column simplified: plain text `v1` instead of Badge component, width `w-16`
  - Actions column compacted: `w-20` instead of `w-32`
  - Table scroll container changed from `max-h-[60vh]` to `flex-1` for better viewport usage
- **Create Table dialog (tables.tsx)** — Enhanced:
  - Widened from `sm:max-w-2xl` to `sm:max-w-3xl`
  - Added 2 new columns: `Nullable` (checkbox) and `Unique` (checkbox) for better schema control
  - Added placeholder text "column_name" in name input
- **Scraper Preview dialog** — Widened to `sm:max-w-4xl`, added `whitespace-nowrap max-w-[200px] truncate`, null dashes styled
- **Pipeline Wizard preview table** — Extended visible columns from 6 to 8, added type annotations, sticky header, null-safe preview rows
- All fixes verified via agent-browser — dialogs now render at intended widths, tables fit properly

Stage Summary:
- ✅ **CRITICAL FIX**: Dialog width override bug resolved — all dialogs now render at their intended widths
- ✅ **CRITICAL FIX**: Pipeline Wizard crash from undefined `sampleColumns` resolved
- ✅ View Data dialog: 1152px wide (was 512px), clean headers, compact columns, proper scroll
- ✅ Create Table dialog: 768px wide (was 512px), 4-column schema table with checkboxes
- ✅ Pipeline Preview: 1024px wide, no overflow, type info on hover
- ✅ Scraper Preview: wider dialog, proper cell constraints
- ✅ Lint clean, dev server running without errors
- ✅ Agent-browser verified all fixes working correctly

### Key Architecture Change:
```
BEFORE: DialogContent base class has sm:max-w-lg → overrides max-w-5xl on consumer (512px cap)
AFTER:  Consumer uses sm:max-w-5xl → properly overrides sm:max-w-lg (1024px+ width)
```

### Priority Recommendations for Next Phase:
1. Add column resize capability to View Data table
2. Add JSON tree view for complex cell values (nested objects)
3. Add "Copy row as JSON" action in data table
4. Improve inline editing UX with tab-to-next-cell
5. Add column visibility toggle (hide/show columns)
6. Add row detail expansion (click to expand full row data)
7. Add keyboard navigation in data table (arrow keys between cells)

---

## Session R28 - Realtime Database Feature

---
Task ID: 1
Agent: Main
Task: Implement realtime database toggle with version tracking, WebSocket push, and API/playground updates

Work Log:
- Created `/src/lib/realtime-emit.ts` — server-side utility to emit events to Socket.IO service
  - `emitRealtimeEvent(tableId, eventType, data)` — checks table's `enableRealtime` before emitting
  - Fire-and-forget HTTP POST to `localhost:3003/emit` — no blocking on API routes
  - Emits both `data-changed` and `update-available` events per mutation
- Updated POST `/api/tables/[id]/rows` (Create row):
  - Now updates `rowCount` and `versionHash` on the table (was missing before)
  - Calls `emitRealtimeEvent(id, 'insert', ...)` after successful creation
- Updated PUT `/api/tables/[id]/rows/[rowId]` (Update row):
  - Added `emitRealtimeEvent(id, 'update', ...)` after successful update
- Updated DELETE `/api/tables/[id]/rows/[rowId]` (Delete row):
  - Added `emitRealtimeEvent(id, 'delete', ...)` after successful deletion
- Fixed PUT `/api/tables/[id]` — added `include: { columns }` to Prisma update (was causing crash)
- Wired realtime toggle switch in Tables UI (`tables.tsx`):
  - `onCheckedChange` handler calls PUT API with `{ enableRealtime: checked }`
  - Shows success toast: "Realtime enabled" / "Realtime disabled"
- Added `RealtimeBanner` component in View Data dialog:
  - Shows green pulsing dot + "Live — listening for changes" when connected
  - Shows amber dot + "Connecting..." when disconnected
  - Auto-refreshes row data when `data-changed` or `update-available` events received
- Added "RT" badge in View Data dialog header (when realtime is enabled)
- Added 5 new Realtime API endpoints to API Playground:
  - `GET /api/v1/realtime/{table}` — Subscribe to real-time changes
  - `GET /api/realtime/health` — Check service health
  - `POST /api/realtime/emit` — Broadcast event to subscribers
  - `PUT /api/tables/{id}` — Enable/disable realtime
  - `GET /api/v1/data/{table}` — Fetch with ETag for change detection
- Added "Realtime Connection" card in API Playground Auth tab:
  - WebSocket connection URL with XTransformPort
  - JavaScript code snippets (Socket.IO client)
  - Swift (iOS) code snippets (Socket.IO-Client-Swift)
  - Note about realtime-enabled tables only
- Created `/api/realtime/health` proxy route — forwards to Socket.IO service
- Verified all features with agent-browser:
  - ✅ Realtime toggle works and persists
  - ✅ RT badge appears in dialog header
  - ✅ Live banner with auto-refresh
  - ✅ 5 Realtime endpoints visible in playground
  - ✅ WebSocket code snippets in Auth tab
  - ✅ Health endpoint returns proper status

Stage Summary:
- ✅ Complete realtime database feature implemented end-to-end
- ✅ Tables can be toggled to realtime mode via switch
- ✅ Row CRUD operations emit Socket.IO events to subscribers
- ✅ View Data dialog auto-refreshes when data changes
- ✅ API Playground has full realtime API documentation
- ✅ External apps can subscribe to table changes via WebSocket
- ✅ Version tracking ensures local-first sync compatibility
- ✅ Lint clean, dev server running without errors

### Architecture:
```
Table Toggle → PUT /api/tables/{id} { enableRealtime: true }
  ↓
Row CRUD → emitRealtimeEvent() → HTTP POST localhost:3003/emit
  ↓
Socket.IO Service → broadcasts to room `table:{tableId}`
  ↓
All connected clients receive data-changed + update-available events
  ↓
View Data dialog auto-refreshes / external app updates
```

### Event Flow:
```
POST /api/tables/{id}/rows → create row → update rowCount/versionHash → emit "insert"
PUT  /api/tables/{id}/rows/{rowId} → update row → increment version → emit "update"
DELETE /api/tables/{id}/rows/{rowId} → delete row → update rowCount/versionHash → emit "delete"
```

### Priority Recommendations for Next Phase:
1. Add auth token validation on Socket.IO connect (verify AppToken/session)
2. Add subscription filtering (subscribe to specific eventTypes, row filters)
3. Add reconnect with missed-change catchup (since parameter on subscribe)
4. Add presence indicators (who else is viewing this table)
5. Add realtime metrics per table (events/sec, subscriber count)
6. Add bulk row operations with single version hash update
7. Add conflict resolution UI for concurrent edits

---

## Session R29 - Comprehensive README

---
Task ID: 1
Agent: Main
Task: Create well-explained README with live visuals for better understanding

Work Log:
- Generated 3 AI images for README visual appeal:
  - `public/readme-hero.png` — Modern server infrastructure dashboard visualization
  - `public/readme-database.png` — Abstract database schema visualization
  - `public/readme-realtime.png` — Realtime data synchronization illustration
- Created comprehensive `README.md` with:
  - Hero image banner with badges (Next.js, TypeScript, SQLite, Socket.IO)
  - "What is SelfBase?" section with role-based table (Mobile Dev, Web Dev, Startup, Enterprise, Tinkerer)
  - ASCII art feature overview grid covering all 9 core modules
  - Architecture diagram showing app → API → database → microservices flow
  - Tech stack table
  - Realtime Database section with toggle visualization, event flow, and version tracking explanation
  - Authentication section with 3 methods (Admin Session, API Key → App Token, Permissions)
  - API Playground overview with 18 categories and 85+ endpoints
  - Database Management section with schema builder UI mockup and column types
  - Serverless Functions section with code example and trigger types
  - AI Integration section with Chat/Embeddings/RAG diagram
  - Data Pipelines section with source → transform → table flow
  - Monitoring section with ASCII dashboard and alert system
  - Quick Start guide with prerequisites, installation, and mini-services
  - Project structure tree
  - API Quick Reference with curl examples for auth, data, realtime, and sync
  - Roadmap table with ✅ completed and 🔜 upcoming features

Stage Summary:
- ✅ Comprehensive README created with visual diagrams and code examples
- ✅ 3 AI-generated images for visual appeal
- ✅ Covers all features: Database, Realtime, Auth, Functions, AI, Pipelines, Scrapers, Storage, Monitoring
- ✅ Includes quick-start guide and API reference
- ✅ ASCII art diagrams for architecture, data flow, and UI mockups

---

## Session R30 - v1 API Write Endpoints & Function Invocation

---
Task ID: 2-a
Agent: full-stack-developer
Task: Add write-side endpoints (insert/update/delete rows), function invocation, and table/function discovery to the v1 API namespace so external apps can use SelfBase as a real backend.

Work Log:
- Read existing v1 patterns: `/api/v1/data/[table]/route.ts` (GET), `/api/v1/auth/login/route.ts`, `/lib/app-auth.ts`, `/lib/api-utils.ts`, `/lib/realtime-emit.ts`, `/api/functions/[id]/run/route.ts`, `/api/tables/[id]/rows/[rowId]/route.ts` for consistency
- Added `POST /api/v1/data/[table]` (insert row) to the existing `src/app/api/v1/data/[table]/route.ts`:
  - Validates app token via `validateAppToken`, requires `write` or `admin` permission
  - Finds table by `[table]` name param
  - Body itself is the row data — stored as `data: JSON.stringify(body)`
  - Increments `table.rowCount`, refreshes `table.versionHash` (sha256 hex truncated to 16 chars)
  - Emits `insert` realtime event via `emitRealtimeEvent`
  - Returns 201 with the created row on success; 400 if body is not a JSON object
- Created NEW file `src/app/api/v1/data/[table]/[rowId]/route.ts` with three handlers:
  - `GET` — fetch a single row by ID (any permission)
  - `PUT` — update a row; merges body into existing data (supports partial updates), increments `row.version`, refreshes table version hash, emits `update` realtime event (requires `write`/`admin`)
  - `DELETE` — delete the row, decrement `table.rowCount` (clamped to 0), refresh version hash, emit `delete` realtime event (requires `write`/`admin`)
- Created NEW file `src/app/api/v1/functions/[name]/invoke/route.ts` (POST):
  - Validates app token (any permission)
  - Finds function by `[name]` param (unique field on `SbFunction`)
  - Refuses inactive functions with 400
  - Creates a `FunctionRun` with `triggeredBy: 'app'`, `status: 'running'`
  - Executes the function code in the same sandboxed `new Function(...)` pattern as the admin route (handler / module.exports / .handler / .default fallback, env vars injection, configurable timeout)
  - Updates the run record with status (success/timeout/failed), output, error, durationMs, completedAt
  - Returns runId, functionName, status, output, durationMs
- Created NEW file `src/app/api/v1/functions/route.ts` (GET):
  - Validates app token (any permission)
  - Returns metadata-only list of active functions (id, name, description, triggerType, updatedAt) — never the code/env vars
  - Supports app discovery use case
- Created NEW file `src/app/api/v1/tables/route.ts` (GET):
  - Validates app token (any permission)
  - Returns tables with `id, name, displayName, description, rowCount, enableRealtime, updatedAt, columns[]`
  - System tables hidden by default; `?includeSystem=true` to include them
  - `?search=` filter matches `name` or `displayName` (contains, case-insensitive via Prisma)
  - Sensitive fields (RLS rules, schema JSON, priority, embedding config) are NOT exposed
- All endpoints verified via curl:
  1. Login as admin → create API key (`read,write,admin`) → login at `/api/v1/auth/login` → get app token
  2. Also created a read-only API key (`read`) to verify permission enforcement
- Test results (all passed):
  - `GET /api/v1/tables` → 200, lists 5 tables with columns (products, tasks, analytics, metrics, cse_stocks)
  - `GET /api/v1/functions` → 200, lists 3 active functions (assign_task, hello, notify_overdue_tasks) — no code exposed
  - `POST /api/v1/data/products` with `{"title":"Widget 2a","price":19.99,"inStock":true}` → 201, returns created row with version=1
  - `GET /api/v1/data/products/{id}` → 200, returns single row
  - `PUT /api/v1/data/products/{id}` with `{"price":24.99,"tags":["new","featured"]}` → 200, data merged (title kept), version=2
  - `DELETE /api/v1/data/products/{id}` → 200, `{deleted:true, id}`; subsequent GET → 404
  - `POST /api/v1/functions/hello/invoke` with `{"name":"World"}` → 200, output `{message:"Hello World"}`, durationMs=19
  - `POST /api/v1/functions/assign_task/invoke` with `{"taskId":"t123","userId":"u456"}` → 200, output confirms assignment, durationMs=15
  - Verified in `/api/functions/runs` that both invocations recorded `triggeredBy: "app"` (distinct from older `triggeredBy: "http"` runs from the admin route)
  - Negative tests: missing auth → 401; bad token → 401; non-existent table → 404; non-existent function → 404; non-existent row → 404; non-object body on POST/PUT → 400
  - Permission tests with read-only key: list tables/functions allowed; POST/PUT/DELETE all return 403 with "Insufficient permissions" message
  - `GET /api/v1/data/products` (existing GET) still works — POST was added without breaking it
- `bun run lint` clean
- Dev server log shows no errors; all v1 routes returning proper HTTP status codes (200/201/400/401/403/404)

Stage Summary:
- ✅ SelfBase is now a usable app backend — external apps can read AND write data, plus invoke serverless functions, all through the v1 API namespace
- ✅ Endpoints added:
  - `POST   /api/v1/data/{table}`              — insert a row (write/admin)
  - `GET    /api/v1/data/{table}/{rowId}`      — fetch one row (any perm)
  - `PUT    /api/v1/data/{table}/{rowId}`      — update a row (write/admin)
  - `DELETE /api/v1/data/{table}/{rowId}`      — delete a row (write/admin)
  - `POST   /api/v1/functions/{name}/invoke`   — run a function by name (any perm)
  - `GET    /api/v1/functions`                 — list active functions, metadata only (any perm)
  - `GET    /api/v1/tables`                    — list tables with columns (any perm)
- ✅ Auth: all new routes validate app token via `validateAppToken`; write routes require `write` or `admin` permission
- ✅ Realtime events emitted on insert/update/delete (only fires if table has `enableRealtime: true`)
- ✅ Version hash + row count kept in sync on every mutation
- ✅ FunctionRun records properly tagged `triggeredBy: "app"` to distinguish from admin/scheduler invocations
- ✅ Discovery endpoints hide sensitive data (function code/env vars, table RLS rules/schema JSON)
- ✅ Lint clean, dev server stable, no errors in log

### Example curl commands (for the next agent / docs):
```bash
# 1. Admin login (session token)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@selfbase.dev","password":"admin123"}'
# → {"success":true,"token":"<SESSION>","user":{...}}

# 2. Create API key (admin session token)
curl -X POST http://localhost:3000/api/api-keys \
  -H "Authorization: Bearer <SESSION>" \
  -H "Content-Type: application/json" \
  -d '{"name":"My App","permissions":"read,write,admin"}'
# → {"success":true,"apiKey":{"key":"sb_live_xxx",...}}

# 3. Exchange API key for app token
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Authorization: Bearer sb_live_xxx"
# → {"success":true,"token":"<APP_TOKEN>","expiresIn":3600,...}

# 4. List tables
curl http://localhost:3000/api/v1/tables -H "Authorization: Bearer <APP_TOKEN>"

# 5. Insert a row
curl -X POST http://localhost:3000/api/v1/data/products \
  -H "Authorization: Bearer <APP_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Widget","price":19.99,"inStock":true}'
# → 201 {"success":true,"data":{"id":"...","data":{...},"version":1,...}}

# 6. Update the row (partial merge)
curl -X PUT http://localhost:3000/api/v1/data/products/<rowId> \
  -H "Authorization: Bearer <APP_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"price":24.99}'
# → 200, version=2

# 7. Delete the row
curl -X DELETE http://localhost:3000/api/v1/data/products/<rowId> \
  -H "Authorization: Bearer <APP_TOKEN>"
# → 200 {"success":true,"data":{"deleted":true,"id":"..."}}

# 8. List functions (metadata only)
curl http://localhost:3000/api/v1/functions -H "Authorization: Bearer <APP_TOKEN>"

# 9. Invoke a function by name
curl -X POST http://localhost:3000/api/v1/functions/hello/invoke \
  -H "Authorization: Bearer <APP_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name":"World"}'
# → 200 {"success":true,"data":{"runId":"...","status":"success","output":{...}}}
```

### Notes / minor decisions:
- For POST/PUT the request body IS the row data directly (not wrapped in `{data: ...}`) — simpler SDK ergonomics for external mobile apps.
- PUT does a merge (PATCH-like) instead of a full replacement, matching the existing admin route at `/api/tables/[id]/rows/[rowId]`. This makes partial updates work cleanly from mobile clients on flaky networks.
- `triggeredBy: 'app'` is used for v1 function invocations (vs `'http'` for the admin route) so admins can attribute runs to external apps vs internal triggers in the Functions → Runs dashboard.
- The existing GET handler at `/api/v1/data/[table]` was left untouched (it has no app-token check — that's a pre-existing decision; the task explicitly said not to modify existing routes, only add to them).

### Priority Recommendations for Next Phase:
1. Add rate limiting per API key (per-route and global)
2. Add per-key usage analytics (request count, latency, error rate) — FunctionRun/SbRow mutations could feed a TableCall-style aggregation
3. Add `PATCH /api/v1/data/{table}/{rowId}` as an alias for PUT (semantic clarity for mobile SDKs)
4. Add bulk endpoints: `POST /api/v1/data/{table}/batch` (insert array), `DELETE /api/v1/data/{table}/batch?ids=...`
5. Add query filtering on `GET /api/v1/data/{table}` (e.g. `?filter={"price":{"$gt":10}}`) — currently only `since`/`limit`/`offset` are supported
6. Add `GET /api/v1/functions/{name}` to fetch one function's metadata (still no code)
7. Add an OpenAPI/Swagger spec auto-generated from the v1 routes for client SDK codegen
8. Consider auth on the existing `GET /api/v1/data/{table}` and `HEAD /api/v1/version/{table}` for consistency

---

Task ID: 2-b
Agent: general-purpose
Task: Test AI Bridge - generate configs via LLM and import them

Work Log:
- Read worklog.md to understand prior context (sessions R25–R29 covering API auth, playground expansion, dialog fixes, realtime DB, README).
- Located the AI Bridge feature source. Note: `src/components/admin/ai-bridge.tsx` does not exist — the actual implementation lives in `src/components/admin/data-transfer.tsx` (Data Transfer / AI Prompts component). AI prompt templates for tables/functions/pipelines/scrapers are defined inline there.
- Read all four import routes to learn the exact config schemas:
  - `/api/import/tables` — body `{ items: [{ name, displayName?, description?, columns: [{ name, type, nullable?, defaultValue?, isPrimaryKey?, isUnique?, isIndexed? }], rows: [{...}] }], mode: 'append'|'replace' }`
  - `/api/import/functions` — body `{ items: [{ name, description?, code?, runtime?, triggerType?, triggerConfig?, envVars?, timeoutMs?, memoryMb?, isActive? }], mode }`
  - `/api/import/pipelines` — body `{ items: [{ name, description?, sourceType?, url?, method?, headers?, authType?, authConfig?, jsonPath?, fetchInterval?, isActive?, onConflict?, targetTableName?, columnMappings?, primaryKeyCols?, preRunAction?, paginationMode?, paginationConfig?, maxPages?, maxRetries?, retryBackoff?, timeoutMs?, ssrfProtection? }], mode }`
  - `/api/import/scrapers` — similar shape with startUrl/selectorTree/paginationConfig
- Invoked the `LLM` skill to learn the z-ai-web-dev-sdk chat completions API (backend-only, `await ZAI.create()` → `zai.chat.completions.create({ messages, thinking: {type:'disabled'} })`).
- Wrote `/home/z/my-project/test-ai-bridge.mjs` — Node ESM script that imports `z-ai-web-dev-sdk`, issues three chat completions (one per resource type) using the prompt templates from data-transfer.tsx, strips any markdown fences, parses the JSON, and writes:
  - `ai-bridge-test/tables-config.json` (7136 bytes; tasks table w/ 9 cols + 5 sample rows, users table w/ 6 cols + 5 sample rows)
  - `ai-bridge-test/functions-config.json` (2454 bytes; `assign_task` http trigger + `notify_overdue_tasks` schedule trigger cron `0 9 * * *`)
  - `ai-bridge-test/pipelines-config.json` (1057 bytes; `fetchSampleTasks` pipeline → JSONPlaceholder /todos → tasks table, onConflict=update, 4 columnMappings)
- Ran the script with `node test-ai-bridge.mjs` — all three LLM calls succeeded, JSON parsed cleanly, files written. The z-ai-web-dev-sdk worked on the first try with no auth or config issues.
- Logged in as admin via `POST /api/auth/login` → got session token `399b99c3-cb89-4332-ad60-5f802b7f2ed7`.
- Imported all three configs via the import APIs:
  - Tables → `{imported:1, skipped:1, errors:[]}` (tasks imported; users skipped because a `users` table already existed in the DB from session R25 and mode defaulted to `append`)
  - Functions → `{imported:2, skipped:0, errors:[]}` (assign_task + notify_overdue_tasks)
  - Pipelines → `{imported:1, skipped:0, errors:[]}` (fetchSampleTasks)
- Verified the imported resources via GET endpoints:
  - `/api/tables` — `tasks` table appeared with 9 columns and 200 rows (see Stage Summary for why 200)
  - `/api/functions` — both imported functions appeared (assign_task http, notify_overdue_tasks schedule)
  - `/api/pipelines` — fetchSampleTasks appeared, target table resolved correctly by name
- Functional tests:
  1. Inserted a row into tasks table via `POST /api/tables/{id}/rows` with `{data:{id:99999,title:"Test AI Bridge task",...}}` → returned 201 with row id, version=1
  2. Ran `assign_task` via `POST /api/functions/{id}/run` with `{taskId:99999,userId:1}` → `{success:true, output:{success:true, message:"Task 99999 assigned to user 1"}, durationMs:11}`
  3. Ran `notify_overdue_tasks` (bonus) → returned 2 hardcoded overdue tasks (LLM-generated code doesn't actually query the DB), durationMs:11
  4. Previewed `fetchSampleTasks` via `POST /api/pipelines/{id}/preview` with `{}` → fetched 200 todos from jsonplaceholder.typicode.com in 46ms, columns mapped (id→id, userId→assignee, title→title, completed→status), previewRows returned correctly
- Cleanup:
  - Deleted the imported DB resources via DELETE routes (pipeline, both functions, tasks table) — all returned `{success:true}`
  - Deleted `test-ai-bridge.mjs` and the entire `ai-bridge-test/` directory
  - Verified no `tasks`/`assign_task`/`notify_overdue_tasks`/`fetchSampleTasks` resources remain in the DB

Stage Summary:
- ✅ AI Bridge end-to-end flow tested successfully: LLM (z-ai-web-dev-sdk) generated valid SelfBase JSON configs → import APIs accepted them → resources appeared in GET endpoints → resources functioned correctly (row insert, function run, pipeline preview all returned success)
- ✅ z-ai-web-dev-sdk works out-of-the-box in Node ESM context with `import ZAI from 'z-ai-web-dev-sdk'` + `await ZAI.create()` — no API key or env config needed
- ✅ All four import routes (/api/import/{tables,functions,pipelines,scrapers}) accept the JSON shape documented in the prompt templates in data-transfer.tsx
- ✅ `targetTableName` in pipeline config is correctly resolved to `targetTableId` by the import route (verified by GET /api/pipelines showing the resolved table id)
- ✅ Pipeline preview endpoint correctly applies column mappings and returns previewRows without writing to DB
- ✅ Function execution sandbox works correctly — `module.exports.handler = async (input) => {...}` pattern is recognized and executed
- ⚠️ IMPORTANT FINDING #1 — Pipeline scheduler auto-runs imported active pipelines: The `mini-services/pipeline-scheduler` (port 3010) polls the DB every 5s for active pipelines. Because the imported `fetchSampleTasks` pipeline had `isActive: true`, the scheduler ran it ~1 minute after import — fetching 200 todos from JSONPlaceholder and writing them to the tasks table. This overwrote the 5 LLM-generated sample rows (via `onConflict:"update"` + `primaryKeyCols:["id"]`). AI Bridge users should be warned that importing an active pipeline triggers an immediate run; consider defaulting `isActive: false` on import or providing a "dry-run only" flag.
- ⚠️ IMPORTANT FINDING #2 — Column mappings don't support value transformations: The pipeline prompt template (in data-transfer.tsx) encourages the LLM to request value transformations like `completed=true → "done", completed=false → "todo"`, but the actual `columnMappings` schema only supports field renaming (`{src, target, type}`), not value mapping. The imported pipeline correctly mapped `completed` (boolean) → `status` (TEXT) but kept the raw boolean value, contradicting the prompt's intent. Either remove the transformation hint from the prompt template or add a `valueMap` field to the schema.
- ⚠️ IMPORTANT FINDING #3 — LLM naming convention mismatch: Task spec asked for `assignTask` and `notifyOverdueTasks` (camelCase) but the LLM followed the prompt template's "lowercase_underscores" rule and produced `assign_task` / `notify_overdue_tasks`. Not a bug — the template is explicit — but worth noting that the LLM strictly follows the template over user-supplied naming hints.
- ⚠️ IMPORTANT FINDING #4 — Silent skip on append mode: The `users` table import was silently skipped (returned `skipped:1`) because a `users` table already existed from session R25 and the default mode is `append`. No error is surfaced to the user; only the `skipped` count changes. Consider adding a warning or surfacing skipped names in the response.
- ℹ️ NOTE — The task description referenced `src/components/admin/ai-bridge.tsx` but that file doesn't exist. The AI Bridge feature is implemented in `src/components/admin/data-transfer.tsx`. The task description's file path should be updated.
- ℹ️ NOTE — The LLM-generated function code for `notify_overdue_tasks` is a stub that returns hardcoded sample data instead of actually querying the tasks table. This is because the function execution sandbox doesn't expose a DB client to function code. If real DB access is desired from serverless functions, the function runtime needs to expose a DB/API helper in the sandbox context.
