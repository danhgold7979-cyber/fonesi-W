# Increment029 — P06/S056: transactional content query with stable cursor

Baseline `feat/studio-workspace@c55ca58235e8c1806c956c37f05b40713cffbcef`. Before code: read `docs/source-plan/v2/16_MASTER_EXECUTION_PLAN.md`, S056/AT-056 in `17_STEP_RUNBOOK.md`, `docs/implementation/P06_PLAN.md`, P05/P08 latest results, and existing `listContent`, `listJobs` cursor, import/bulk/selection and SQLite migrations.

## Problem and slice boundaries

Current `content(processId)` loads every row with one asset lookup per item (N+1); the UI virtualizes DOM but not DB read/memory. Build a bounded **read-only** SQLite content page query and typed named API while preserving the legacy all-row UI and all-item scheduling semantics until a separate UI migration. Do not silently change "select all" to only the first page or schedule unseen rows.

## Ordered tasks

1. **P02 schema prerequisite:** append **migration 13** only, retaining checksums of prior migrations. Add `query_epochs('content')` and triggers for ContentItem insert/update/delete and ordered content_assets insert/delete; SQLite restart/restore migration tests. Never reset epoch on migration.
2. **P06 query:** `listContentPage({processId,search?,includeIgnored?,cursor?,limit?})` with stable `rowid` keyset, limit 1–250, ordered assetIds via **one bounded batch query**, total returned explicitly (not inferred from loaded prefix). Scope fingerprint locks Process/search/ignored filter; versioned base64url cursor validates exact keys, bounded bytes, epoch; reject stale page after content or asset change. Invalid/mismatched cursor must never expose another Process.
3. **Named IPC:** public contract DTO `ContentQuery/ContentPage`, strict Zod host schema, `contentPage` in `StudioApi`, preload mapping and loopback host dispatcher; no arbitrary SQL, filesystem path, shell or raw device action accepted.
4. **Tests:** SQLite 1,000+ items across two Processes, stable page traversal/no duplicates/ordered assets, scope mismatch, invalid cursor and size, stale after update/ignore/asset reorder/restart. Browser integration uses a typed API request to same persisted SQLite host, no fixture response disguised as production. Keep old Process editor table behavior unchanged this increment.
5. **Verification:** `pnpm check`, `pnpm check:plan`, source server/browser and hosted Ubuntu/Windows CI. Document migration v13 recovery/backup and native acceptance separately; no claim that P06 S056 full UI/selection/query migration is accepted.

## Acceptance boundaries

P06/S056 backend slice is `TESTED` only when cursor/epoch/host tests pass. Do not call full feature accepted while `Processes.tsx` still loads all rows and filters client-side; sorting/column menus/query-scoped selection remain OPEN. Windows10 GUI, 20→300 phone scaling and production media-corpus benchmarking remain NOT_RUN. No source files, Android media or job history may be deleted by this read-only API.
