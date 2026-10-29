# Increment055 — P11/S095.3 redacted durable cleanup-request history in Schedule

Date: 2026-10-29; repository `danhgold7979-cyber/fonesi-W`; branch `feat/studio-workspace`.
Plan-first baseline: `6ed25b8394e77b6ac6ac693ac49416e7835823b0` (Increment054 v20 journal committed; exact-source CI success, checkpoint-047).
Scope: **read-only** operator visibility of real persisted cleanup review requests. No device input, no deletion, no approval button.

## Problem and dependency
Increment054 stores immutable `device_stage_cleanup_reviews` rows but only the private host can inspect them. The Schedule "Hồ sơ đối soát" currently shows staging evidence and reconciliations without explaining if a historical operator request was recorded. Displaying redacted intent history helps operators avoid duplicate manual decisions and understand restart state; it is not a live Android status.

## Implementation steps
1. `packages/contracts/src/schedule.ts`: extend `JobStageReviewPage` with bounded cleanup request history: ordinal, recordedAt, constant `REVIEW_REQUESTED_HARDWARE_PENDING`, and `cleanupHasMore`. No requestId, stageId, nonce, path, account, ADB serial, hash, lease owner, snapshot or token. Scope remains `PERSISTED_ONLY` and `canDispatch:false`.
2. `packages/database/src/index.ts`: use a limited SELECT on v20 review rows JOIN durable stage for the same job, ordered by createdAt/requestId descending, cap 20 + one lookahead. Include on the first page and subsequent reconciliation-page fetches. No DB writes, no device/lease method or private data copied into response. A truncated history is clearly signalled, not silently presented as exhaustive. Existing cursor validation for reconciliation remains intact.
3. `apps/desktop/src/renderer/JobStageReviewDialog.tsx`: add an accessible "Yêu cầu rà soát cleanup đã lưu" section showing media ordinal and time, historical-only warning, empty state and 20-item truncation notice. Do not display request IDs. No submit/delete/retry button, no native callback invocation, no auto-refresh/device command.
4. `packages/database/src/device-stage.test.ts`: update stage-free expected page, assert journal appears as redacted persisted history after an actual committed private DB request and SQLite reopen; verify snapshot/job unchanged and no sensitive fields in JSON.
5. `tests/ui/schedule.spec.ts`: extend real SQLite fixture to include a v20 persisted cleanup-request row referencing an existing stage/audit. Verify UI shows it and warning, does not leak raw path/nonce/hash/request ID and cannot issue a cleanup command. Job/stage/reconciliations must stay identical after viewing.
6. Run exact-source Ubuntu/Windows CI with generated contracts, typecheck, lint, build, unit/integration, Chromium, Windows VerifyOnly, plan validators. Fix failures. Record `INCREMENT-055_RESULTS.md`, checkpoint-048 and PROGRESS with exact source SHA/OS, commit/push and verify.

## State/error/acceptance boundary
No transitions: `NEEDS_REVIEW` job and uncertain stage remain. Request record is historical `REVIEW_REQUESTED_HARDWARE_PENDING` only; not permission for cleanup. Fenced native confirmation and actual Android cleanup remain private/unavailable from the UI. Reconciliation pagination remains independent; truncated cleanup list visibly labelled.

After CI strongest claim: `TESTED_REDACTED_CLEANUP_REVIEW_HISTORY_NOT_S095_ACCEPTED`. Physical Windows10/Android USB-LAN, exact picker, real remote deletion/recovery, Facebook/TikTok publishing, fleet performance and installer release remain NOT_RUN.
