# Increment065 — P11/S098.1–S098.3 private exact-provider post evidence comparison (candidate only)

Date: 2026-10-29. Repository `danhgold7979-cyber/fonesi-W`, branch `feat/studio-workspace`. Plan-first baseline HEAD `bfcceb171117bd787c9d99e8e9ac2d540d7299fe` (Increment064/checkpoint-057, source CI successful Ubuntu + Windows).

## Problem and dependencies

The durable S097 host boundary intentionally stops at ATTEMPT_UNCERTAIN and treats an Android adapter transport ACK as unverified. Before any real post can become CONFIRMED, trusted provider readback must distinguish the exact app, account, target, content, post time, external identity and ambiguous collisions. Mere caption equality, timeout or absence of a result must never certify a post or its definite failure. No certified Facebook/TikTok provider or Android evidence is connected yet.

## Scope and code

1. New `packages/database/src/post-verification.ts`: private pure `assessProviderPostCandidates` that consumes a pinned `FrozenComposeManifest`, a durable effect context (PUBLISH, effect ID/key/payload hash, ATTEMPT_UNCERTAIN, attempt timestamp) and an explicitly bounded set of independently obtained provider observation records. Reject malformed source expectation, effect/snapshot mismatch, invalid/corrupt observation, wrong provider/app/account/target, ordered media fingerprint, Unicode digest or byte count, missing external post ID, stale readback and post timestamps outside an attempt-bound window. Do not normalize Unicode, sort media, guess thumbnails or use mutable Process data.
2. Return a *private* candidate (matching external ID and observation) only for one exact non-conflicting match, and a redacted bounded summary with statuses BLOCKED / NO_EXACT_CANDIDATE_REVIEW / AMBIGUOUS_REVIEW / EXACT_CANDIDATE_UNCERTIFIED. **Never set canConfirm or canRetry true**, and do not write SQLite state. This does not make an untrusted observation authoritative; physical/profile certification is a separate future gate.
3. Reject conflicting records with the same external ID, multiple exact candidates, duplicate observation IDs and >32 observations. Do not interpret zero matches or a transient provider failure as a definitive failed post.
4. `packages/database/src/post-verification.test.ts`: fixture with exact manifest digests, two media with duplicated basenames and Unicode text; test single exact match, changed app/account/target, wrong unicode/media ordering/hash/bytes, time window, stale/ambiguous/duplicate IDs, malformed evidence and no-post cases; prove redacted summary contains no raw external IDs, content, account IDs or hashes, no mutation.
5. Run generated-contract/type/lint/build/unit/integration and Chromium UI / Windows VerifyOnly / plan validators via exact-SHA GitHub Actions; fix any failures; then update RESULTS/PROGRESS/COMPLETION_PLAN and checkpoint-058 only after verified source CI.

## State transitions and acceptance

No new database schema, effect transitions, runtime provider connection or renderer/HTTP/API command. A matching *synthetic* observation is **NOT** proof of an actual post and never advances ATTEMPT_UNCERTAIN. Actual Windows 10 + Android USB/LAN app/profile/identity/Unicode/picker/post/readback, crash-safe recovery, provider certification, fleet/load and packaging remain NOT_RUN; S098/AT-098, S097, P11 and downstream P12–P14 NOT_ACCEPTED. Best status: TESTED_S098_EXACT_POST_CANDIDATE_FILTER_NOT_ACCEPTED.

## CI-driven regression harness correction

The exact-source Windows **push** run for this increment and an earlier checkpoint PR intermittently timed out in `packages/database/src/content-page-upgrade.test.ts` at Vitest's default 10-second limit while other Ubuntu/Windows runs passed. That test checks historical SQLite migration **correctness**, not a migration throughput SLA. Increase only its per-test budget to 30 seconds, keep every database state/schema/history assertion intact, and re-run Ubuntu/Windows source checks. Record the original failed runs and the corrected SHA; do not hide real test assertions or accept hardware outcomes.
