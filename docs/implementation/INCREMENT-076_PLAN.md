# Increment076 — P11/S101.3 immutable private manual external-effect review evidence

Date: 2026-10-29. Repository `danhgold7979-cyber/fonesi-W`, branch `feat/studio-workspace`. Verified baseline HEAD `138254b265fd4d397859eabfdba48d8943969da8` (Increment075/checkpoint-068). Source test at `57a118954e3741089e3ddd43b8785f1e29a00378`: Ubuntu/Windows SUCCESS. Keep `main` unchanged.

## Dependency / gap
Increment075 can atomically place active/journalled jobs in NEEDS_REVIEW; however there is no durable, append-only operator record binding an actor, reason, evidence reference and explicit *non-certifying* review disposition to the exact pending effect. The legacy `review_cases` table has no actor/evidence integrity controls, so reusing it would not meet S101.3 audit requirements. Neither a human note nor an SQLite CONFIRMED state constitutes provider proof.

## Scoped implementation and files
1. `packages/database/src/schema.ts`: add migration 21, append-only `effect_manual_reviews` with request ID, FK job/effect, revision, expected effect state, actor ID, bounded reason/disposition, evidence reference JSON, request hash, timestamp and indexes. Add immutable UPDATE/DELETE triggers. Do not mutate existing review_cases or earlier migrations.
2. `packages/database/src/index.ts`: trusted `recordEffectManualReview` with unique request ID and deterministic request hash; require current NEEDS_REVIEW job with expected revision and exact pending INTENT/ATTEMPT_UNCERTAIN/NEEDS_REVIEW effect for that job, 1–8 distinct evidence reference IDs, valid actor/reason/disposition and time; record immutable note with zero mutation to job/effect/claim/queue. Identical repeated request ID returns alreadyRecorded; changed payload with same ID rejects. Add bounded private read-only per-effect list with redacted count/actor/reason/disposition and no raw evidence IDs. Every response has canConfirm/canRetry/canDispatch=false.
3. `apps/desktop/src/host/internal.ts`: private-only `effect.reviewRecord` and `effect.reviewHistory` DB worker operations, no public StudioApi, renderer/preload/HTTP command.
4. `packages/database/src/claimed-effect.test.ts`: real SQLite uncertain PUBLISH and COMMENT fixtures, cancellation/recovery into NEEDS_REVIEW, valid review write/read after restart, idempotent replay and malformed/stale/forged/wrong job/effect/reason/evidence/terminal phase cases; immutability triggers, no changes to effect/job/queue and no public dispatch. Existing migrations and Windows/Linux CI must pass.
5. Log source SHA, initial CI failures/corrections, Ubuntu+Windows tests, docs RESULTS/PROGRESS/COMPLETION_PLAN/checkpoint and doc-head CI after observable runs. If CI fails, fix and retest exact source.

## Fault and state constraints
NEEDS_REVIEW + exact pending effect + referenced evidence -> append only a non-certifying note; state of effect and job unchanged. No effect/cancelled job/wrong revision/unknown reference/duplicate evidence -> reject. Duplicate identical requestId -> no second note; conflicting reuse -> reject. ALTERED/DELETED note -> SQLite trigger abort. Manual disposition never means provider-confirmed, definite failure, automatic comment-only retry, publish resend or safe cleanup.

Maximum `TESTED_S101_PRIVATE_REVIEW_AUDIT_NOT_ACCEPTED`. S101.3/AT-101 and S101.2 need provider-certified evidence, operator resolution authorizations/UI, physical Windows10+Android USB/LAN, FB/TikTok verification and P12–P14 gates; no whole-tool percentage possible.
