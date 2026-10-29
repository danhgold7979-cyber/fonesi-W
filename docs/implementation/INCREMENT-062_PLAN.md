# Increment062 — P11/S096.3 frozen compose expectation and redacted operator review (not Android verification)

Date: 2026-10-29. Repository `danhgold7979-cyber/fonesi-W`; branch `feat/studio-workspace`.
Baseline: HEAD `84090432b13329139ea213e29e0f9d90bde93da1`; Increment061/checkpoint-054 exact-source CI passed Ubuntu/Windows. No changes to `main`.
Owner: S096.3 *preparation only*. S087, S095 and AT-096 physical Windows10/Android gate remain OPEN.

## Problem

Increment059 verifies frozen media order only against stored stage/MediaStore receipts, and Increment060/061 validates frozen Unicode values but does not type them on a phone. Neither currently joins those source-only checks with the frozen job's app/account/target/content bindings into one stable, privacy-safe compose expectation. The UI must never mistake a complete source manifest for live picker, exact target or verified text-input proof.

## Source changes and limits

1. `packages/contracts/src/schedule.ts`: add `FrozenComposePreflight` with fixed `scope:'FROZEN_COMPOSE_NOT_ANDROID_VERIFIED'`, `status:'BLOCKED'|'FROZEN_EXPECTATIONS_LIVE_UNVERIFIED'`, bounded blocker enums, redacted app/account/target flags and exact frozen field/media counts only; `canVerify:false`, `canPublish:false`, `canDispatch:false`. Add `compose` to read-only `JobStageReviewPage`. No app/account/target IDs, captions, hashes, paths, MediaStore row IDs or provider claims in the DTO.
2. New `packages/database/src/compose-review.ts`: pure private `deriveFrozenComposeExpectation` based only on `JobDefinition`, immutable `JobSnapshot`, source-only media evidence and private Unicode plan. Bind pinned workflow app, account, target, content, exact media ordinals and UTF-8 field hashes; reject malformed/missing binding IDs, wrong content relation, invalid workflow pin, unsafe job state, external effect, malformed Unicode, bad media order, or empty content. No fallback to mutable Process/global data. Return a private manifest **only when all source checks pass**, and a separate redacted summary. Even with no blockers, status means *source expectations only*, never actual Android certification.
3. `packages/database/src/index.ts`: compute the private composed expectation inside existing read-only SQLite `jobStageReview` using the same immutable snapshot and existing media/Unicode reports. Return only `compose.summary`; no database migration or additional public command.
4. `apps/desktop/src/renderer/JobStageReviewDialog.tsx`: show accessible `Mục tiêu & nội dung ghim (chưa xác minh Android)` with bounded scope flags, blocker labels and explicit blocked/no-publish message. No action buttons.
5. `packages/database/src/compose-review.test.ts`: pure positive (frozen manifest with hashes + order, still cannot verify/publish) and negative (missing/invalid account/target/app, content mismatch, wrong job state, media order blocked, invalid Unicode, no content, effects) plus immutability and public redaction checks. `packages/database/src/device-stage.test.ts` and `tests/ui/schedule.spec.ts` assert integration/renderer never reveal identity, text or digest or grant dispatch; report read remains read-only across reopen.
6. Run exact-source GitHub Actions generated/typecheck/lint/build/unit/integration, Ubuntu Chromium UI, Windows VerifyOnly and plan validators. Fix CI failures before checkpoint; write `INCREMENT-062_RESULTS.md`, `docs/evidence/implementation/checkpoint-055.json`, `PROGRESS.md` and `COMPLETION_PLAN.md` after actual verification.

## State, failure and acceptance

Read-only computation; no device I/O or state transitions. `BLOCKED` for invalid/missing frozen source data; `FROZEN_EXPECTATIONS_LIVE_UNVERIFIED` for internally consistent pinned source manifest only. `canVerify`, `canPublish`, `canDispatch` always false. No picker action, Unicode typing, user/account spoofing, intent/effect attempt, ADB input, external publish or cleanup. Physical app-profile/target/content/picker/Unicode proof, S096/AT-096, S097–S102, P11–P14 and fleet/release gate remain OPEN. Best possible result: TESTED_S096_FROZEN_COMPOSE_EXPECTATION_NOT_ACCEPTED; no overall percent without task/evidence reconciliation.
