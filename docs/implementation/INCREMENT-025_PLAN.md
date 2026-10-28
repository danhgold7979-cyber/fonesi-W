# Increment025 — P07/S068 + P13/S117 sleep/resume missed-slot reconciliation

## Master-plan alignment before implementation

Baseline: `feat/studio-workspace@87935843613c6194d9a0ba1ed1bd9d9cb89f4801`. Read `docs/source-plan/v2/16_MASTER_EXECUTION_PLAN.md`, `17_STEP_RUNBOOK.md` S068 and S117, `docs/implementation/COMPLETION_PLAN.md`, P07_PLAN, PROGRESS and P07 queue claim tests. This increment is an **independent slice**, not full P07/P13 acceptance.

**Problem:** Existing scheduler has `overdueAction` policy and a durable per-device queue, but the host does not reconcile missed slots on actual OS sleep/resume. A missed slot must not be confused with ordinary busy queue delay, an uncertain external effect, or a claimed/running job.

## Detailed phase slice and order

1. **P07-S068.1 (pure scheduler):** Add bounded deterministic `nextAvailableRecoverySlot` using frozen ScheduleProfile + IANA/Temporal and seeded jitter, honoring reserved device times; never silently truncate. Explicit finite resource budget; DST invalid/ambiguous times go to review, not guessed.
2. **P07-S068.1/2 (SQLite):** Add transactionally idempotent `reconcileSleepGap(startMs,endMs)` for only **SCHEDULED/QUEUED** jobs whose missed scheduled UTC falls in the *observed* suspend→resume interval. Require two valid clocks, <= 7 days and max 500 rows per transaction; no backfill from guessed startup time. Frozen snapshot policy only (never current mutable Process settings). Preserve occurrenceKey, snapshot hashes and external effect ledger.
3. **Policy transitions:** `CATCH_UP` -> QUEUED, `SKIP` -> SKIPPED, `NEXT_FUTURE_SLOT` -> SCHEDULED with next free valid calendar slot. For empty/invalid frozen policy or any effect -> NEEDS_REVIEW. No unverified state/transport or external phone actions. Extend transition map only for these explicitly guarded pre-effect recovery paths.
4. **P13-S117.2 (main lifecycle):** Observe real Electron powerMonitor suspend/resume only; if paired event and significant real gap, call a **private DB-worker-only** command. Never expose a public HTTP/preload command, never dispatch Android input on recovery, never infer a gap from restart alone. Device transport remains stale/revalidated by P08; do not falsely mark it ready. No fake timer.
5. **Tests:** deterministic unit integration with real SQLite including reload, same timestamp collision, frozen profile after Process mutation, older/future slot exclusions, effect and in-flight exclusion, replay idempotency, malformed/too-large gaps, no snapshot changes; CI Ubuntu+Windows, browser regression/plan validator. On Windows 10 physical sleep/ADB/hardware, mark NOT_RUN until real host tests.

## Files

`packages/scheduler/src/recovery.ts`, `packages/scheduler/src/recovery.test.ts`, `packages/domain/src/index.ts`, `packages/database/src/index.ts`, `packages/database/src/queue.test.ts`, `apps/desktop/src/host/internal.ts`, `apps/desktop/src/main/index.ts`, docs/evidence updates after testing.

## Gates

- `pnpm check`, `pnpm check:plan`, GitHub Actions Ubuntu/Windows.
- Exact effect/uncertainty safety invariant: **no simulated publish, no unowned tap, no duplicate occurrence**, and no claims that policy reconciliation equals ready-to-execute. If power events unavailable, this remains safe no-op.
- Receipt status `TESTED_SLICE` only after CI; S068 end-to-end Windows sleep and actual phones NOT_RUN.
