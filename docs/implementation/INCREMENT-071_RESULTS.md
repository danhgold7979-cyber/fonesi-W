# Increment071 — exact frozen COMMENT body at trusted adapter boundary

Date: 2026-10-29. Repository `danhgold7979-cyber/fonesi-W`, branch `feat/studio-workspace`. P11/S100.1–S100.2 private transport preparation only. Plan-first commit `d8178891578119c6a3a60ade4d08b4cc2943f43d`; **exact tested source SHA `1342ca72336ef42191917378bf793ed0aca81fb9`**.

## Source implemented

- `packages/database/src/index.ts`: read-only private `resolveClaimedCommentDispatch` requires a persisted `ATTEMPT_UNCERTAIN` COMMENT effect, current enabled VERIFIED device/JOB lease and claim generation, correct job revision/phase/snapshot hash, and a matching immutable frozen `list<text>` item. Re-derives selected item against exact persisted CONFIRMED PUBLISH parent, current COMMENT journal effectKey and payloadHash. Returns text and its UTF-8 hash/bytes to trusted host **only**, never to public StudioApi.
- `apps/desktop/src/host/internal.ts`: adds private `comment.resolveClaimed` worker request. Public preload, HTTP and renderer are unchanged; the request is inaccessible via public dispatcher.
- `apps/desktop/src/host/claimed-effect-service.ts`: after durable INTENT → ATTEMPT_UNCERTAIN and the existing private pre-dispatch lease fence, COMMENT-only host logic invokes the private readback. It verifies effect ID/job ID, ordinal, effect and payload keys, and recomputes SHA-256 and exact UTF-8 byte length of the returned text before passing a discriminated `{kind:'COMMENT', comment:{ordinal,value,utf8Hash,utf8Bytes}}` to the injected trusted adapter. PUBLISH remains a separate shape with no comment. Cancellation after readback means no adapter call. The returned public-independent coordinator result never includes comment text or hashes.
- `packages/database/src/claimed-effect.test.ts`: eight real SQLite/injected-adapter regressions cover exact Vietnamese+emoji+CRLF multiline comment at the second ordinal, immutable data despite mutable Content edits, journal state preserved after restart and rejected replay; mutated journal payload before resolution; four forged private worker receipts; released lease between journal fence and readback; cancellation after exact text resolution. All rejected paths send zero adapter calls, preserve uncertainty and do not infer post confirmation.
- No device I/O/provider adapter registration, public API, DB migration, actual publish/comment, automatic retry, confirmation, or cleanup.

## Exact-source CI

| Workflow | Ubuntu | Windows |
|---|---|---|
| [Push 40890441708](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40890441708) | **SUCCESS** | **SUCCESS** |
| [PR 40890449847](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40890449847) | **SUCCESS** | **SUCCESS** |

Ubuntu **523/523 unit/integration (44 files)** and **31/31 Chromium UI**; Windows **522 PASS + 1 platform-only skip (44 files)**. Generated contracts, typecheck, lint, build, Windows `start-windows.ps1 -VerifyOnly`, and V2.1 plan validators passed on exact tested source SHA `1342ca72336ef42191917378bf793ed0aca81fb9`.

## Unresolved gates / next dependency

Status **TESTED_S100_PRIVATE_COMMENT_ADAPTER_PAYLOAD_NOT_ACCEPTED**. The successful adapter response is an injected fixture ACK_UNVERIFIED; it is not evidence of a Facebook/TikTok comment, real Android Unicode typing, exact account/target or verified parent post. This boundary is asynchronous: a future production adapter must independently fence device ownership/transport at actual I/O. S100.2 real provider readback, S100.3 no-duplicate comment-only retry, S101–S103, P11 hardware AT-100, P12 adapters, P13 fleet, P14 installer and release remain OPEN/NOT_RUN. `main` untouched. Overall completion percentage cannot be derived from fixture tests.
