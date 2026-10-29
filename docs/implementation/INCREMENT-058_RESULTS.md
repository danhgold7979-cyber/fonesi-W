# Increment058 — one pending cleanup-review request per stage across MANUAL generations

Date: 2026-10-29; repository `danhgold7979-cyber/fonesi-W`, branch `feat/studio-workspace`; P11/S095.3.
Plan first: [INCREMENT-058_PLAN.md](INCREMENT-058_PLAN.md) at `98ca958d24a58186f8a80f297f665e2704e568d7`, baseline `006e057cd10f49c34e9120a1aadb85dcc706c07d`.
**Exact tested source SHA `d3d04df8968cd873b2479ec2475404761d0a85ef`**.

## Changes in real source

- `packages/contracts/src/media.ts`: `CLEANUP_REVIEW_ALREADY_PENDING` is now a typed cleanup preflight blocker, with unchanged `canDelete:false` and `canDispatch:false` policy.
- `packages/database/src/index.ts`: `assessOwnedStageCleanup` checks the immutable SQLite v20 review journal for any prior stage review (all rows are hardware-pending until future explicit resolution). A future MANUAL generation + fresh remote-byte/MediaStore proof cannot create a second review. The transactional `recordOwnedStageCleanupReviewRequest` preserves idempotency for the *same request ID*, exact still-current lease and audit, but rejects a different ID while any stage review exists — even when the redacted UI summary is capped at 20. Stale lease, changed observation, source/host mismatch and effects remain blocked. No DB schema migration or deletion.
- `apps/desktop/src/host/native-stage-review.ts`: if the redacted job summary already contains a pending request for that ordinal, reject before acquiring any MANUAL actor lease, sending any ADB request or opening the native confirmation. SQLite remains authoritative for concurrent or older/truncated history.
- `apps/desktop/src/renderer/JobStageReviewDialog.tsx`: suppress new cleanup-review button when a pending review for that ordinal is in the persisted summary; the separate read-only Android observation action remains available, and historical evidence remains visible.
- `packages/database/src/device-stage.test.ts`: actual SQLite test creates a confirmed first review, replays exactly the same request while lease/observation current, releases lease, acquires a second MANUAL lease generation, appends another valid NOT_INDEXED audit, and verifies a new review is rejected and old request ID cannot be retargeted. Stage/job still `NEEDS_REVIEW`/unverified.
- `tests/stage-transfer-host.test.ts`: after a recorded native review and restart, repeated native action blocks before any device actor/ADB readback/native prompt. Existing browser tests verify no public HTTP privilege.

## Exact source CI and status

| Run | Evidence | Result |
|---|---|---|
| Push | [40850562471](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40850562471) | **SUCCESS** both Ubuntu and Windows on `d3d04df8968cd873b2479ec2475404761d0a85ef` |
| PR | [40850574233](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40850574233) | **SUCCESS** both Ubuntu and Windows on `d3d04df8968cd873b2479ec2475404761d0a85ef` |

Ubuntu: **370/370 unit/integration tests (39 files), 31/31 Chromium UI**, generated contracts/typecheck/lint/build and plan validators passed. Windows: **369 passed + 1 platform-only skip (39 files)**, generated contracts/typecheck/lint/build, Windows VerifyOnly and plan validators passed.

## Acceptance boundary and next dependency

Status: **TESTED_SINGLE_PENDING_CLEANUP_REVIEW_NOT_S095_ACCEPTED**. The durable request is intentionally non-executable and cannot be "resolved" into permission to delete or publish in this increment. The operator must still verify physical Android state and picker with appropriate native screen evidence, an independent explicit cleanup authorization and a crash-safe postcondition protocol before any real remote deletion. Physical Windows10/USB-LAN, multiple phones, Facebook/TikTok publishing verification, 20→100→300 fleet and signed/offline installer remain OPEN/NOT_RUN. No merge to main and no claim of percentage for overall 15 phases/125 steps/375 tasks.
