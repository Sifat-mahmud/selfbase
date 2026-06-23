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
