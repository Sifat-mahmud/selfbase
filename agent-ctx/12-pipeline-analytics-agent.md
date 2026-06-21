# Task 12 — Pipeline Run History Charts

## What was done
Added a **Pipeline Analytics** section to the Pipeline Studio list view (`/src/components/admin/pipeline.tsx`), placed below the existing pipeline cards grid.

## Files modified
- `/home/z/my-project/src/components/admin/pipeline.tsx` (1160 → 1479 lines, +319 lines)

## Components added
1. **4 stat cards** (responsive grid: sm:2, lg:4) — Total Runs, Success Rate, Avg Duration, Total Rows Written. Each has a gradient top-border accent, emerald icon chip, primary value, and contextual secondary line. Stagger-animated via Framer Motion.
2. **Run Duration Timeline** bar chart (lg:col-span-2) — last 20 runs reversed for left→right chronology. Per-bar color via Recharts `Cell` using `STATUS_COLORS` map. HH:mm X-axis labels. Theme-aware tooltip showing "Xms · Y rows" + capitalized status. Custom status legend below.
3. **Status Distribution** donut chart — Recharts Pie with `innerRadius=60 outerRadius=90 paddingAngle=2`. Per-sector colors. Center overlay shows totalRuns + "Total Runs" label. Legend at bottom with capitalize formatter.

## Bug fixed (incidental)
`loadAll()` was calling `apiGet<PipelineRunsResponse>('/api/pipelines/runs?limit=100')` then reading `r?.data ?? []`. But `apiGet` already unwraps `{ success, data }` envelopes, so `r` was actually the raw `PipelineRunItem[]` array — `r?.data` was always undefined, silently making `allRuns` empty. Fixed by typing as `PipelineRunItem[] | PipelineRunsResponse` and using `Array.isArray(r) ? r : (r?.data ?? [])`.

## Theme support
- Chart frame: `var(--popover)`, `var(--border)`, `var(--muted-foreground)`, `var(--popover-foreground)`, `var(--background)`, `var(--muted)`
- Status colors: oklch values (work in both light & dark) — success=emerald, failed=red, running=teal, pending=amber, timeout=orange
- No indigo/blue used as primary

## Verification
- `bun run lint` → 0 errors
- `curl http://localhost:3000` → 200
- `/api/pipelines/runs?limit=100` returns 4 runs (all success, 472-899ms, 387 rows each)
- agent-browser: h2 "Pipeline Analytics" renders, 4 stat cards with values 4/100%/759ms/1,548, bar chart shows 4 HH:mm bars, donut shows 1 success sector
- Existing pipeline detail view (clicking a card) still works and correctly does NOT show analytics
- VLM verified light mode: all 5 criteria met
- VLM verified dark mode: dark bg, strong contrast, legible cards/labels
- Screenshots: /tmp/pipeline-analytics-light.png, /tmp/pipeline-analytics-dark.png
