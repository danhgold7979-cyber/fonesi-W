# Increment059 — frozen exact media order vs durable owned staging/MediaStore evidence

Date: 2026-10-29. Repository `danhgold7979-cyber/fonesi-W`; branch `feat/studio-workspace`.
Plan-first `docs/implementation/INCREMENT-059_PLAN.md` at commit `906e2e6586609c86c5279c07bef3d2738500daca`.
**Exact tested source SHA: `16c60680406a99864b635aad513eb50df3bcfef9`.**
Scope: P11/S096.1 partial implementation; **NOT Android picker selection**.

## Source implemented

- `packages/contracts/src/schedule.ts`: typed `PersistedOrderedMediaReport` and finite `MediaOrderBlocker` codes, nested within existing `JobStageReviewPage`. This output contains only ordinal, IMAGE/VIDEO/UNKNOWN, persisted row evidence state and sanitized blocker code. Never emits source/stage IDs, file/remote path, basename, hash, nonce, MediaStore row ID or Android serial. Global states: `BLOCKED`, `INDEXED_CANDIDATES_NOT_PICKER_VERIFIED` and `NO_MEDIA`. Both `canSelect:false` and `canDispatch:false` are enforced unconditionally.
- New `packages/database/src/media-selection.ts`: `assessPersistedMediaOrder` computes a deterministic **ordered frozen media → owned stage → MediaStore row** mapping. Canonical asset order comes only from frozen `snapshot.assetIds` (max 32 distinct IDs). Each index must reference one READY pinned asset with matching asset ID, hash/bytes and valid media kind, exactly one stage of that ordinal and same job/device/snapshot/claim generation, and a canonical owned path derived from job+ordinal+nonce+the pinned asset extension. It checks SYNC ACK and matching durable remote readback, one exact indexed-row receipt (row ID, canonical display name/relative path/bytes/mime family), and no latest contradictory reconciliation. Missing/extra/duplicate stages, row ID or target aliasing, malicious paths, effects, bad pins/claims or mismatched MediaStore evidence fail closed.
- `packages/database/src/index.ts`: `jobStageReview` reads at most 33 owned stages and one newest reconciliation per stage, validates frozen job snapshot, reads historical claim generation and presence of effects, then invokes the pure ordered checker. All returned fields are redacted; original keyset audit pagination is preserved. No DB migration, device I/O or mutation and no new privileged operation.
- `apps/desktop/src/renderer/JobStageReviewDialog.tsx`: shows human-readable ordered slots and blockers in the existing Schedule dialog, under explicit **chưa xác minh picker** warnings. No select/tap/post/delete/requeue button.
- New `packages/database/src/media-selection.test.ts`: tests same local basename for distinct assets and reversed insertion order, plus swapped ordinals, wrong asset/hash/bytes, missing/extra stage, path traversal/foreign owner, duplicate MediaStore row/remote destination, incorrect row identity/MIME/size, bad claim, no readback, latest audit contradiction and external effect. `packages/database/src/device-stage.test.ts` uses real SQLite migration v20 + owned ACK/readback/indexed row to check redacted report, immutability, reopen survival and later contradictory audit blocking. `tests/ui/schedule.spec.ts` checks the real browser view's blocked state, warnings and absence of a picker select action.

## Exact-source CI evidence

| Workflow | Ubuntu | Windows |
|---|---|---|
| [Push 40853967640](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40853967640) | SUCCESS | SUCCESS |
| [PR 40853978957](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40853978957) | SUCCESS | SUCCESS |

Ubuntu: **396/396 unit/integration tests (40 files), 31/31 Chromium UI**, generated contracts/typecheck/lint/build and plan validators PASS.
Windows: **395 unit/integration pass + 1 platform-only skip (40 files)**, generated/typecheck/lint/build, `start-windows.ps1 -VerifyOnly` and plan validators PASS.
All values refer to source SHA `16c60680406a99864b635aad513eb50df3bcfef9`, not subsequent documentation commits.

## State/acceptance boundary

Status **TESTED_S096_PERSISTED_ORDER_EVIDENCE_NOT_ACCEPTED**. Even if all historical indexed rows match, `INDEXED_CANDIDATES_NOT_PICKER_VERIFIED` is **not** proof that the current Android picker displays/chooses the desired assets in order. Job/stage/lease/effect state is unchanged. No actual picker input, Unicode compose, publish/post verification or Android deletion is performed. S095/AT-095 and S096/AT-096 remain NOT_ACCEPTED because physical Windows10+Android USB/LAN, exact picker and current native app profile tests have not run. P12–P14 live app adapters, device fleet scale 20–300 and installer/release remain OPEN. The overall 15 phase/125 step/375 task percentage cannot be grounded in fixture test counts.
