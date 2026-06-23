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
