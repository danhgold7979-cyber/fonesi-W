# Increment053 — canonical owned-stage path and fenced cleanup dry-run

Date: 2026-10-29. Repository: `danhgold7979-cyber/fonesi-W`; branch: `feat/studio-workspace`.
Scope: P11/S095.3 — ownership safety preconditions, **not Android deletion**.
Plan-first: [INCREMENT-053_PLAN.md](INCREMENT-053_PLAN.md); plan commit `b1e6a90e14a0354abd1ca3380b2e7e5d28d3659c`.
Implementation source commit: `5482ccd082cd4d7342b9ae58dd1db161283e51e2`.
**Exact tested source SHA: `b0543e71cff01b6924d42d8b039c20b7fefcf888`** (includes migration fixture test fix).

## Actual implementation

- `packages/devices/src/owned-stage.ts` provides a deterministic identity-to-path generator and an exact equality guard using the immutable `jobId`, ordinal 0–31, 32-character lowercase nonce and strict allowed extension. No arbitrary path is accepted; directory, display name and MediaStore relative path are derived from the same identity.
- `packages/devices/src/index.ts` now shares this helper in actual ADB Sync **SEND and RECV** and exact MediaStore query paths, instead of three independent pathname implementations. Existing ADB device lease fences, streaming byte checks and non-dispatchable ACKs remain intact.
- `packages/contracts/src/media.ts` adds private `OwnedStageCleanupAssessment`: `PERSISTED_PREFLIGHT_ONLY`, `PREREQUISITES_MET`/ `BLOCKED`, bounded reason codes, and unconditional `canDelete:false`/`canDispatch:false`.
- `packages/database/src/index.ts` adds `assessOwnedStageCleanup`. It reuses the existing MANUAL lease + historical JOB claim assertion and pinned stage snapshot; rejects a foreign/tampered target, missing or stale remote-byte evidence, any external effect, any indexed MediaStore history or recorded indexed row, uncertain transfer, and missing/stale/different-owner newest reconciliation. A candidate requires a `REMOTE_BYTES_MATCHED` + `NOT_INDEXED` observation at most 30 seconds old under the **same active MANUAL lease generation** and original historical JOB generation. It is a DB-only dry run, not current Android filesystem inspection.
- `apps/desktop/src/host/internal.ts` and `stage-transfer-service.ts` expose only a private host/worker preflight; the renderer, preload, `StudioApi` and HTTP dispatcher do not offer cleanup or a new lease capability.
- `packages/devices/src/sync.test.ts`, `packages/database/src/device-stage.test.ts`, `tests/stage-transfer-host.test.ts` add real source-path and SQLite/host fixture regression checks for ownership, tamper, expiry, stale/unsupported observations, indexed history, effect presence and no new ADB I/O. Job/stage are unchanged and no remote command deletes anything.

## CI and defect correction

Initial source `5482ccd082cd4d7342b9ae58dd1db161283e51e2` completed [push workflow 40840057134](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40840057134) SUCCESS on Ubuntu + Windows, but its duplicate [PR workflow 40840063518](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40840063518) failed from a **Windows 10-second timeout** in the preexisting v18→v19 SQLite migration fixture (other test files passed). This was not accepted as full CI green.

The old fixture performed 18 migration DDL/checksum writes separately; `packages/database/src/database.test.ts` now creates that historical fixture inside **one SQLite transaction** while preserving historical checksums, schema v18 contents and the v19 backfill assertions. This addresses avoidable Windows filesystem synchronization contention without raising test timeouts or weakening application transactions. The correction is committed as `b0543e71cff01b6924d42d8b039c20b7fefcf888`.

| Exact-source CI | Operating system | Result |
|---|---|---|
| [push 40840505284](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40840505284) | ubuntu-latest + windows-latest | **SUCCESS** on both jobs |
| [PR 40840511317](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40840511317) | ubuntu-latest + windows-latest | **SUCCESS** on both jobs |

Ubuntu: **352/352 unit/integration tests across 39 files**; **31/31 Chromium UI**; generated contracts, TypeScript, lint, build and plan validators passed.
Windows: **351 passed + 1 platform-only skip across 39 files**; generated contracts, TypeScript, lint, build, Windows `VerifyOnly` and plan validators passed. All numbers refer to `b0543e71cff01b6924d42d8b039c20b7fefcf888`, not the subsequent documentation checkpoint commit.

## State, limitations and next dependency

Status: **TESTED_S095_OWNERSHIP_CLEANUP_PREFLIGHT_NOT_ACCEPTED**.

No schema migration in Increment053 (SQLite stays **v19**), no destructive Android operation, no MediaStore deletion, no stage/job/effect state transition, no new UI button or dispatch authorization. A status `PREREQUISITES_MET` is **not permission to delete**: it is based on persisted facts and cannot rule out a race, picker selection or a new phone-side action. Only a future explicit operator-confirmed, currently revalidated, ledger-fenced cleanup protocol could consider an owned exact file.

Still NOT_RUN / OPEN: physical Windows10 and at least two Android phones, exact MediaStore→picker selection, native operator cleanup confirmation and crash-safe audit, live Facebook/TikTok publishing/post-verification, USB/LAN, 20→100→300 fleet test, installer/release and merge to main. S095 and P11 are **NOT ACCEPTED**; total tool completion percentage cannot be inferred from CI test count.
