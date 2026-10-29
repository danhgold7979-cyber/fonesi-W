# Increment063 — P11/S096.1–S096.3 exact frozen workflow/media identity hardening

Date: 2026-10-29. Repository `danhgold7979-cyber/fonesi-W`, branch `feat/studio-workspace`. Baseline HEAD `ea01dde1bd32cd7fd8b4d821c81dbbd359cfec0a` (Increment062/checkpoint-055, push+PR CI success Ubuntu/Windows).

## Dependency / failure found

Increment062's private `deriveFrozenComposeExpectation` checks that `snapshot.workflowHash` looks like a SHA-256 and that persisted stage ordinals look consistent, but does not recompute the hash of `snapshot.bundle` or bind the selected asset IDs to each immutable `snapshot.assets` hash/byte length in the compose manifest. Consequently a direct private caller using a tampered snapshot and synthetic positive reports could receive a source manifest with mismatched workflow bytes or missing media fingerprints. `createJob` and the original stage checker have related guards, but the compose manifest must be independently fail-closed before future trusted provider integration.

## Changes

1. `packages/contracts/src/schedule.ts`: extend bounded, redacted `FrozenComposeBlocker` with `WORKFLOW_FINGERPRINT_MISMATCH` and `FROZEN_MEDIA_BINDING_INVALID`. Keep all capability booleans permanently false.
2. `packages/database/src/compose-review.ts`: recompute canonical `bundleHash(snapshot.bundle)` and compare to pinned `snapshot.workflowHash`, catching malformed input as a blocker; no mutable workflow fallback. For each frozen `assetIds` ordinal require exactly one matching pinned asset in `snapshot.assets`, state READY, supported image/video kind, valid SHA-256 hash and positive safe integer bytes, and agreement with the media report's ordinal/kind. Reject duplicate/missing/changed/misordered/malformed asset payload even if the MediaStore summary says INDEXED. Expose a **private-only** `orderedAssets` manifest with ordinal, exact asset ID, kind, pinned hash and bytes alongside legacy `orderedAssetIds`. Do not render any of those values. A text-only job with genuinely zero media remains valid.
3. `packages/database/src/compose-review.test.ts`: set canonical workflowHash and pinned media assets in the positive fixture (two identical basenames deliberately having distinct hash/bytes); assert private order/hashes/bytes. Add negative cases for valid-format-but-wrong workflow digest, missing/extra/duplicate/changed/wrong-kind media, altered hash/bytes, wrong report kind. Confirm failure nulls private manifest and public summary has only finite blockers with no IDs, hashes or text.
4. `apps/desktop/src/renderer/JobStageReviewDialog.tsx`: explicit Vietnamese descriptions for the two new blocker codes, no new action.
5. Regression `packages/database/src/device-stage.test.ts` / `tests/ui/schedule.spec.ts` (if needed): check persisted review remains redacted and no dispatch/PUBLISH permissions, SQLite state/history unchanged.
6. Run exact-source GitHub Actions on Ubuntu and Windows: generated contracts, typecheck, lint, unit/integration, build, Chromium UI (Ubuntu), Windows VerifyOnly, source/plan validators. Fix failures, then record RESULTS and checkpoint with source SHA and CI run IDs.

## State, risks and acceptance

Pure private calculation, read-only SQLite/UI projection, no schema migration; no state transition, app selector, Android input, posting, deletion or cleanup. `FROZEN_EXPECTATIONS_LIVE_UNVERIFIED` still does not certify physical profile, exact picker, Unicode, account/target or an external post. Keep S087, S095, S096/AT-096, P11, P12–P14 and fleet/release gates OPEN/NOT_RUN. Best attainable status: `TESTED_S096_FROZEN_WORKFLOW_MEDIA_FINGERPRINT_NOT_ACCEPTED`. Never calculate tool completion from fixture counts.
