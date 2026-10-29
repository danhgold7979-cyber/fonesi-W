# Increment069 — P11/S100.1 exact frozen comment list and ordinal keys (private, no Android sending)

Date: 2026-10-29. Repository `danhgold7979-cyber/fonesi-W`, development branch `feat/studio-workspace`. Verified baseline HEAD `731f960394118a2b385970111ff3725413fe87e5`, checkpoint-061/Increment068. Checkpoint push CI 40883034648 and PR CI 40883043944 are SUCCESS for exact documentation SHA on Ubuntu/Windows. Keep `main` unchanged.

## Dependency and problem

Runbook S100 requires each comment ordinal to bind an exact hash and deterministic effect key to the verified parent post, preserving multiline UTF-8 as ONE item and distinguishing same-text comments at different ordinals. `prepareClaimedEffect` currently accepts arbitrary opaque hashes for COMMENT and the existing workflow fixture contains no immutable list/ordinal plan; the host does not have a private, bounded source of typed comment items. Without this, future adapter wiring risks reading mutable Process rows or composing duplicate keys. S097/S098 source guards exist but live provider readback is unverified; no post may be inferred from a SQLite fixture.

## Scope and files

1. New `packages/database/src/comment-list.ts`: pure deterministic `deriveFrozenCommentList`. Input: jobId, exact immutable snapshot + snapshotHash, post effect ID/key, declared field key + scope (`row`/`process`). Verify canonical frozen snapshot SHA, unique declared `list<text>` input, valid exact frozen string items (UTF-16 well-formed, no unsafe controls/bidi override, max 32 items, 32768 UTF-8 bytes each), bounded total bytes; zero/invalid items block. Retain exact code units including CRLF, emoji, Vietnamese, multiline. Derive private per-ordinal UTF-8 SHA, bytes, distinct deterministic comment effect keys and payload hashes bound to job snapshot, field, scope and confirmed publish effect. Never normalize or trim text. Return a private plan, with `canDispatch:false`, `canRetry:false`, `canConfirm:false`.
2. `packages/database/src/index.ts`: private `frozenCommentListPlan` method retrieves authenticated immutable job snapshot and the exact `CONFIRMED` PUBLISH effect from persisted SQLite; permits review only for POSTED/COMMENT_PENDING/NEEDS_REVIEW job states. Reject missing/mismatched post receipt without exposing text or treating persisted CONFIRMED as live provider proof. No mutation, no schema changes.
3. `apps/desktop/src/host/internal.ts`: private `comment.planFrozen` request dispatch; not exported in StudioApi, HTTP, preload or renderer. Raw text/digests remain trusted DB/host only.
4. New `packages/database/src/comment-list.test.ts` tests multiline/CRLF/emoji exact hashes, ordinal uniqueness even for repeated identical comments, row/process scopes, synthetic content changes with unchanged pinned SHA, wrong list definition/scope, empty/malformed/bidi/surrogates, too many/too long values, no key disclosure via error, input immutability.
5. Extend `packages/database/src/claimed-effect.test.ts` with real SQLite integration: one frozen typed comment list, post effect recorded CONFIRMED using **fixture-only SQL**; test private plan persists across SQLite restart, doesn't use edited mutable row, rejects wrong post/state/hash/public forged request, never inserts comments or invokes adapter. Clearly note DB CONFIRMED fixture is not real provider evidence.
6. CI: generated contracts/typecheck/lint/build, unit/integration, Chromium UI Ubuntu, Windows VerifyOnly, V2.1 plan validators. Fix failures and re-run on exact source SHA. After verified push+PR Ubuntu/Windows, write RESULTS, checkpoint-062, PROGRESS and COMPLETION_PLAN.

## State transitions and failure matrix

Pure read-only preparation: all inputs remain frozen; no effect journal transition or Android input. Missing verified persisted post, stale snapshot, unsafe list, absent declaration, conflicting field or invalid ordinal => block/throw before exposing any private items. Positive fixture means only immutable comment preparation, not provider account/target proof. Same text at two positions yields different effect key; exact bytes remain intact. A pending/unknown earlier comment is NOT deemed retry-safe, and no automatic comment/publish dispatch exists in this increment.

## Acceptance

Best attainable status `TESTED_S100_FROZEN_COMMENT_KEYS_NOT_ACCEPTED`. Physical Windows10+Android USB/LAN, actual picker, Unicode form fill, provider post/comment matching, duplicate prevention on device and S100/AT-100 remain OPEN. P11 and P12–P14 are not ACCEPTED; no overall completion percent from test counts.
