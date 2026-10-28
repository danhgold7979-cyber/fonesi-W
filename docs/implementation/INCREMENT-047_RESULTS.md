# Increment047 — exact Android MediaStore row probe

Date: 2026-10-28. Repository: `danhgold7979-cyber/fonesi-W`; branch `feat/studio-workspace`. Plan-first source: [INCREMENT-047_PLAN.md](INCREMENT-047_PLAN.md), baseline `2e5eeab3c10d13acf541fbabc01c969060049e8c`. Tested source SHA: `a3add4f740584c62138ed0c9dc353883550c26c2`.

## Implemented

- Added a private, bounded ADB-side MediaStore query using a filename and relative path derived from the durable job/ordinal/nonce identity; no renderer-supplied remote path.
- Parses only bounded output and accepts `INDEXED_EXACT` when there is exactly one row with numeric row ID, exact display name, relative path, exact expected byte count and compatible MIME family. No row, multiple rows, unsupported columns/permissions and malformed output fail closed.
- Added append-only SQLite migration v17 for MediaStore row ID, display name, relative path, MIME, bytes and observation timestamp. Existing migrations v1–v16 were not edited.
- Added private `stage.recordMediaStore` persistence requiring a live JOB lease/claim, matching job revision/snapshot, verified remote-byte readback and exact ownership/path/size/MIME checks. Evidence is immutable and audited.
- Added private host coordinator `verifyMediaStoreRow`; fences transport before/after probe and returns `MEDIASTORE_ROW_MATCHED_NOT_PICKER_VERIFIED` with `canDispatch: false`. The durable stage state remains `SYNC_ACK_UNVERIFIED`; no automatic posting or dispatch was added.
- Fixed an ESLint `no-useless-escape` failure in the output parser in commit `a3add4f`.

## Exact-source CI

Both workflows completed successfully on SHA `a3add4f740584c62138ed0c9dc353883550c26c2`:

- [Ubuntu workflow 40710327100](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40710327100): `pnpm check` — 332/332 tests across 39 files; `pnpm test:ui` — 30/30 Chromium; generated contracts, typecheck, lint, build and plan validators PASS.
- [Windows workflow 40710336317](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40710336317): `pnpm check` — 331 passed, 1 platform-only skip (39 files); generated contracts, typecheck, lint, build, Windows `VerifyOnly` and plan validators PASS. Windows UI suite is not run in this workflow.

## Acceptance boundary

Status: **TESTED_MEDIASTORE_ROW_PROBE_NOT_PICKER_VERIFIED**. Tests use fake ADB/SQLite fixtures; no physical Android acceptance is claimed. Still NOT_RUN: physical phone MediaStore probe and picker visibility/selection correlation, uncertainty reconciliation and safe cleanup of owned remote files, certified private JOB executor, real Facebook/TikTok posting and post verification, Windows 10 physical USB/LAN, 20→100→300 device load, installer/release and merge to `main`. A matching MediaStore row is not proof that a specific social app's picker shows or selects the exact asset.
