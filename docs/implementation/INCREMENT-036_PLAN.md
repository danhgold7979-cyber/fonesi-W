# Increment036 — P06/S056 Safe SQLite content-page browser (UI read-only slice)

Plan committed **before** implementation on 2026-10-28. Baseline `feat/studio-workspace@58987bc9f39e5864dff4a0c8aca36e0eb4a6711d`, schema v14 from merged Increment033. Master V2.1 P06/S056, `docs/implementation/P06_PLAN.md`, `INCREMENT-033_PLAN.md`, `INCREMENT-033_RESULTS.md`, existing `Processes.tsx`, `contentPage` contract/API/SQLite and content-data Playwright regressions inspected. Independent P11 Increment035 is being implemented concurrently; this increment does not edit its database/effect files.

## Why read-only first
The current authoring table intentionally fetches **all rows** to preserve global Select All, bulk edits, export and schedule previews. Replacing it with only the first page would silently drop unseen data. An explicit separate **read-only SQLite paging browser** makes server pagination testable on real UI without changing authoring-selection semantics. It is *not* yet a memory-bounded replacement for the legacy table, and must not claim one.

## Detailed implementation sequence
1. New `apps/desktop/src/renderer/ServerContentBrowser.tsx` calls only named `api.contentPage` with Process ID, 50-row limit, optional search and include-ignored filter. Exposes first/next/previous page with scope-bound cursor stack, exact total, page number, list of IDs, asset count, on-demand full JSON read. No edit, delete, selection, scheduling, source-media or arbitrary SQL action in this component.
2. Each load is user initiated; reset data and page stack on filter/Process change, prevent stale async response from overwriting a new query using generation token and mount lifecycle. Reject invalid filter lengths with explicit UI; show query errors (especially `CONTENT_QUERY_STALE`) without silently continuing with old cursor. Offer explicit restart with first page. Distinguish total results from current loaded page.
3. Add unobtrusive toggle on Process Content section; preserve existing full-row authoring/bulk/schedule logic and labels. Don't call `contentPage` automatically for hidden browser. Keep host permissions strictly unchanged.
4. Playwright: real SQLite endpoint creates 130 records across multiple Process fixtures, opens read-only panel, tests exact total/50 row limit, next/back, search, ignored toggle, no selection mutation, stale cursor after an outside data edit and first-page recovery, resets on changing Process.
5. Run hosted `pnpm check` Ubuntu/Windows, `pnpm test:ui` Ubuntu Chromium, `pnpm check:plan`. Record exact counts and receipt, then PR/merge to `feat/studio-workspace` with non-overlapping files. Recheck integration with concurrent P11 commit before merging.

## Acceptance boundaries
This is `TESTED_UI_READ_ONLY_SLICE` only, NOT full P06/S056, NOT memory bounded authoring, and no live app publishing. Global bulk/selection/scheduling remains legacy. Native Windows10, real media corpus/phones, APK/ADB/device app profiles, 20–300 scale and installer NOT_RUN. No `main` merge or release.
