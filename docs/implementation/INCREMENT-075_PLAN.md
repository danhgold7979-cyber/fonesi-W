# Increment075 — P11/S101.1 transactionally safe cancellation request at DB boundary

Date: 2026-10-29. Repository `danhgold7979-cyber/fonesi-W`; branch `feat/studio-workspace`. Live HEAD before planning: `24485b6059ebe7f20d80b5639b1eabf159188b92`. Increment074/checkpoint-067 exact tested source `9177ed2036f8f9ccfeee8fca04c89cd7caeae428`; later docs HEAD `24485b6059ebe7f20d80b5639b1eabf159188b92`. Never modify `main`.

## Problem / dependencies
S101.1 requires cancellation at a safe boundary. Existing `cancelScheduledJob` only covers SCHEDULED. Active jobs can carry frozen PUBLISH/COMMENT INTENT, ATTEMPT_UNCERTAIN, claimed leases, or staged media, and a terminal CANCELLED result could be interpreted as absence of an external side effect. The private host uses revision+phase fences before adapter callback, but there is no durable, audited cancellation request for active phases. No real provider/device pre-input fence exists; even a DB cancellation cannot retract an in-flight Android tap.

## Scope and files
1. `packages/database/src/index.ts`: add trusted transaction `requestJobCancellation({jobId,expectedRevision,actorId,at})`. Validate IDs, revision, clock. For SCHEDULED/QUEUED/WAITING_DEVICE/WAITING_NETWORK/MEDIA_MISSING/MEDIA_CHANGED/TARGET_MISSING with no persisted effect, staging ledger or job claim, apply terminal CANCELLED and one redacted audit event. Active PREFLIGHT/RUNNING/POST_INTENT/POST_PENDING/POSTED/COMMENT_PENDING, or SCHEDULED/QUEUED with any side-effect/claim/stage footprint, must transition atomically to NEEDS_REVIEW and retain all evidence, claim and lease; emit one redacted cancellation-review event, never auto-requeue/retry/publish. Invalid states/transition fail closed; existing NEEDS_REVIEW or CANCELLED returns idempotent no-write receipt after matching revision. Preserve snapshot and effect journals. No provider interaction.
2. `packages/domain/src/index.ts`: allow POSTED→NEEDS_REVIEW for explicit review-only cancellation of already-published jobs with remaining comments, but not POSTED→CANCELLED; keep pending effect fence.
3. `apps/desktop/src/host/internal.ts`: trusted-only `job.requestCancellation` command; do not publish StudioApi/HTTP/renderer command.
4. `packages/database/src/claimed-effect.test.ts`: real SQLite synthetic cases for safe pre-claim CANCELLED, active RUNNING→NEEDS_REVIEW, POST_INTENT/POST_PENDING cancel retaining journal and refusing late attempt/dispatch, already POSTED/COMMENT_PENDING requiring review, re-request idempotence, stale expectedRevision, bad actor/clock, preserved counts/effect, recovery/queue blocking, no forced job release or Android action. Reject command via public dispatcher.
5. Verify exact source with Ubuntu/Windows Github CI (generated contracts, typecheck, lint, build, unit/integration, Ubuntu Chromium UI, Windows VerifyOnly, plan validators). Correct failures; write RESULTS, PROGRESS, COMPLETION_PLAN, evidence/checkpoint and verify HEAD/CI.

## State, failure and acceptance table
- Safe preclaim, zero journal/stage/claim: CANCELLED with audit, never a provider call.
- Any active phase or possible external state: NEEDS_REVIEW, not terminal, revision increases to invalidate stale host dispatch. Preserved effect = INTENT/ATTEMPT_UNCERTAIN/CONFIRMED as recorded, not assumed provider success.
- POSTED means DB-confirmed only; cancellation cannot retract that post and must never authorize Reels repost.
- Stale revision, bad clock/actor, unexpected state: rejected without DB changes.
- Repeated request against current CANCELLED/NEEDS_REVIEW: idempotent, no duplicate audit.
- An adapter that already crossed its last fence may have in-flight I/O: no guarantee of stopping it until a real provider-side input fence/cancellation is verified.

Maximum `TESTED_S101_CANCELLATION_DB_FENCE_NOT_ACCEPTED`. S101.1/AT-101, S100.3 independent provider proof and safe comment-only retry, physical Windows10+Android, real FB/TikTok, P11-S102–S103 and P12–P14 hardware/scale/release gates remain OPEN/NOT_RUN; full tool percentage cannot be inferred.
