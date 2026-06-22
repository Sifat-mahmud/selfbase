# Task ID: 2-b — Settings & UI Agent

## Task
Add Settings section, real-time indicator, and notifications dropdown to SelfBase Admin Studio.

## Files Created
- `src/components/admin/settings.tsx` — SettingsView with 5 tabbed forms (General, AI, Storage, Security, Deployment). Uses react-hook-form + zod, persists via POST /api/config, polished card-based UI with sticky save bar, gradient active-tab styling, emerald/teal accent.
- `src/components/admin/realtime-indicator.tsx` — Top-bar badge showing live/connecting/offline status from useRealtime hook. Pulsing green dot when live, amber while connecting, red when offline. Tooltip shows active connections + load score.
- `src/components/admin/notifications-bell.tsx` — Popover bell with red unread-count badge. Aggregates alerts with eventCount > 0 from /api/monitoring/alerts and recent logs from /api/logs?limit=5. "View all in Logs" footer navigates to the Logs section.

## Files Modified
- `src/stores/admin-store.ts` — Added `'settings'` to `AdminSection` union type.
- `src/app/page.tsx` — Imported Settings icon, SettingsView, RealtimeIndicator, NotificationsBell. Added Settings as the 11th nav item (after Logs). Added `case 'settings'` to SectionContent. Inserted NotificationsBell between sidebar separator and section badge. Inserted RealtimeIndicator between section badge and Command button.

## Implementation Notes

### Settings tabs
Each tab is a separate `useForm` instance keyed by config keyspacing (`general.appName`, `ai.defaultLlmProvider`, etc.). On mount, `SettingsView` fetches the entire `/api/config?limit=200` map and seeds each form via `useForm({ values })`. Saving iterates the form values and POSTs each key/value to `/api/config` (upsert). The "Reset" button calls `form.reset()`; the sticky "Save Changes" button calls `form.handleSubmit(onSubmit)`.

The Deployment tab is read-only info + two action buttons:
- "Restart Services" → mock toast (900ms spinner)
- "Export Config" → downloads `selfbase-config-YYYY-MM-DD.json` containing the current config map

### Lint compliance
Initial lint flagged `react-hooks/set-state-in-effect` (settings.tsx load() in useEffect) and `react-hooks/refs` (realtime-indicator ref access during render). Fixed by:
1. RealtimeIndicator: switched to React's "adjust state during render" pattern (track `prevConnected` + `everConnected` as state, update both inside `if (connected !== prevConnected)` block in render body).
2. Settings: inlined the initial fetch into the useEffect as an async IIFE so setState happens after `await`, not synchronously. Kept a separate `load` callback for the `onSaved` refresh.

### Visual design
- Emerald/teal accent colors throughout (no blue/indigo)
- Sticky save bar uses backdrop blur with white/95 background
- Active tab uses `bg-gradient-to-br from-emerald-500 to-teal-600 text-white`
- Section headers use a small emerald-tinted icon chip on the left
- Toggle fields render as bordered cards with the switch on the right
- Number inputs include min/max bounds matching the zod schema

## Verified
- `bun run lint` — clean (0 errors, 0 warnings)
- `curl GET /` → 200, page contains "SelfBase", "Settings", "Notifications", "Command"
- `curl GET /api/config?limit=200` → 200
- `curl GET /api/monitoring/alerts?limit=50` → 200
- `curl GET /api/logs?limit=5` → 200
- `curl POST /api/config` → 201 with upserted record (saves work end-to-end)
- Dev server compiles cleanly (207ms), no runtime errors in dev.log

## Stage Summary
All 4 tasks complete: Settings section, navigation update, real-time indicator, notifications dropdown. Lint clean. All APIs respond 200. Sticky footer preserved.
