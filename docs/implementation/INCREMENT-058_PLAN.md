# Increment058 — prevent repeated pending cleanup-review requests across MANUAL generations

Date: 2026-10-29; repository `danhgold7979-cyber/fonesi-W`, branch `feat/studio-workspace`.
Baseline `006e057cd10f49c34e9120a1aadb85dcc706c07d` (Increment057 TESTED, checkpoint-050).
Scope: P11/S095.3 — idempotence and operational safety, not actual Android cleanup.

## Defect and risk
Increment057 exposes a native-only operator action that can create a durable `REVIEW_REQUESTED_HARDWARE_PENDING` record after fresh evidence and explicit native confirmation. SQLite v20 prevents duplicate review under the same stage/lease generation/audit observation, but a later MANUAL generation with a fresh observation can insert a second *still-pending* request for the same stage. There is no resolution or delete executor yet. Repeated confirmations would be noisy and could mislead operators into believing another deletion action is queued.

## Detailed implementation
1. `packages/contracts/src/media.ts`: new `OwnedStageCleanupBlocker` `CLEANUP_REVIEW_ALREADY_PENDING`; keep `canDelete:false` and `canDispatch:false`.
2. `packages/database/src/index.ts`: `assessOwnedStageCleanup` reads existing immutable `device_stage_cleanup_reviews` by stage ID and returns `BLOCKED` with the new reason if any review is pending, including a previous MANUAL lease generation. In transaction `recordOwnedStageCleanupReviewRequest`, allow same-ID replay **only when the same live MANUAL generation, exact matching observation and all other eligibility guards remain satisfied**; otherwise return conflict. Any different request ID when a pending row already exists fails closed *inside the same transaction*, even if a race bypasses a preflight. No schema change or deletion.
3. `apps/desktop/src/host/native-stage-review.ts`: before an expensive new lease/ADB readback, fail closed when the redacted persisted summary already includes the stage's pending review. The DB remains authoritative when older pending entries are outside the bounded 20-item summary or a concurrent host adds a row.
4. `apps/desktop/src/renderer/JobStageReviewDialog.tsx`: do not present a new cleanup request button when the persisted redacted summary already shows a pending request for that ordinal. Keep explicit live read-only observation button. No staging or publishing actions added.
5. `packages/database/src/device-stage.test.ts`: idempotent exact same-ID replay, other-ID rejected in same generation, different-ID rejected across a later MANUAL generation after fresh NOT_INDEXED audit, no job/stage mutation. Stale lease/revision/frozen identity and indexed MediaStore remain denied.
6. `tests/stage-transfer-host.test.ts`: repeated native request after a successful persisted receipt must be blocked **before ADB and before native prompt**, under the new action and under a new MANUAL generation. Browser `tests/ui/schedule.spec.ts` remains explicit that public loopback has no cleanup write capability.
7. Run CI Ubuntu and Windows with generated contracts/type/lint/build/unit, Chromium UI, Windows VerifyOnly, plan validators; fix regressions; record `INCREMENT-058_RESULTS.md`, checkpoint-051 and PROGRESS/COMPLETION_PLAN with exact-source SHA/OS and commit results.

## State and acceptance
All job/stage state unchanged. The only durable new data remains historical operator consent, not a cleanup queue or Android deletion. Same request ID/idempotent only while evidence/lease is exactly still current; after lease release it does not become valid again. Existing pending review never grants any stage manipulation, `canDelete:false` and `canDispatch:false` always.

At most `TESTED_SINGLE_PENDING_CLEANUP_REVIEW_NOT_S095_ACCEPTED`. Physical Windows10/Android USB-LAN, MediaStore/picker, deletion postcondition, provider publishing and 20–300 fleet/release gates remain OPEN/NOT_RUN.
