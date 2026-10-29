# Increment068 — P11/S097.2–S099 trusted effect dispatch re-fence

Date: 2026-10-29. Repository `danhgold7979-cyber/fonesi-W`, branch `feat/studio-workspace`.
Plan-first baseline: `394856788200b79928a5c3c58bb87a1b91fc1c1c` (Increment067/checkpoint-060, exact-source and documentation CI successful on Ubuntu/Windows). Owner P11/S097.2, S097.3, S099.2 hardening. No change to `main`.

## Gap and dependency

The host coordinator writes `INTENT` then `ATTEMPT_UNCERTAIN` durably before calling an injected effect adapter. The second transaction validates the JOB lease/claim, but the asynchronous boundary between that transaction's receipt and the actual adapter callback can permit a newly expired/released/superseded JOB lease or changed job revision, device identity, or effect state to reach the adapter. A future real provider must be fenced both by the database worker immediately before the callback and again at its own device-input boundary. This increment adds the first guard without claiming the second is implemented.

## Implementation scope and files

1. `packages/database/src/index.ts`: add PRIVATE read-only `assertClaimedEffectDispatch` for an existing journaled `ATTEMPT_UNCERTAIN` effect. Accept exact effect ID, job revision, immutable snapshot hash, JOB lease and host clock; validate IDs/time, owner, expiry, claim generation, enabled verified device identity via existing `assertEffectClaim`, journal state/kind, current job phase and revision, snapshot hash/bytes. Return literal `true` only on consistency; reject with bounded DomainError codes. No SQLite writes, retries or confirmation.
2. `apps/desktop/src/host/internal.ts`: add a discriminated `effect.assertClaim` private worker request/dispatch to the DB guard. Never expose via public StudioApi, HTTP, preload or renderer.
3. `apps/desktop/src/host/claimed-effect-service.ts`: after durable `ATTEMPT_UNCERTAIN` receipt, and after cancellation check, call the private DB fence with a freshly sampled host time; require literal `true` before a single `adapter.sendOnce`. If the fence fails or returns a forged/malformed receipt, never call the adapter. Already persisted uncertainty stays for review; never treat fence failure as a DEFINITIVELY_REJECTED post and never automatically retry.
4. `packages/database/src/claimed-effect.test.ts`: host order becomes INTENT -> ATTEMPT_UNCERTAIN -> effect.assertClaim -> adapter. Insert genuine SQLite post-attempt lease release, stale generation / expired lease, changed job revision, identity conflict and invalid fence response cases; prove zero callback and persisted uncertainty. Reopen SQLite and recover into NEEDS_REVIEW (no replay). Ensure public dispatch rejects forged `effect.assertClaim`. Preserve existing abort/restart/ACK tests.
5. Run exact-source `pnpm check`, Ubuntu Chromium `pnpm test:ui`, Windows VerifyOnly and `pnpm check:plan` via GitHub Actions Ubuntu and Windows. Fix failures, then write `INCREMENT-068_RESULTS.md`, `docs/evidence/implementation/checkpoint-061.json`, `PROGRESS.md`, `COMPLETION_PLAN.md` with the tested SHA, OS/job IDs and remaining gates.

## State transitions / failure matrix

- Valid effect ATTEMPT_UNCERTAIN + exact live JOB lease/claim + matching job/snapshot -> the pure fence returns true; only then the injected adapter may be called once. ACK remains ACK_UNVERIFIED.
- Stale/released/superseded/expired lease, changed revision/state/snapshot/device identity, missing/non-uncertain effect, malformed clock or invalid internal receipt -> fence rejects and no adapter callback.
- A fence rejection after ATTEMPT_UNCERTAIN must leave it durable; recovery creates/retains NEEDS_REVIEW without clearing or replaying. Aborted attempt after the durable boundary remains review-required.
- The host-to-database re-fence is NOT an atomic device I/O guarantee. Future real adapter must independently assert transport identity, lease generation and ownership immediately at its device-input boundary. The current injected fixture is not a certified Facebook/TikTok provider.
- No schema migration, public API mutation, Android input, post, retry, cleanup, effect confirmation, or CI assumption about real hardware.

## Acceptance boundary

Best expected status: `TESTED_S097_PRE_DISPATCH_FENCE_NOT_ACCEPTED`. P11 and S097/AT-097 hardware windows remain NOT_ACCEPTED; S087/S095/S096, S098–S103, P12–P14 and real Windows10+Android USB/LAN/fleet/install gates remain OPEN/NOT_RUN. No overall tool completion percentage from fixture counts.
