# Increment074 — P11/S100.3 private read-only per-ordinal COMMENT journal inventory

Date: 2026-10-29. Repository `danhgold7979-cyber/fonesi-W`; branch `feat/studio-workspace`. Verified baseline HEAD `f395a89c2fccad4a80b82d7c9dd4c606479f20a6` after Increment073/checkpoint-066. Keep `main` untouched.

## Dependency and gap
The S100.1 frozen list and S100.2 candidate comparison now use durable COMMENT effect keys. After restart or partial list attempts there is no private per-ordinal inventory reconciling ALL frozen list items against durable COMMENT journals. A missing journal is not proof of non-dispatch, and a DB CONFIRMED state is not independent provider confirmation. S100.3 asks to distinguish definite failure, uncertainty, success and explicit comment-only retry, but no provider-certified result/negative proof exists, so this increment must **not** grant any retry or new dispatch.

## Scope, states and files
1. Add `packages/database/src/comment-journal-review.ts`: pure bounded (max 32) immutable frozen item vs persisted COMMENT rows comparison. Output only ordinal, no body, keys, IDs or timestamps. Map no journal→`NO_JOURNAL_UNVERIFIED`, INTENT→`INTENT_JOURNALED`, ATTEMPT_UNCERTAIN→`ATTEMPT_UNCERTAIN`, NEEDS_REVIEW→`NEEDS_REVIEW`, CONFIRMED→`CONFIRMED_DB_ONLY`. All remain non-certified; no permission to retry/confirm/dispatch. Reject forged/nonempty frozen blockers, forged rights, duplicate keys, payload mismatch, unknown rows, unsupported states and >32 rows as `BLOCKED` without partial attribution.
2. `packages/database/src/index.ts`: add `reviewPersistedCommentListProgress` read-only SQLite query for exact job and confirmed persisted PUBLISH parent via `frozenCommentListPlan`, then validate every COMMENT journal against frozen keys. Allow review only existing POSTED/COMMENT_PENDING/NEEDS_REVIEW states, no lease and no mutation; do not trust database CONFIRMED as provider proof.
3. `apps/desktop/src/host/internal.ts`: expose only `comment.reviewList` in trusted internal DB worker request. No public StudioApi/preload/HTTP/renderer operation and no retry.
4. `packages/database/src/comment-journal-review.test.ts`: pure regressions for valid no-journal, INTENT/uncertain/review/DB-confirmed, duplicate/rogue/mismatched rows, invalid plan, unknown state, over-bound, no rights, redacted results.
5. `packages/database/src/claimed-effect.test.ts`: real SQLite after synthetic parent publish, no-journal/INTENT/ATTEMPT_UNCERTAIN, restart + NEEDS_REVIEW, confirmed-in-DB-only fixture and forged worker public rejection. Assert effect and event row counts unchanged on read-only review.
6. Record `INCREMENT-074_RESULTS.md`, PROGRESS/COMPLETION_PLAN and checkpoint only with exact commit, CI and limits; run GitHub Actions Ubuntu/Windows generated/typecheck/lint/build/Vitest, Chromium UI (Ubuntu), Windows VerifyOnly and plan validators.

## Fault/state/acceptance matrix
No COMMENT effect row → `NO_JOURNAL_UNVERIFIED` (not safe to send). One exact bound INTENT → `INTENT_JOURNALED`, never proof of no dispatch. ATTEMPT_UNCERTAIN and NEEDS_REVIEW → review only, block resend. CONFIRMED → `CONFIRMED_DB_ONLY` (not live provider certified). Unexpected/unbound/duplicate journal or corrupted frozen plan → BLOCKED, no partial rows returned. No state authorizes a comment-only retry, much less a PUBLISH repost.

Maximum `TESTED_S100_READ_ONLY_COMMENT_JOURNAL_INVENTORY_NOT_ACCEPTED`. S100.3/AT-100, verified provider negative proof, Windows10+Android USB/LAN, P11-S101–S103, P12 app providers, P13 fleet and P14 release remain OPEN/NOT_RUN. Overall percentage cannot be inferred from fixture tests.
