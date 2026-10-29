# Increment055 — redacted persisted cleanup request history in Schedule

Date: 2026-10-29; repository `danhgold7979-cyber/fonesi-W`; branch `feat/studio-workspace`.
Plan-first: [INCREMENT-055_PLAN.md](INCREMENT-055_PLAN.md), plan commit `9c5f1d2bf09b6f96ddc16362cf3313092d39cfe8`.
**Tested source SHA: `ac0fdf8499764253a2ae485fd3a01d69364f1a57`.**
Scope: P11/S095.3 redacted operator visibility, not Android cleanup.

## Actual implementation and safety

- `packages/contracts/src/schedule.ts`: `JobStageReviewPage` now includes a bounded historical `cleanupRequests` list containing only `stageOrdinal`, `recordedAt` and constant `REVIEW_REQUESTED_HARDWARE_PENDING`, plus explicit `cleanupHasMore`. No request ID, stage ID, file path, nonce, hash, phone serial, account, operator owner or execution token.
- `packages/database/src/index.ts`: `jobStageReview` selects 21 newest journal records from persisted SQLite v20, returns 20 + a truncation flag, joins only the stage ordinal, and remains `PERSISTED_ONLY` with `canDispatch:false`. Existing reconciliation cursor/pagination unchanged, independent of request summaries. No writes, leases, transport probes or side effects.
- `apps/desktop/src/renderer/JobStageReviewDialog.tsx`: actual Schedule review dialog now shows `Yêu cầu rà soát cleanup đã lưu` with dates, media order, empty state, explicit no-file-deletion/no-publishing caveat, and 20-item truncation notice. It contains no new Android action, apply, cleanup or dispatch control.
- `packages/database/src/device-stage.test.ts`: stage-free job projection remains empty, a real private committed cleanup-review request is visible in sanitized public read projection before and after SQLite restart; omitted sensitive fields verified, job and stage unchanged.
- `tests/ui/schedule.spec.ts`: a persisted SQLite v20 fixture row appears in the real Chromium Schedule dialog; checks historical-only warnings, absence of request ID/path/nonce/hash/secret caption, and that opening the view leaves job and stage unchanged.

## Exact-source CI

| Operating system | Evidence | Result |
|---|---|---|
| Ubuntu | [Push 40844128512](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40844128512) | **SUCCESS**, 359/359 unit/integration tests (39 files), 31/31 Chromium UI; generated contracts, TypeScript, lint, build and plan validators passed |
| Windows | [Push 40844128512](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40844128512) | **SUCCESS**, 358 passed + 1 platform-only skip (39 files); generated contracts/typecheck/lint/build, Windows VerifyOnly, plan validators passed |
| Duplicate PR CI | [40844136247](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40844136247) | **SUCCESS** on the exact tested SHA for Ubuntu and Windows |

## Acceptance boundary and next dependency

Status: **TESTED_REDACTED_CLEANUP_REVIEW_HISTORY_NOT_S095_ACCEPTED**.

Read-only history is not a user-triggerable hardware cleanup workflow and does not authorize deletion. The private native callback and v20 durable review-intent record from Increment054 remain internal. No Android delete, new MANUAL lease, fresh USB/LAN probe, MediaStore picker confirmation, job requeue or publish action is created here. Browser fixtures and CI do not prove real Windows 10/Android behavior.

Next: controlled user-triggered review with live device lease and fresh actual Android proof where authorized, followed by fenced remote cleanup protocol only after physical testing. P10–P14 hardware/publishing/operations/release gates remain OPEN/NOT_RUN. The 15 phase/125 step/375 task plan is unchanged; total tool completion percentage cannot be computed from these slices.
