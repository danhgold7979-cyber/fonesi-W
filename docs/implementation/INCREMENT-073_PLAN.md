# Increment073 — P11/S100.2 frozen comment safety-metadata integrity

Date: 2026-10-29. Repository `danhgold7979-cyber/fonesi-W`; branch `feat/studio-workspace`. Verified baseline HEAD `8d4509f5269035f737c81f074d7f6ee5f981437e`. Plan-first, no `main` changes.

## Gap and dependencies
Increment072 compares immutable comment bytes/hash and effects, but the pure private assessor does not reject a forged frozen plan with nonempty blockers or enabled canConfirm/canRetry/canDispatch metadata. A caller could still receive an UNCERTIFIED candidate from a contradictory frozen planning record. No real provider attestation exists.

## Scoped implementation
1. In `packages/database/src/comment-verification.ts`, extend the existing EXPECTATION_INVALID check so the frozen plan must contain an empty blockers array and all three rights exactly `false`. Any malformed/altered metadata blocks before readback matching; no mutation, no new execution rights.
2. In `packages/database/src/comment-verification.test.ts`, add bounded negative regression cases for blockers, forged true capability flags and missing rights/metadata. Retain the valid candidate UNCERTIFIED regression.
3. Run suitable local checks when supported and exact SHA GitHub Actions Ubuntu/Windows; log CI only after observing it. Record RESULTS/PROGRESS/checkpoint only with real evidence.

## State and fault matrix
Frozen plan valid + one exact synthetic candidate -> EXACT_CANDIDATE_UNCERTIFIED, never confirm/retry/dispatch. Frozen blockers nonempty, wrong/missing flags or invalid blockers shape -> BLOCKED/EXPECTATION_INVALID, no candidate and no dispatch. No-match/stale readback retains review semantics. S100.2/AT-100, physical Android/Windows and P11–P14 remain unaccepted.
