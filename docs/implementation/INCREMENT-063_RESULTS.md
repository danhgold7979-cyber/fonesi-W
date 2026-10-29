# Increment063 — exact pinned workflow, snapshot and ordered media fingerprints

Date: 2026-10-29. Repository `danhgold7979-cyber/fonesi-W`, branch `feat/studio-workspace`. Owner: P11/S096.1–S096.3 source hardening; **not** real Android picker/compose certification.

Plan-first [INCREMENT-063_PLAN.md](INCREMENT-063_PLAN.md) at commit `0f3d8d6fbe990f62f7faca3ab9989df460004295`.
Initial source `e18f1d0a19c1cef1efc67e3d96af3c4a38cdbad0`; asset-order correction `35a103f4117a30c6c6ed629724298d4e106c666e`; snapshot-fingerprint correction / **exact tested source** `51dee5b45f177d4635ba127eb75493628afcf2e6`.

## Source changes

- `packages/database/src/compose-review.ts`: recompute exact canonical workflow bundle SHA-256 (`bundleHash`) and validate against pinned `snapshot.workflowHash`; recompute exact immutable job snapshot hash (`contentHash`) against the SQLite-provided `snapshotHash`. Fail closed with finite redacted blocker codes on mismatches or malformed JSON.
- Match the canonical `snapshot.assetIds` order to one uniquely pinned asset per slot: required READY state, image/video kind matching the redacted media-order report, valid SHA-256 fingerprint and positive safe byte count. Extra/missing/duplicated descriptors, invalid hashes, invalid bytes or wrong kind block. Descriptor enumeration order and duplicate filenames are not used as ordering authority.
- Private-only `FrozenComposeManifest.orderedAssets` now carries ordinal, asset ID, kind, pinned hash and bytes; private `snapshotHash` is available for future trusted comparison. These details NEVER appear in `JobStageReviewPage`, renderer or public API.
- `packages/contracts/src/schedule.ts` adds `WORKFLOW_FINGERPRINT_MISMATCH`, `SNAPSHOT_FINGERPRINT_MISMATCH`, `FROZEN_MEDIA_BINDING_INVALID` to bounded blockers; `JobStageReviewDialog.tsx` renders accessible Vietnamese labels, with no new action or permission.
- `packages/database/src/index.ts` supplies the already verified immutable SQLite snapshot hash to the pure private comparator. `compose-review.test.ts` now uses canonical workflow/snapshot digests, two media with identical filenames but different hash/bytes, tests shuffled descriptor enumeration and explicit altered hashes/snapshot/bundle/media. `device-stage.test.ts` and `tests/ui/schedule.spec.ts` preserve privacy, read-only state and no Publish controls.

## CI failures and corrections

The initial implementation (`e18f1d0a19c1cef1efc67e3d96af3c4a38cdbad0`) and asset-order revision (`35a103f4117a30c6c6ed629724298d4e106c666e`) failed a regression that changed a pinned asset's hash to another **valid-format SHA-256**. Checking only hash shape cannot prove the original immutable snapshot. The corrected implementation binds the private manifest to SQLite's exact `snapshotHash` instead of weakening the negative test. That fix was committed at `51dee5b45f177d4635ba127eb75493628afcf2e6` and re-tested.

| Exact-source CI | Ubuntu | Windows |
|---|---|---|
| [Push 40866320913](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40866320913) | **SUCCESS** | **SUCCESS** |
| [PR 40866328763](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40866328763) | **SUCCESS** | **SUCCESS** |

Ubuntu: **450/450 unit/integration (42 files)** and **31/31 Chromium UI**. Windows: **449 PASS + 1 platform-only skip (42 files)**. Generated contracts, typecheck, lint, build, Windows `start-windows.ps1 -VerifyOnly`, and both V2.1 plan validators passed on the same exact source commit.

## Boundary and remaining gates

Status: **TESTED_S096_PINNED_FINGERPRINTS_NOT_ACCEPTED**. These are correctness checks over frozen source data and persisted SQLite staging; they do NOT prove live Android selection, actual Unicode typing, target/account screen inspection or external post verification. `canSelect`, `canType`, `canVerify`, `canPublish` and `canDispatch` stay false. No Android input, ADB click, effect dispatch, upload, cleanup, requeue, schema change or release. S087/R2, S095/R3, S096/AT-096, full P11, P12–P14, real USB/LAN fleet tests and Windows installer remain OPEN/NOT_RUN. No grounded overall percentage is available.
