# Increment052 — persisted stage-review history in the Schedule operator UI

Date: 2026-10-29.
Repository: `danhgold7979-cyber/fonesi-W`; branch: `feat/studio-workspace`.
Planning baseline: `96bb4e66d6dbf1d8c0ef3daf10ca79ea35c4bda3` (Increment051 TESTED, checkpoint-044).
Scope: P11 / S095.2–S095.3, display-only evidence inventory after uncertain staging; no hardware cleanup or dispatch.

## Problem and prerequisites

Increment051 stores fenced JOB/MANUAL reconciliation observations but does not expose a redacted, readable view of stage provenance in the desktop UI. Operators currently see `NEEDS_REVIEW` without knowing whether durable evidence exists. S095 requires durable ownership and unambiguous recovery; exposing an evidence trail before introducing cleanup allows safe, deliberate decisions without making unknown effects runnable.

Prerequisites already implemented (not full phase ACCEPTED): immutable job snapshots, SQLite v19 stage journal and reconciliation audits, queue recovery, typed IPC, Schedule job list and JobPreflightDialog. No external Android evidence is certified.

## Implemented slice and state transitions

1. Add a typed, bounded `JobStageReviewPage` DTO for operator display with job state/revision, stage ordinals and persisted receipt indicators, newest-first audit observations and opaque pagination cursor. All status labels are explicitly **persisted only, not live phone/picker evidence**. `canDispatch:false` always.
2. Implement `StudioDatabase.jobStageReview(jobId,cursor?)` as a **read-only SQL projection** of stage/audit rows. Never fetch/serialize remote paths, nonces, hashes, ADB serial, local paths, account, payload, lease owner ID or captions. Reconciliation `leaseOwnerKind` may be shown as JOB/MANUAL, not lease owner. Include stage records even when no audit exists. Cap 32 stages and 20 audit entries/page; stable keyset by timestamp and audit ID. Bind cursor to job ID and job revision. Reject malformed, cross-job or stale-revision cursor. Rows are immutable observations, not current readiness.
3. Wire `jobStageReview` through strict host dispatcher request schema, typed `StudioApi` and existing host/preload/web transport; it is a *read* command only. No host device lease, Android adapter, posting/effect or cleanup command.
4. Add `JobStageReviewDialog` and Schedule button visible **only** for `NEEDS_REVIEW` jobs. Display stage ordinals, uncertain states, remote-byte/MediaStore stored evidence, historical observations/time and owner-kind attribution. Implement loading/empty/error/reload/next-page behaviors with cancellation/cleanup of stale async responses; no automatic repeated call, no action to requeue/delete/post. User-facing notice must clearly say persisted-only.
5. Integration/regression tests: no-stage case, persisted stage + JOB/MANUAL audit projection, sorted paged history, no duplicate/missing rows, invalid/stale/cross-job cursors, no sensitive data leak, no DB/stage/job mutation, public command never accepts a write request. Browser fixture in Schedule verifies actual view and absence of secret paths/caption and verifies DB state unchanged.
6. Run exact-source CI Ubuntu and Windows `pnpm check`, Chromium browser tests, Windows `VerifyOnly`, plan validators; fix failures. Commit RESULTS, checkpoint-045 and PROGRESS with exact SHA/OS/CI evidence.

## Files expected

- `packages/contracts/src/schedule.ts`, `packages/contracts/src/api.ts`
- `packages/database/src/index.ts`, `packages/database/src/device-stage.test.ts`
- `apps/desktop/src/host/service.ts`
- `apps/desktop/src/renderer/Schedule.tsx`
- `apps/desktop/src/renderer/JobStageReviewDialog.tsx` (new)
- `tests/ui/schedule.spec.ts`
- `docs/implementation/INCREMENT-052_RESULTS.md` (new)
- `docs/evidence/implementation/checkpoint-045.json` (new)
- `docs/implementation/PROGRESS.md`

## Safety, error and acceptance boundaries

- Stage state remains `INTENT`/`TRANSFER_UNCERTAIN`/`SYNC_ACK_UNVERIFIED`/`NEEDS_REVIEW`; job remains `NEEDS_REVIEW`. Reads do not mutate leases, claims or stage/job/effects.
- A historical `MEDIASTORE_ROW_MATCHED_NOT_PICKER_VERIFIED` classification is an *observation*, not a picker or publishing confirmation. Never map it to `READY`, `SUCCESS` or `canDispatch:true`.
- Do not expose host-only journal fields or add action buttons disguised as review.
- No Windows 10 physical, Android USB/LAN, MediaStore picker, posting, ownership cleanup, fleet load or installer acceptance claimed. Only TESTED_READ_ONLY_OPERATOR_EVIDENCE after exact-source CI, not S095/P11 ACCEPTED.
