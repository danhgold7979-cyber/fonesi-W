# Increment071 — P11/S100.1–S100.2 exact frozen comment payload at claimed adapter boundary

Date: 2026-10-29. Repository `danhgold7979-cyber/fonesi-W`, development branch `feat/studio-workspace`.
Verified baseline HEAD `40902ee167e29938fc5f0f6425a21b80cb15cdd4`; Increment070/checkpoint-063 exact-source and checkpoint Push/PR CI successful on Ubuntu and Windows. No changes to `main`.

## Dependency and concrete gap

Increment069 derives exact immutable UTF-8 comment text and ordinal keys. Increment070 enforces the frozen item effectKey/payloadHash at the durable SQLite COMMENT INTENT transaction. But `HostClaimedEffectService`'s trusted injected adapter callback currently receives only effect/job/node/kind/lease, *not the exact comment body*. A future provider might fetch mutable Content/Process rows or accept an unverified string. Bridge this missing trusted-runtime capability without installing a real Android adapter or granting posting permission.

## Implementation plan

1. `packages/database/src/index.ts`: add private read-only `resolveClaimedCommentDispatch` using the current claim/lease/generation and a live checked `ATTEMPT_UNCERTAIN` COMMENT effect. Inputs effectId, jobId, exact job revision/snapshot hash, source postEffectId, typed list field/scope, bounded ordinal, lease and timestamp. First invoke the existing `assertClaimedEffectDispatch`, then require the exact journal kind and ownership, and re-derive the item via persisted CONFIRMED parent PUBLISH and immutable job `FrozenCommentListPlan`. Compare the journal's effectKey and payloadHash to those of the same ordinal. Reject missing parent, wrong ordinal, stale/released lease, altered journal, invalid source or snapshot before returning any text. A successful response is trusted private data **only**, not a device permission.
2. `apps/desktop/src/host/internal.ts`: expose only a new private worker `comment.resolveClaimed` request to the host service; never a renderer/preload/HTTP/StudioApi command.
3. `apps/desktop/src/host/claimed-effect-service.ts`: after actual SQLite INTENT and ATTEMPT_UNCERTAIN transactions and successful private `effect.assertClaim`, resolve a COMMENT-only typed payload. Verify returned effect/job/ordinal, deterministic effectKey/payloadHash and that the exact UTF-8 bytes hash and byte count match, using Node crypto. Only then pass `{value, ordinal, utf8Hash, utf8Bytes}` as a discriminated COMMENT adapter argument; PUBLISH must never receive a comment. Errors before adapter leave uncertain journal and cannot cause replay/confirmed status. Respect cancellation after async payload resolution. Only trusted host/injected adapter can see the text; no public output or logging.
4. `packages/database/src/claimed-effect.test.ts`: real SQLite + injected host adapter integration for two identical multiline Vietnamese/emoji comments with distinct ordinal binding; verify exact frozen value is received once and not mutable Content, journal remains ATTEMPT_UNCERTAIN, adapter ACK remains unverified. Simulate tampered journal hashes after commit, bad private worker receipt/text/hash, released lease after fence and before resolution, prior publish not CONFIRMED and wrong ordinal; require zero adapter calls and durable uncertainty. Assert no raw text appears in public dispatch, generic error or host result. Exercise existing PUBLISH flow unchanged.
5. Run exact-source GitHub Actions generated contracts/typecheck/lint/unit/integration/build, Chromium UI Ubuntu, Windows VerifyOnly and plan validators. Correct failures and rerun. Only then write `INCREMENT-071_RESULTS.md`, `docs/evidence/implementation/checkpoint-064.json`, `PROGRESS.md`, and `COMPLETION_PLAN.md` with exact source SHA and OS-specific CI results.

## State/failure boundaries

INTENT + ATTEMPT_UNCERTAIN must already be committed before any private comment text reaches the injected adapter. A positive fixture does NOT send Android input, confirm a post/comment, grant retry, or prove any provider or account/target profile. Negative/unknown transport and response windows keep the journal ATTEMPT_UNCERTAIN for review, with no automatic retries. The host and SQLite fence is asynchronous: the future real adapter must recheck lease/transport immediately at its own input boundary. No DB migration or effect state transition beyond existing journal path.

## Acceptance

Expected maximum status `TESTED_S100_PRIVATE_COMMENT_ADAPTER_PAYLOAD_NOT_ACCEPTED`. Real S087/S095/S096, AT-097/AT-100, profile-specific Unicode typing, actual Facebook/TikTok comment proof, per-item readback/only-comment retry, S101–S103, hardware load, P12–P14 and Windows installer remain OPEN/NOT_RUN. Scope remains 15 phases / 125 steps / 375 tasks, not a fabricated completion percentage.
