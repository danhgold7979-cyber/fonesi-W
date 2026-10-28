# Increment036 — P06/S056 read-only SQLite content browser

Baseline `feat/studio-workspace@58987bc9f39e5864dff4a0c8aca36e0eb4a6711d`. Plan `INCREMENT-036_PLAN.md` committed before source. Code test SHA `828df10a7b447d6e4b12273415915e0af6da0f5c`.

## Implemented
- `ServerContentBrowser.tsx`: explicit read-only scoped `api.contentPage` calls, fixed 50-row page, exact total from SQLite, first/next/back keyset cursor navigation, bounded search (120 chars), include-ignored filter and per-record full JSON on demand.
- A generation/mount fence drops old responses from changed filters/Process/unmounted views. Stale cursor errors are shown, old page is cleared and first-page restart is offered; never silently keep an untrusted cursor.
- A separate toggle in `Processes.tsx` displays this browser when needed. Existing authoring table's all-row selection, bulk edit/export and schedule scopes remain untouched; browsing one page is NOT misconstrued as editing the full Process.
- Chromium regression creates 53 active + 1 ignored content items, checks 50/3 page boundaries, exact total, previous, SQLite search, include ignored, external mutation invalidates cursor, and pre-existing 53-row selection unchanged.

## Verified
- Source HEAD `828df10a7b447d6e4b12273415915e0af6da0f5c`: [GitHub Actions run 40650844449](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40650844449): **SUCCESS** Ubuntu + Windows.
- Ubuntu `pnpm check` **272 passed/30 files**, `pnpm test:ui` **29 passed**, `pnpm check:plan` passes.
- Windows hosted `pnpm check` **271 passed, 1 pre-existing Unix-only SDK fixture skipped /30 files**; Windows setup/launcher VerifyOnly, typecheck/lint/build/plan validators successful.

## Acceptance boundary
This is a **TESTED_UI_READ_ONLY_SLICE**, not full P06/S056 acceptance: the authoring table still loads all rows; full memory-bounded editor needs query-scoped selection/edit/sort/schedule semantics and real large corpus tests. This release did not run Windows10 GUI, physical Android, media throughput at 20→300 phones, app-specific posting, or installer. No main merge or release. 
