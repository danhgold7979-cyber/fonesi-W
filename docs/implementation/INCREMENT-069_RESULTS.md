# Increment069 — exact immutable comment-list ordinal keys behind a private host boundary

Date: 2026-10-29. Repository `danhgold7979-cyber/fonesi-W`, branch `feat/studio-workspace`. Owner P11/S100.1 source-only partial implementation.
Plan-first `6d8a66e5b0c89aeb9daf0bb52733b820cc7722d2`; initial implementation `b6c139cdbf7419f1858319a8a4554e6a05c0af2f`; async public-dispatch test correction `47b5a2b7f84cc4a77248c95ed65769f1f889bb9f`; post-state/receipt fixture correction and **exact tested source SHA `5c71f5f99560ca967dc6c385edf837ad192b68ca`**.

## Source implemented

- `packages/database/src/comment-list.ts`: private deterministic `deriveFrozenCommentList` reads only immutable JobSnapshot row/process `list<text>` definitions/values. Requires exact canonical snapshot SHA, one matching input, 1–32 items and bounded UTF-8 bytes. Rejects unsafe controls/bidi/lone UTF-16 surrogates, wrong type, missing list, too long or mismatched source. Does not trim/normalize CRLF, emoji, Vietnamese or multiline. Each ordinal yields exact private value, SHA-256 UTF-8 hash, bytes and distinct deterministic effect/payload keys bound to job snapshot, declared scope/key and persisted parent publish effect. Even duplicate strings get distinct ordinal keys. Every permission literal `canDispatch:false`, `canRetry:false`, `canConfirm:false`.
- `packages/database/src/index.ts`: private read-only `frozenCommentListPlan` joins authenticated SQLite snapshot to a specific persisted CONFIRMED PUBLISH effect, requires reviewable POSTED/COMMENT_PENDING/NEEDS_REVIEW job state. No mutable Process or Content fallback, SQLite schema change or journal mutation. **A fake DB CONFIRMED record is not provider proof.**
- `apps/desktop/src/host/internal.ts`: private `comment.planFrozen` worker operation; not exposed via public StudioApi, renderer, HTTP or preload. This is not a provider or sending capability.
- `packages/database/src/comment-list.test.ts`: Unicode/CRLF and repeated text ordinals, process scope, parent binding, immutability, 17 fail-closed source cases. `packages/database/src/claimed-effect.test.ts`: real SQLite worker fixture reads frozen comment after a synthetic PUBLISH CONFIRMED row, ignores subsequent mutable Content edits, preserves data across restart, rejects unconfirmed parent/wrong state/stale snapshot and forged public route, remains read-only.

## CI-driven fixes

Initial source `b6c139cdbf7419f1858319a8a4554e6a05c0af2f` passed strict compile/typecheck but one SQLite test incorrectly expected an unconfirmed-publish error while job still had POST_PENDING state. Source correctly blocked that phase first. A correction at `47b5a2b7f84cc4a77248c95ed65769f1f889bb9f` awaited the asynchronous public-dispatch rejection; the exact tested correction `5c71f5f99560ca967dc6c385edf837ad192b68ca` asserts both job-phase and parent-publish gates in order, without weakening any production guard.

| Exact-source run | Ubuntu | Windows |
|---|---|---|
| [Push 40885144542](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40885144542) | SUCCESS | SUCCESS |
| [PR 40885154234](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40885154234) | SUCCESS | SUCCESS |

Ubuntu **513/513 unit/integration (44 files)** and **31/31 Chromium UI**. Windows **512 PASS + 1 platform-only skip (44 files)**. Generated contracts/typecheck/lint/build, Windows `start-windows.ps1 -VerifyOnly` and plan validators PASS at exact source SHA.

## Acceptance limits and next dependency

Status **TESTED_S100_FROZEN_COMMENT_KEYS_NOT_ACCEPTED**. Deterministic comment source plans currently do **not** enforce that a future `prepareClaimedEffect(kind:'COMMENT')` consumes these specific keys, and the trusted host still has no certified provider adapter; that is the next S100 integration dependency. No Android comment typing, per-item verification/retry, provider post confirmation, fleet, cleanup or installer evidence. S100/AT-100 and P11 not ACCEPTED, P12–P14 open, `main` untouched. No defensible tool-wide percentage.
