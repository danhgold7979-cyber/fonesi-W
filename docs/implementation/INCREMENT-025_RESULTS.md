# Increment025 — P07/S068 + P13/S117: observed sleep/resume queue reconciliation

Baseline `feat/studio-workspace@87935843613c6194d9a0ba1ed1bd9d9cb89f4801`; implementation commit `d1c42f5a0f5ecbabd20ca09a40cd087809d536d6`; 28 October 2026. Plan was committed before source at `docs/implementation/INCREMENT-025_PLAN.md`.

## Scope implemented

- `packages/scheduler/src/recovery.ts`: bounded deterministic future calendar slot search based on frozen IANA timezone, local weekdays/slots, reproducible seed and reserved per-device timestamps. Ambiguous/nonexistent DST instant, invalid clock, exhaustion and oversized inputs fail explicitly.
- `packages/database/src/index.ts`: transactional `reconcileSleepGap(suspendedAt,resumedAt)` considers only **SCHEDULED/QUEUED** jobs due in a real observed 30s–7d sleep window, up to 5000 rows per transaction; no guessed boot gap, no truncation.
- Frozen snapshot policy: `CATCH_UP` queues a safe unclaimed job, `SKIP` marks it skipped, `NEXT_FUTURE_SLOT` reschedules into an unreserved future instant. Unknown policy or any effect journal -> `NEEDS_REVIEW`, not retry. Existing job ID, occurrence key, snapshot and snapshot hash remain unchanged. Replayed reconciliation returns no further state changes.
- `packages/domain/src/index.ts`: state-machine transitions explicitly expanded for guarded pre-effect recovery, without changing pending-effect safety rule.
- `apps/desktop/src/host/internal.ts` and `apps/desktop/src/main/index.ts`: private worker command from paired Electron `powerMonitor` suspend/resume events only; no public renderer/API command, no Android tap/publish and no synthetic success.
- `packages/scheduler/src/recovery.test.ts` and `packages/database/src/queue.test.ts`: real SQLite, restart, frozen profile after Process edit, effect/claim exclusion, idempotency, timezone/DST, device reservations and invalid clock cases.

## Verified results

[GitHub Actions run 40639719418](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40639719418): **SUCCESS** Ubuntu and Windows at `d1c42f5`.
- Ubuntu: `pnpm check` 232 PASS / 25 files, no skip/fail; `pnpm check:plan` PASS.
- Windows hosted: `pnpm check` 231 PASS, 1 pre-existing Unix-only native SDK fixture skipped / 25 files; PowerShell setup, launcher VerifyOnly, plan validators PASS.
- Earlier CI commits exposed a TypeScript guard error and missing fixture parameter; both fixed before final CI.

## Unrun / open gates

This is a **TESTED INCREMENT**, **not full S068 or P07/P13 acceptance**. Real Windows10 sleep-resume callback, hardware transport reprobe after resume, startup-offline-gap policy, OS clock rollback, real dispatch/physical phone, Facebook/TikTok app versions and 300-phone throughput remain **NOT_RUN/OPEN**. Resource ceiling of 5000 jobs is a safety bound, **not** measured capacity. Resume recovery never means a scheduled post has actually been published. Separate operator review is required for uncertain external effects.

## Combined branch evidence after merge

P04 portable clipboard merged to `feat/studio-workspace` as `2400bee`; this P07 increment merged as `efd40af`. The PR #3 combined integration [Actions run 40640056106](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40640056106) passed Ubuntu **236/236 tests across 26 files plus 23/23 Playwright browser scenarios**, Windows hosted **235 passed, 1 pre-existing Unix-only fixture skipped across 26 files**. This larger count includes the P04 tests (not a new P07-only count). Physical Windows10 power events and real Android remain NOT_RUN.
