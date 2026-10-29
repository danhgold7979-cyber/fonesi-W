# Increment038 — P06/S056 read-only server sort and cursor isolation

Date: 2026-10-28. Integration branch: `feat/studio-workspace`; inspected source at `97752b19508e25838422c7f4ddf178c22616a931`. Reviewed V2.1 master execution plan, P06/S056 plan, Increment033 SQLite v14 migration, Increment036 read-only browser, `ContentQuery`, strict public host DTO, keyset implementation, and unit/Playwright regressions. This plan is committed before code.

## Gap and acceptance boundary
The current SQLite content browser supports Process/filter-scoped stable keyset pages only in ascending insertion order. Users cannot show newest records first while keeping exact total and cursor safety. The legacy authoring table deliberately loads all rows for global Select All, bulk mutations and scheduling; replacing it with a page would silently change selection scope.

## Proposed slice
1. Extend public read-only `ContentQuery` with optional `sortOrder: 'OLDEST_FIRST' | 'NEWEST_FIRST'`, defaulting to existing ascending behavior. Strict Zod host validation and direct database runtime validation reject unknown values.
2. Support descending `rowid` keyset paging in SQLite using only fixed, whitelisted SQL fragments. Preserve exact total, Process/search/includeIgnored filter, epoch fence, ordered asset binding, page size and no arbitrary SQL. Bind sortOrder into the cursor fingerprint so a cursor from another sort cannot be reused. No migration or persistence mutation.
3. Add an accessible sort selector to the separate read-only `ServerContentBrowser`; changing it invalidates current page/cursor history and requires an explicit first-page load. Preserve existing generation/unmount fences and default UI ordering. Do not alter legacy editing, selected row IDs, bulk actions, exports, scheduled snapshots or content records.
4. Unit regressions cover 1000+ row descending keyset, first/next page with no duplicates, filter and ignored combinations, invalid sort, cross-order cursor rejection, and stable exact totals across restart. Chromium regression checks selector, reversed page navigation, and that read-only browsing does not change legacy selection.
5. Run Ubuntu/Windows GitHub `pnpm check`, Chromium `pnpm test:ui`, plan validators. Record actual CI SHA/count/outcome and limitations; do not assume green before checks complete.

## Risk and gates
This increment is P06/S056 **TESTED_READ_ONLY_SORT_SLICE** only after CI, not full query-scoped authoring or full P06 acceptance. Physical Windows10/Android, large real media corpus performance, thumbnails, full editor query-scope migration, 20→300 devices, Facebook/TikTok publish and Windows installer remain NOT_RUN. Commit only to `feat/studio-workspace`, do not merge `main` or publish an installer.
