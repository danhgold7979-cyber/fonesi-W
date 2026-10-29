# Increment072 — independent private provider comment candidate readback (never a certified post)

Date: 2026-10-29. Repository `danhgold7979-cyber/fonesi-W`, branch `feat/studio-workspace`, phase P11/S100.2 preparation.
Plan-first SHA `0655fba1c271f37e65d319bee1fe50c5b122d22c`; source implementation `bb8ce420ec4fa879aec4132d7dafb46d15a48672`, identity fixture fix `f7c2001a6ae6444f55d4cabbcb941d5c3e85a53e`, exact-candidate test addition `0302a98e22a95dcee6ba7252ce4ce96dc21d773a`; **exact tested source `3ee2063253b41df52cc302db121cb169cb7fa102`**.

## Implemented source and data boundary

- `packages/database/src/comment-verification.ts`: private `assessProviderCommentCandidates` compares a frozen list ordinal and `ATTEMPT_UNCERTAIN` COMMENT journal against at most 32 supplied candidate provider observations. Checks app, account/author, target, exact parent external post ID, external comment ID, exact Unicode UTF-8 hash/byte count, intent/readback windows, freshness and uniqueness; invalid/duplicate/stale evidence blocks. Repeated identical comment bodies at different frozen ordinals force AMBIGUOUS_REVIEW, even with a single readback, because a provider comment body cannot attest its frozen ordinal. Empty/no match is review-required, **never proof of definite failure**. A single exact candidate is `EXACT_CANDIDATE_UNCERTIFIED`, not CONFIRMED.
- `packages/database/src/index.ts`: private read-only `reviewPersistedCommentCandidates` authenticates SQLite job snapshot, COMMENT ATTEMPT_UNCERTAIN journal, frozen item keys/hash, and a persisted CONFIRMED PUBLISH parent before invoking the comparator. Supports post-crash job NEEDS_REVIEW without a live lease; does not write job/effect/queue state. Caller-provided parent external post ID is comparison input only, **not a stored provider attestation**.
- `apps/desktop/src/host/internal.ts`: private `comment.reviewCandidates` DB worker operation. No public StudioApi/HTTP/preload/renderer command, and raw candidate IDs and bodies never appear in public summaries.
- `packages/database/src/comment-verification.test.ts`: synthetic single-candidate, empty, ambiguous repeated frozen text, multiple candidates, duplicate provider IDs and malformed/stale/future/wrong-identity/Unicode evidence; all rights `canConfirm/canRetry/canDispatch` literal false and no sensitive data in summary.
- `packages/database/src/claimed-effect.test.ts`: real SQLite fixture with matching synthetic Process identities, durable COMMENT uncertainty, restarted NEEDS_REVIEW, no mutation from read-only candidate evaluation, ambiguous duplicate-content cases and one structurally exact unique-text candidate which remains UNCERTIFIED. Public forged worker command is rejected. A fixture `CONFIRMED` row is not live Facebook/TikTok post proof.

## CI-driven correction

Initial source `bb8ce420ec4fa879aec4132d7dafb46d15a48672` failed the synthetic Process test with `IDENTITY_MISMATCH` because account and target IDs were not registered to the fixture's app/device; `f7c2001a6ae6444f55d4cabbcb941d5c3e85a53e` added **synthetic SQLite identities** rather than bypassing production identity validation. Added a distinct-comment real SQLite candidate/restart case at `0302a98e22a95dcee6ba7252ce4ce96dc21d773a`. That test revealed the expected audit event from `recoverExpiredClaims`; exact tested commit `3ee2063253b41df52cc302db121cb169cb7fa102` distinguishes legitimate recovery audit mutation from the subsequent read-only candidate query, preserving all negative assertions.

| Exact-source run | Ubuntu | Windows |
|---|---|---|
| [Push 40894692108](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40894692108) | **SUCCESS** | **SUCCESS** |
| [PR 40894705761](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40894705761) | **SUCCESS** | **SUCCESS** |

Ubuntu **551/551 unit/integration (45 files)**, **31/31 Chromium UI**. Windows **550 PASS + 1 platform-only skip (45 files)**. Generated contracts, typecheck, lint, build, Windows VerifyOnly, both plan validators PASS on exact source SHA.

## Acceptance and next dependency

Status **TESTED_S100_COMMENT_CANDIDATE_READBACK_NOT_ACCEPTED**. There is NO production provider that supplies independent authenticated comment observations or a persistent, certified parent post reference, and NO code authorizing repost/comment retry. The comparator cannot attest which ordinal created an identical comment. Real Android app UI, account/target identity, Unicode typing, media picker, comment/post external IDs, crashes and fleet 20–300 remain NOT_RUN. S100.2 and AT-100, P11, P12–P14 and installer/release remain OPEN/NOT_ACCEPTED; `main` untouched and no honest overall completion percentage can be inferred.
