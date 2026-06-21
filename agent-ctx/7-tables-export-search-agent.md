# Task ID: 7 — Export (CSV/JSON) + Search/Filter/Sort in Tables View Data dialog

## Agent
Full-Stack Developer

## Task
Add Export functionality and Search/Filter/Sort to the Tables section's View Data dialog in SelfBase Admin Studio.

## Previous Context
Read `/home/z/my-project/worklog.md` — earlier work covered:
- Task 3: QA across all 11 admin sections
- Task 4: Pipeline Studio HTML scraping + TLS bypass for cse.com.bd
- Task 5: Dashboard styling polish (sparklines, motion, dark-mode tooltip fix)
- Task 6: Inline row editing + bulk selection in Tables View Data dialog (foundation this task extends)

## Files Modified
- `/home/z/my-project/src/components/admin/tables.tsx` (1616 → 1866 lines, +250 lines)

## Work Log
1. Added `useMemo` to React imports and `Download`, `ArrowUp`, `ArrowDown` to lucide-react imports (`Search` and `ArrowUpDown` were already imported).
2. Added 3 new state vars: `searchQuery` (string), `sortColumn` (string | null), `sortDirection` ('asc' | 'desc').
3. Added `filteredRows` useMemo — client-side case-insensitive search across any cell value of every loaded row's parsed `data` JSON.
4. Added `sortedRows` useMemo — applies current `sortColumn`/`sortDirection` on top of `filteredRows`. Number-aware comparison for INTEGER/DECIMAL cells, `localeCompare` for everything else; null/undefined values always sort to the bottom.
5. Added `toggleSort(colName)` — cycles between asc / desc / clear-then-asc when clicking a different column.
6. Added `downloadBlob(blob, filename)` — creates an object URL, anchors it, click-trigger, cleanup.
7. Added `exportData(format, selectedOnly)` — picks rows from `dataRows` (or filtered by `selectedRowIds` when `selectedOnly=true`), parses each row's JSON, and produces either:
   - CSV: column headers from `selectedTable.columns` joined with `,`, then per-row escaped values (quotes/newlines/commas handled with `""` escape)
   - JSON: pretty-printed array of parsed objects
   - Filename sanitized with `replace(/[^a-z0-9_-]/gi, '_')` to produce `{tableName}.csv` / `{tableName}.json`
   - Fires a toast on success with the row count + filename
8. Updated `toggleSelectAll` to operate on `sortedRows` (visible rows) instead of `dataRows`.
9. Reset `searchQuery`/`sortColumn`/`sortDirection` in both `handleViewData` (when opening fresh) and the dialog `onOpenChange` (when closing).
10. Rewrote View Data Dialog header — title row now contains: DialogTitle with row-count badge, DialogDescription, then a single toolbar row with [Search input (flex-1, with Search icon)] [Export dropdown] [conditional Delete Selected button] [Add Row button].
11. Added a conditional filter/sort status line below the toolbar: "Showing X of Y rows" + a sort badge with column name + ↑/↓ + clear button + "clear search" link.
12. Updated the bulk selection bar text to "N selected of M visible rows (filtered from K)" when a filter is active.
13. Updated the empty state to differentiate "No rows match your search" (with Clear search button) from "No rows yet" (with Add first row button).
14. Made each column header clickable — wrapped name + (TYPE) annotation in a `<button>` that calls `toggleSort(c.name)`. Shows `ArrowUpDown` (muted) when unsorted, `ArrowUp` (emerald) when asc, `ArrowDown` (emerald) when desc.
15. Replaced `dataRows.map(...)` with `sortedRows.map(...)` in the table body.
16. Updated select-all Checkbox `checked` and `disabled` props to use `sortedRows.length` instead of `dataRows.length`.
17. Export dropdown uses the existing `DropdownMenu` component with 4 items: Export as CSV, Export as JSON, (separator), Export Selected as CSV, Export Selected as JSON. The "Selected" items are disabled when `selectedRowIds.size === 0` and show the selection count when enabled.

## Verification
- `bun run lint` → 0 errors ✓
- `curl http://localhost:3000` → HTTP 200 ✓
- Browser QA with agent-browser on cse_stocks table (100 rows loaded):
  - Search input filters rows: typing "ZAHIN" → 1 match, "PRIME" → 2 matches, "1STECH" → 0 matches (empty state with Clear search shown) ✓
  - "Showing X of Y rows" count line appears when filter/sort active ✓
  - Column headers clickable, sort indicator (ArrowUp/ArrowDown in emerald) updates correctly; clicking same column toggles asc/desc, rows re-order accordingly (verified with sl column: 288,289,290 asc → 387,386,385 desc) ✓
  - Sort works in combination with filter (sorted 2 PRIME-filtered rows alphabetically: PRIMELIFE before PRIMETEX) ✓
  - Sort badge with clear (×) button removes the sort ✓
  - Export dropdown opens with 4 options; "Selected" variants disabled (show "—") when no selection, enabled (show count) when row(s) selected ✓
  - Verified export actually triggers downloads by intercepting `URL.createObjectURL` and `HTMLAnchorElement.prototype.click`:
    - Export as CSV → blob 4509 bytes text/csv, filename `cse_stocks.csv` ✓
    - Export as JSON → blob 19254 bytes application/json, filename `cse_stocks.json` ✓
    - Export Selected as CSV (1 row selected) → blob 96 bytes text/csv (just the selected row) ✓
  - Existing features intact: Inline edit still works alongside search/sort (edited PRIMELIFE row's stock_code field, Save/Cancel buttons appeared) ✓
  - Bulk selection (select-all + per-row checkboxes) + Delete Selected button + Clear bar all functional ✓
  - Dark mode: dialog renders with correct dark backgrounds (verified `lab(2.75381 0 0)` dialog bg, dark class on `<html>`), filter/sort/Export UI all legible ✓
  - State resets on dialog close: search/sort cleared so reopening the dialog starts fresh ✓

## Stage Summary
- Features added: client-side search/filter across any cell value with "Showing X of Y rows" status, client-side column sorting (asc/desc/clear) with per-column indicator arrows, Export dropdown with 4 options (CSV / JSON / Selected-as-CSV / Selected-as-JSON) producing real blob downloads with sanitized filenames and success toasts, sort/search status badges with clear buttons, search-aware empty state, sort badge in status line.
- Files modified: `/home/z/my-project/src/components/admin/tables.tsx` only.
- Verification: lint clean (0 errors), HTTP 200, all 3 features manually tested via agent-browser in both light and dark mode; existing inline edit + bulk select + add-row + delete features remain functional; no new dependencies introduced; emerald/teal palette preserved (no indigo/blue).
