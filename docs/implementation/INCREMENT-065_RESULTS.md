# Increment065 — private exact provider post candidate filter, never a provider confirmation

Date: 2026-10-29. Repository `danhgold7979-cyber/fonesi-W`, branch `feat/studio-workspace`. Owner P11/S098.1–S098.3 **pre-verifier only**.
Plan-first [INCREMENT-065_PLAN.md](INCREMENT-065_PLAN.md) at `76ddfa861700d17b992010a2070ddf5f82eb3491`. Initial source `639a8aacda99445044fb86d84c6eab5d5388d8c3`; strict TS fix `6e4f8fcf34f269189bfe10763c29ec4ffb5d127c`; sparse Unicode ordinal fix `ca1d3a9cfd3d362fd652b120109cb9071143e2ee`; Windows migration test timeout correction and **exact tested source** `579b939558c2896545be9135b0bd5ef293de4ae5`.

## Implemented source

- New `packages/database/src/post-verification.ts`: private pure `assessProviderPostCandidates` compares an immutable `FrozenComposeManifest` plus a durable `PUBLISH/ATTEMPT_UNCERTAIN` effect context with at most 32 independently supplied provider observation records. Requires exact app/account/target identity, a bounded external post reference, attempt-bound post time, recent observation, ordered media SHA-256/bytes and Unicode field ordinal/scope/kind/UTF-8 SHA-256/bytes. No filename, thumbnail, caption-only or mutable Process matching.
- An exact unique candidate is `EXACT_CANDIDATE_UNCERTIFIED`, not confirmed. Zero candidates remain `NO_EXACT_CANDIDATE_REVIEW`; competing exact matches are `AMBIGUOUS_REVIEW`. Duplicate or malformed provider identities/observation records fail closed. The returned summary is bounded/redacted, with `canConfirm:false`, `canRetry:false`, `canDispatch:false`. No SQLite state transition, external provider, HTTP/IPC command or renderer exposure.
- Added `packages/database/src/post-verification.test.ts` with exact match, no-result, ambiguity, duplicate IDs, max count, wrong app/account/target, changed Unicode digest/bytes, reversed or changed media order/hash/bytes, invalid/stale/future timestamps, invalid effect/snapshot and sparse declared field ordinal cases.
- Under CI, fixed strict TypeScript callback parameter inference in `post-verification.ts` without suppressing type checks; supported sparse frozen field ordinals (optional fields may leave ordinal gaps) while rejecting duplicates.
- `packages/database/src/content-page-upgrade.test.ts`: recurrent Windows CI migration-correctness test exceeded the 10-second Vitest per-test time budget on busy shared runners although identical source passed other Windows runs. Extended only this migration test's timeout to 30 seconds; kept all schema/data assertions. Recorded correction in plan.

## CI evidence and corrections

The initial source commit `639a8aacda99445044fb86d84c6eab5d5388d8c3` failed strict TypeScript on Ubuntu+Windows; corrected at `6e4f8fcf34f269189bfe10763c29ec4ffb5d127c`. The sparse field handling correction `ca1d3a9cfd3d362fd652b120109cb9071143e2ee` passed PR CI while one Windows push job failed solely due migration fixture timeout. After the targeted timeout fix `579b939558c2896545be9135b0bd5ef293de4ae5`, exact-source [push CI 40870893059](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40870893059) and [PR CI 40870900256](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40870900256) **both SUCCESS on Ubuntu and Windows**.

- Ubuntu: **484/484 unit/integration, 43 files; 31/31 Chromium UI**.
- Windows: **483 passed + 1 platform-only skip, 43 files**.
- Generated contracts/typecheck/lint/build, Windows `scripts/start-windows.ps1 -VerifyOnly` and both V2.1 plan validators PASS.

## Acceptance limits

Status **TESTED_S098_POST_CANDIDATE_FILTER_NOT_ACCEPTED**. No production Facebook/TikTok provider is wired; inputs are simulated, not Android readbacks. A candidate cannot advance an effect to `CONFIRMED` or a job to `POSTED`. No actual device picker, Unicode input, target/account screen proof, post, comment, cleanup, fault-injection hardware or scale/installer test was run. S087/S095/S096, S097, S098/AT-098 and P11, P12–P14 remain NOT_ACCEPTED. Overall completion percentage cannot be inferred from fixture counts, and `main` remains unchanged.
