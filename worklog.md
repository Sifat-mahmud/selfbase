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
