# Increment077 — P11/S101.2 private persisted partial-comment outcome review

Date: 2026-10-29. Repository `danhgold7979-cyber/fonesi-W`, branch `feat/studio-workspace`, verified plan baseline HEAD `2a054d5c84737c1918fa78a77abb0db71d8fb781`; current checkpoint Increment076/069, exact tested source `0907738f7e594e1be533a9b9e8a2a590a9941672`. Do not modify `main`.

## Dependency and actual gap
S101.2 needs distinguish a verified post with definite comment failure from an unknown post/comment and only then eventually permit `SUCCESS_WITH_WARNINGS`. Increment074 inventories the frozen comment ordinals but blocks `DEFINITIVELY_REJECTED` even when the DB has such a state, and no integrated private summary explains when a posted-then-comment job is partial vs uncertain. **DB-only `CONFIRMED` and `DEFINITIVELY_REJECTED` are not independent authenticated Facebook/TikTok provider proof**, so these cannot yet authorize any terminal outcome, retry or cleanup.

## Increment scope, files and state transitions
1. `packages/database/src/comment-journal-review.ts`: accept the persisted journal state `DEFINITIVELY_REJECTED` as `DEFINITIVELY_REJECTED_DB_ONLY`, still no send/confirm/retry authority; keep unknown states, mismatched keys and duplicates BLOCKED without partial results.
2. New `packages/database/src/comment-partial-outcome.ts`: pure fail-closed classifier of exact parent PUBLISH DB row + frozen per-ordinal `CommentJournalListReview` + reviewable job state. Only one exact PUBLISH/CONFIRMED DB row accepted. Produce bounded redacted counts (DB-confirmed, DB-rejected, unknown) and distinct statuses `BLOCKED`, `COMMENT_UNCERTAIN_REVIEW`, `PARTIAL_DB_ONLY_REVIEW`, `ALL_COMMENTS_DB_ONLY_REVIEW`. Confirmed/rejected/missing journal never means provider certified; literal `canMarkSuccessWithWarnings/canConfirm/canRetry/canDispatch/canCleanup=false`.
3. `packages/database/src/index.ts`: add read-only `reviewPersistedCommentPartialOutcome` with exact snapshot hash and persisted parent effect binding, query max 33 COMMENT effects + 2 PUBLISH effects, delegate to trusted pure assessor; no writes, job terminal transitions, or provider adapter.
4. `apps/desktop/src/host/internal.ts`: private `comment.reviewPartialOutcome` DB worker operation only; NO public StudioApi/HTTP/preload/renderer mutation or retry.
5. `packages/database/src/comment-journal-review.test.ts` and new `packages/database/src/comment-partial-outcome.test.ts`: pure valid/rejected/uncertain/all-confirmed/no-journal, malformed states/counts, duplicate/mismatched PUBLISH, mixed outcomes, blocker/redaction/no-rights/immutability.
6. `packages/database/src/claimed-effect.test.ts`: real SQLite post CONFIRMED synthetic fixture; after frozen COMMENT preparation, INTENT→UNCERTAIN→NEEDS_REVIEW/DB-only rejection, verify read-only partial review across restart and that another device can still be claimed; reject forged public commands, bad snapshot/parent, corrupt journal, duplicate PUBLISH. No test result is claimed as provider-certified.
7. Run exact-source Ubuntu and Windows GitHub CI: generated contracts, TS typecheck, lint, build, unit/integration, Ubuntu Chromium UI, Windows VerifyOnly, both plan validators. Fix observed failures before recording RESULTS/PROGRESS/COMPLETION_PLAN/checkpoint-070 and exact SHA.

## State and fault matrix
- CONFIRMED parent PUBLISH **in DB only** + any unrecorded/INTENT/ATTEMPT_UNCERTAIN/NEEDS_REVIEW comment -> COMMENT_UNCERTAIN_REVIEW; device automation remains paused if job NEEDS_REVIEW.
- CONFIRMED parent in DB + every frozen ordinal has a journal and at least one `DEFINITIVELY_REJECTED`, all remaining `CONFIRMED` or rejected -> PARTIAL_DB_ONLY_REVIEW. This is **not** `SUCCESS_WITH_WARNINGS`, not negative provider proof.
- All frozen ordinals DB-CONFIRMED -> ALL_COMMENTS_DB_ONLY_REVIEW; still unverified externally.
- Duplicate/missing/foreign parent, wrong snapshot, unknown journal, forged rights/ordinal/count -> BLOCKED or exception, no effect/job/queue mutation.
- No auto-confirmation, retry, requeue, publication, cleanup, or Android I/O. Existing immutable PUBLISH record never repeated.

Maximum `TESTED_S101_DB_ONLY_PARTIAL_REVIEW_NOT_ACCEPTED`. S101.2, S100.3, S101.3 final acceptance, S102–S103, P12 app adapters, P13 fleet and P14 packaging still depend on real Windows10+Android USB/LAN and independently authenticated provider evidence; no reliable overall percent is available.
